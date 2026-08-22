import { isAllowedOrigin, clientIp, checkRateLimit, validators } from '../../lib/apiGuard';

export const config = {
  runtime: 'nodejs',
};

/**
 * Thin SerpAPI google_hotels wrapper.
 *
 * Query params:
 *   - q: destination query string (e.g. "Tokyo hotels") — required
 *   - check_in_date: YYYY-MM-DD — required
 *   - check_out_date: YYYY-MM-DD — required
 *   - adults: number — default 2
 *   - currency: 3-letter code — default "TWD"
 *   - hl: language code — default "en"
 *   - sort_by: "3"=lowest price | "8"=highest rating | "13"=most reviewed — default "3"
 *   - min_price / max_price: optional filter
 *   - rating: "7"=3.5+ | "8"=4.0+ | "9"=4.5+ — optional
 *
 * Returns a slimmed top-6 list suitable for LLM prompt injection.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAllowedOrigin(req.headers?.origin, req.headers?.host || null)) {
    return res.status(403).json({ error: 'Forbidden origin', code: 'FORBIDDEN_ORIGIN' });
  }
  if (!checkRateLimit(clientIp(req), Number(process.env.RATE_LIMIT_SERP_RPM || 20))) {
    return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SERPAPI_KEY not configured' });
  }

  const {
    q,
    check_in_date,
    check_out_date,
    adults = '2',
    currency = 'TWD',
    hl = 'en',
    sort_by,
    min_price,
    max_price,
    rating,
  } = req.query;

  if (
    typeof q !== 'string' ||
    q.trim().length === 0 ||
    q.length > 120 ||
    !validators.date(check_in_date) ||
    !validators.date(check_out_date)
  ) {
    return res.status(400).json({
      error: 'Invalid params: need q (≤120 chars), check_in_date and check_out_date as YYYY-MM-DD',
      code: 'BAD_REQUEST',
    });
  }
  if (!validators.intInRange(adults, 1, 9) || !validators.currency(currency) || !validators.hl(hl)) {
    return res.status(400).json({ error: 'Param out of range', code: 'BAD_REQUEST' });
  }
  for (const opt of [sort_by, min_price, max_price, rating]) {
    if (opt !== undefined && !validators.intInRange(opt, 1, 9999)) {
      return res.status(400).json({ error: 'Filter param out of range', code: 'BAD_REQUEST' });
    }
  }

  const params = new URLSearchParams({
    engine: 'google_hotels',
    api_key: apiKey,
    q: String(q),
    check_in_date: String(check_in_date),
    check_out_date: String(check_out_date),
    adults: String(adults),
    currency: String(currency),
    hl: String(hl),
  });
  if (sort_by) params.set('sort_by', String(sort_by));
  if (min_price) params.set('min_price', String(min_price));
  if (max_price) params.set('max_price', String(max_price));
  if (rating) params.set('rating', String(rating));

  try {
    const serpResp = await fetch(`https://serpapi.com/search?${params.toString()}`, {
      headers: { 'User-Agent': 'TripOS/1.0' },
    });

    if (!serpResp.ok) {
      const text = await serpResp.text();
      console.error('[hotels] SerpAPI error', serpResp.status, text.slice(0, 300));
      return res.status(502).json({ error: 'Upstream SerpAPI error', status: serpResp.status });
    }

    const data: any = await serpResp.json();

    // Keep top 8 — LLM needs enough variety for budget/mid/luxury tiers.
    const hotels = (data.properties || []).slice(0, 8).map((h: any, idx: number) => ({
      rank: idx + 1,
      name: h.name,
      type: h.type,
      rating: h.overall_rating,
      reviews: h.reviews,
      price_per_night: h.rate_per_night?.extracted_lowest,
      price_per_night_display: h.rate_per_night?.lowest,
      total_price: h.total_rate?.extracted_lowest,
      total_price_display: h.total_rate?.lowest,
      currency: String(currency).toUpperCase(),
      link: h.link,
      thumbnail: h.images?.[0]?.thumbnail || h.thumbnail,
      check_in_time: h.check_in_time,
      check_out_time: h.check_out_time,
      amenities: (h.amenities || []).slice(0, 8),
      nearby: (h.nearby_places || []).slice(0, 3).map((p: any) => ({
        name: p.name,
        walk: p.transportations?.find((t: any) => t.type === 'Walking')?.duration,
        transit: p.transportations?.find((t: any) => t.type === 'Public transport')?.duration,
      })),
      gps: h.gps_coordinates,
      hotel_class: h.hotel_class,
      description: h.description?.slice(0, 200),
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      hotels,
      currency: String(currency).toUpperCase(),
      total_results: data.properties?.length || 0,
    });
  } catch (err: any) {
    console.error('[hotels] handler error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
