/**
 * Shared guards for API routes. Lives outside api/ so it is never exposed as a
 * serverless route itself.
 *
 * These endpoints proxy PAID upstream services (SerpAPI) or public writes (Blob),
 * so every route applies the same three protections:
 *   1) same-origin enforcement (browsers send Origin on cross-origin requests)
 *   2) strict parameter validation
 *   3) per-instance sliding-window rate limiting
 *
 * Note: serverless instances are ephemeral, so the rate limiter is a speed bump,
 * not a hard quota. For real DDoS protection pair with Vercel Firewall rules.
 */

export const RATE_WINDOW_MS = 60_000;

const rateBuckets = new Map<string, { timestamps: number[] }>();

function getAllowedOrigins(reqHost: string | null): string[] {
  const list: string[] = [];
  if (reqHost) list.push(`https://${reqHost}`);
  const extra = process.env.ALLOWED_ORIGINS?.trim();
  if (extra) list.push(...extra.split(',').map(s => s.trim()).filter(Boolean));
  return list;
}

export function isAllowedOrigin(originHeader: string | undefined, reqHost: string | null): boolean {
  if (!originHeader) return true; // same-origin fetches may omit Origin
  let originHost: string | null = null;
  try {
    originHost = new URL(originHeader).host;
  } catch {
    return false;
  }
  if (!originHost) return false;
  if (reqHost && originHost === reqHost) return true;
  return getAllowedOrigins(reqHost).some(a => {
    try {
      return new URL(a).host === originHost;
    } catch {
      return a === originHeader;
    }
  });
}

export function clientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || 'unknown';
}

export function checkRateLimit(ip: string, limit: number): boolean {
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

// --- Parameter validators ----------------------------------------------------

const RE_IATA = /^[A-Z]{3}$/;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_CURRENCY = /^[A-Za-z]{3}$/;
const RE_HL = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/;
const RE_SHARE_ID = /^[A-Za-z0-9_-]{8,32}$/;

export const validators = {
  iata: (v: unknown): v is string => typeof v === 'string' && RE_IATA.test(v.toUpperCase()) && v.length === 3,
  date: (v: unknown): v is string => typeof v === 'string' && RE_DATE.test(v) && !isNaN(new Date(v).getTime()),
  currency: (v: unknown): v is string => typeof v === 'string' && RE_CURRENCY.test(v),
  hl: (v: unknown): v is string => typeof v === 'string' && RE_HL.test(v),
  shareId: (v: unknown): v is string => typeof v === 'string' && RE_SHARE_ID.test(v),
  intInRange: (v: unknown, min: number, max: number): boolean => {
    const n = Number(v);
    return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max;
  },
};
