// ---------------------------------------------------------------------------
// Nominatim geocoding (OpenStreetMap) — no API keys, per product constraint.
//
// Rate/courtesy compliance (why this module looks deliberately slow):
// - The Nominatim usage policy caps public endpoints at ONE request per
//   second per client. Requests are therefore issued strictly one at a time,
//   spaced >=1100ms apart. A 12-stop itinerary takes ~14s to geocode; that is
//   accepted for v1 because MapView streams markers in as each result lands.
// - The spacing is enforced through a MODULE-LEVEL slot allocator, not a
//   per-run counter: if two runs overlap (e.g. the markdown re-parses while
//   a previous chain is still draining), they still share one 1 req/s budget.
// - Policy asks clients to identify themselves via User-Agent or Referer.
//   Browsers cannot set User-Agent on fetch, but the automatic Referer header
//   provides identification; the optional `email` param stays unset because
//   it only matters for bulk users we are not.
// - Resolved coordinates persist in localStorage keyed by the normalized
//   query, so repeat views of the same trip never re-hit the endpoint at all.
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Called after each activity settles, with `null` for lookups that failed.
 * Lets the UI stream results in progressively instead of awaiting the whole
 * sequential chain (~1.1s per uncached stop).
 */
export type GeocodeProgress = (label: string, point: GeoPoint | null) => void;

const CACHE_STORAGE_KEY = 'trip-os.geocode-cache.v1';
/** > Nominatim's 1 req/s ceiling; the margin absorbs timer jitter. */
const REQUEST_SPACING_MS = 1100;
/** A hung request must never stall the whole sequential chain. */
const REQUEST_TIMEOUT_MS = 10000;
/** Prune oldest entries so the localStorage blob cannot grow unbounded. */
const CACHE_LIMIT = 500;

/** [lat, lng] tuples keep the stored JSON compact; array order = recency. */
type CacheShape = Record<string, [number, number]>;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readCache(): CacheShape {
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CacheShape = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      // Re-validate every entry: storage can be hand-edited or written by an
      // older schema, and one malformed row must not poison the whole cache.
      if (
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === 'number' && Number.isFinite(v[0]) &&
        typeof v[1] === 'number' && Number.isFinite(v[1])
      ) {
        out[k] = [v[0], v[1]];
      }
    }
    return out;
  } catch {
    return {}; // blocked/private-mode storage or corrupt JSON — degrade to no cache
  }
}

function writeCache(cache: CacheShape): void {
  try {
    const entries = Object.entries(cache);
    const pruned = entries.slice(Math.max(0, entries.length - CACHE_LIMIT));
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(Object.fromEntries(pruned)));
  } catch {
    /* quota exceeded or storage blocked — caching is best-effort */
  }
}

/** Abort-aware sleep: resolves early when the signal fires. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish);
  });
}

// Module-level throttle shared by every concurrent geocodeActivities run.
let nextSlotAt = 0;

async function reserveRequestSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextSlotAt - now);
  nextSlotAt = Math.max(now, nextSlotAt) + REQUEST_SPACING_MS;
  if (waitMs > 0) await delay(waitMs, signal);
}

interface NominatimHit {
  lat?: string;
  lon?: string;
}

/** One Nominatim lookup; any failure (network, timeout, abort, miss) → null. */
async function fetchFirstMatch(query: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  // Local controller fuses the caller's signal with our own timeout so both
  // actually cancel the underlying request instead of abandoning it.
  const ctrl = new AbortController();
  const forwardAbort = () => ctrl.abort();
  if (signal?.aborted) return null;
  signal?.addEventListener('abort', forwardAbort);
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimHit[];
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (!hit) return null;
    const lat = parseFloat(hit.lat ?? '');
    const lng = parseFloat(hit.lon ?? '');
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Geocode activity labels against a destination, sequentially and gently.
 *
 * Each label tries "<label>, <destination>" first; on a miss it falls back to
 * the destination itself so the stop still lands near the city center rather
 * than vanishing from the map. The destination lookup happens at most once
 * per run and is cached under its own key. Only resolved entries appear in
 * the returned map (keyed by the original label string); failures are silent
 * by design — an itinerary must render even when geocoding mostly misses.
 */
export async function geocodeActivities(
  activities: string[],
  destination: string,
  signal?: AbortSignal,
  onProgress?: GeocodeProgress,
): Promise<Map<string, GeoPoint>> {
  const resolved = new Map<string, GeoPoint>();
  const cache = readCache();
  const dest = destination.trim();

  // Identical labels across days collapse into one request.
  const queue: Array<{ label: string; key: string }> = [];
  const seen = new Set<string>();
  for (const raw of activities) {
    const label = raw.trim();
    const key = normalizeQuery(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    queue.push({ label, key });
  }

  // undefined = destination fallback not attempted yet; null = attempted, missed.
  let destPoint: GeoPoint | null | undefined;

  for (const { label, key } of queue) {
    if (signal?.aborted) break;

    const cached = cache[key];
    if (cached) {
      // Cache hits cost zero requests, so no rate slot is reserved for them.
      const point = { lat: cached[0], lng: cached[1] };
      resolved.set(label, point);
      onProgress?.(label, point);
      continue;
    }

    await reserveRequestSlot(signal);
    if (signal?.aborted) break;
    let point = await fetchFirstMatch(`${label}, ${dest}`, signal);

    if (!point && !signal?.aborted) {
      if (destPoint === undefined && dest) {
        const destKey = normalizeQuery(dest);
        const destCached = cache[destKey];
        if (destCached) {
          destPoint = { lat: destCached[0], lng: destCached[1] };
        } else {
          await reserveRequestSlot(signal);
          if (!signal?.aborted) {
            destPoint = await fetchFirstMatch(dest, signal);
            if (destPoint) {
              cache[destKey] = [destPoint.lat, destPoint.lng];
              writeCache(cache);
            }
          }
        }
      }
      point = destPoint ?? null;
    }

    if (point) {
      cache[key] = [point.lat, point.lng];
      writeCache(cache);
      resolved.set(label, point);
    }
    onProgress?.(label, point);
  }

  return resolved;
}
