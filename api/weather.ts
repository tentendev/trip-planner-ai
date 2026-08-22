export const config = {
  runtime: 'nodejs',
};

/**
 * Real weather forecasts via Open-Meteo (free, no API key).
 *
 * Query params:
 *   - q: destination free-text (e.g. "Tokyo") — required
 *   - start: YYYY-MM-DD trip start — optional (default: today, UTC)
 *   - end: YYYY-MM-DD trip end — optional (default: start + 13 days)
 *   - hl: language code for geocoded place names — default "en"
 *
 * Flow: geocode destination → daily forecast clipped to the intersection of the
 * trip window with Open-Meteo's ~16-day horizon → WMO weather_code mapped to
 * concise condition strings.
 *
 * Responds:
 *   { location: { name, latitude, longitude },
 *     days: [{ date, code, condition, temp_max_c, temp_min_c, precip_prob_pct }],
 *     coverage: 'full' | 'partial' | 'none' }
 *
 * Graceful failures are JSON { error, code } (400/404/429) rather than 5xx
 * wherever we can help it; an upstream outage degrades to coverage:'none'.
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
// Open-Meteo's daily forecast horizon: today .. today+15 (16 days inclusive).
const HORIZON_LAST_OFFSET_DAYS = 15;
// Default window when no dates are given: 14 days starting today.
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 92; // sanity bound on requested span

// --- WMO weather interpretation codes → concise conditions -------------------
const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Rain showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm, hail',
  99: 'Thunderstorm, heavy hail',
};

function conditionForCode(code: unknown): string {
  if (typeof code === 'number' && WMO_CONDITIONS[code] !== undefined) return WMO_CONDITIONS[code];
  return 'Unknown';
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// --- Date helpers (UTC-calendar based; ISO date strings compare lexically) ----
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// --- Geocode cache (per warm instance) ----------------------------------------
interface GeoResult { name: string; latitude: number; longitude: number }
const geocodeCache = new Map<string, { expires: number; value: GeoResult | null }>();
const GEOCODE_HIT_TTL_MS = 6 * 60 * 60_000; // place coordinates barely move
const GEOCODE_MISS_TTL_MS = 5 * 60_000;     // don't hammer lookups for junk queries

async function geocodeCached(query: string, hl: string): Promise<GeoResult | null> {
  const key = `${query.toLowerCase()}|${hl}`;
  const hit = geocodeCache.get(key);
  const now = Date.now();
  if (hit && now <= hit.expires) return hit.value;

  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: hl,
    format: 'json',
  });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const resp = await fetch(`${GEOCODING_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'TripOS/1.0' },
      signal: ac.signal,
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data: any = await resp.json();
    const top = data?.results?.[0];
    const value: GeoResult | null =
      top && typeof top.latitude === 'number' && typeof top.longitude === 'number'
        ? { name: String(top.name || query), latitude: top.latitude, longitude: top.longitude }
        : null;
    geocodeCache.set(key, {
      expires: now + (value ? GEOCODE_HIT_TTL_MS : GEOCODE_MISS_TTL_MS),
      value,
    });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

// --- Response cache keyed by rounded coords + clipped window ------------------
const CACHE_TTL_MS = 30 * 60_000;
const responseCache = new Map<string, { expires: number; body: unknown }>();

function cacheGet(key: string): unknown | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return null;
  }
  return hit.body;
}

function cacheSet(key: string, body: unknown): void {
  // Opportunistic cleanup so the Map cannot grow unbounded across a warm instance.
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expires) responseCache.delete(k);
    }
  }
  responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
}

// --- Per-IP sliding-window rate limit (same pattern as api/chat.ts) -----------
interface RateEntry { timestamps: number[] }
const rateBuckets = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 60_000;
const WEATHER_RPM_LIMIT = Number(process.env.RATE_LIMIT_WEATHER_RPM || 30);

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(ip) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_WINDOW_MS);
  if (entry.timestamps.length >= limit) {
    rateBuckets.set(ip, entry);
    return false;
  }
  entry.timestamps.push(now);
  rateBuckets.set(ip, entry);
  if (rateBuckets.size > 5_000) {
    for (const [k, v] of rateBuckets) {
      if (v.timestamps.every(t => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return true;
}

function clientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || 'unknown';
}

// --- Upstream forecast call -----------------------------------------------------
async function fetchDailyForecast(
  lat: number,
  lon: number,
  start: string,
  end: string
): Promise<any> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto', // day boundaries in destination-local time
    start_date: start,
    end_date: end,
  });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const resp = await fetch(`${FORECAST_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'TripOS/1.0' },
      signal: ac.signal,
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // Rate limit first — each cache miss fans out to two upstream calls.
  const ip = clientIp(req);
  if (!checkRateLimit(ip, WEATHER_RPM_LIMIT)) {
    return res.status(429).json({
      error: 'Too many requests — please wait a moment.',
      code: 'RATE_LIMITED',
      retry_after_seconds: 60,
    });
  }

  // --- Input validation -------------------------------------------------------
  const rawQ = req.query?.q;
  const q = typeof rawQ === 'string' ? rawQ.trim().slice(0, 200) : '';
  if (!q) {
    return res.status(400).json({ error: 'Missing required param: q (destination)', code: 'MISSING_QUERY' });
  }

  const hl = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(req.query?.hl || ''))
    ? String(req.query.hl)
    : 'en';

  const { start: startRaw, end: endRaw } = req.query || {};
  if (startRaw != null && !isValidDateStr(startRaw)) {
    return res.status(400).json({ error: 'Invalid start date (expected YYYY-MM-DD)', code: 'BAD_REQUEST' });
  }
  if (endRaw != null && !isValidDateStr(endRaw)) {
    return res.status(400).json({ error: 'Invalid end date (expected YYYY-MM-DD)', code: 'BAD_REQUEST' });
  }

  const today = todayUTC();
  const start = isValidDateStr(startRaw) ? startRaw : today;
  const end = isValidDateStr(endRaw) ? endRaw : addDays(start, DEFAULT_WINDOW_DAYS - 1);
  if (end < start) {
    return res.status(400).json({ error: 'end date precedes start date', code: 'BAD_REQUEST' });
  }
  const expectedDays = diffDays(start, end) + 1;
  if (expectedDays > MAX_WINDOW_DAYS) {
    return res.status(400).json({ error: `Trip window exceeds ${MAX_WINDOW_DAYS} days`, code: 'BAD_REQUEST' });
  }

  // --- Geocode -----------------------------------------------------------------
  let loc: GeoResult | null;
  try {
    loc = await geocodeCached(q, hl);
  } catch (err: any) {
    console.error('[weather] geocoding failed', err?.message || err);
    return res.status(502).json({ error: 'Geocoding service unavailable', code: 'GEOCODE_UNAVAILABLE' });
  }
  if (!loc) {
    return res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' });
  }

  // Clip the requested window to what Open-Meteo can actually serve.
  const horizonEnd = addDays(today, HORIZON_LAST_OFFSET_DAYS);
  const clipStart = start < today ? today : start;
  const clipEnd = end > horizonEnd ? horizonEnd : end;

  // --- Response cache (after clipping so near-duplicate windows share entries) --
  const cacheKey = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}|${clipStart}|${clipEnd}|${hl}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(cached);
  }

  // --- Forecast -----------------------------------------------------------------
  let days: {
    date: string;
    code: number;
    condition: string;
    temp_max_c: number | null;
    temp_min_c: number | null;
    precip_prob_pct: number | null;
  }[] = [];

  if (clipStart <= clipEnd) {
    try {
      const daily = await fetchDailyForecast(loc.latitude, loc.longitude, clipStart, clipEnd);
      const times: unknown[] = daily?.daily?.time || [];
      days = times.map((_, i) => {
        const wmo = daily?.daily?.weather_code?.[i];
        return {
          date: String(daily.daily.time[i]),
          code: typeof wmo === 'number' ? wmo : -1,
          condition: conditionForCode(wmo),
          temp_max_c: numOrNull(daily?.daily?.temperature_2m_max?.[i]),
          temp_min_c: numOrNull(daily?.daily?.temperature_2m_min?.[i]),
          precip_prob_pct: numOrNull(daily?.daily?.precipitation_probability_max?.[i]),
        };
      });
    } catch (err: any) {
      // Upstream hiccup: degrade to an empty (coverage 'none') payload instead of 5xx.
      console.error('[weather] forecast failed', err?.name, err?.message || err);
    }
  }

  const covered = days.length;
  const coverage: 'full' | 'partial' | 'none' =
    covered === 0 ? 'none' : covered >= expectedDays ? 'full' : 'partial';

  const body = {
    location: { name: loc.name, latitude: loc.latitude, longitude: loc.longitude },
    days,
    coverage,
  };
  cacheSet(cacheKey, body);

  // Cache 30 min at edge, stale-while-revalidate 1h (mirrors the in-memory TTL).
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json(body);
}
