import { isAllowedOrigin, clientIp, checkRateLimit, validators } from '../../lib/apiGuard';

export const config = {
  runtime: 'nodejs',
};

/**
 * Thin SerpAPI google_flights wrapper.
 *
 * Query params:
 *   - departure_id: IATA code (e.g. "TPE") — required
 *   - arrival_id: IATA code (e.g. "NRT") — required
 *   - outbound_date: YYYY-MM-DD — required
 *   - return_date: YYYY-MM-DD — optional (round trip if present)
 *   - adults: number — default 1
 *   - currency: 3-letter code — default "TWD"
 *   - hl: language code — default "en"
 *   - travel_class: 1=Economy, 2=Premium, 3=Business, 4=First — default 1
 *
 * Returns a slimmed top-5 list suitable for LLM prompt injection.
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
    departure_id,
    arrival_id,
    outbound_date,
    return_date,
    adults = '1',
    currency = 'TWD',
    hl = 'en',
    travel_class = '1',
  } = req.query;

  if (!validators.iata(departure_id) || !validators.iata(arrival_id) || !validators.date(outbound_date)) {
    return res.status(400).json({
      error: 'Invalid params: need departure_id/arrival_id as IATA codes and outbound_date as YYYY-MM-DD',
      code: 'BAD_REQUEST',
    });
  }
  if (return_date && !validators.date(return_date)) {
    return res.status(400).json({ error: 'return_date must be YYYY-MM-DD', code: 'BAD_REQUEST' });
  }
  if (!validators.intInRange(adults, 1, 9) || !validators.currency(currency) || !validators.hl(hl) || !validators.intInRange(travel_class, 1, 4)) {
    return res.status(400).json({ error: 'Param out of range', code: 'BAD_REQUEST' });
  }

  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: apiKey,
    departure_id: String(departure_id),
    arrival_id: String(arrival_id),
    outbound_date: String(outbound_date),
    type: return_date ? '1' : '2',
    adults: String(adults),
    currency: String(currency),
    hl: String(hl),
    travel_class: String(travel_class),
  });
  if (return_date) params.set('return_date', String(return_date));

  try {
    const serpResp = await fetch(`https://serpapi.com/search?${params.toString()}`, {
      headers: { 'User-Agent': 'TripOS/1.0' },
    });

    if (!serpResp.ok) {
      const text = await serpResp.text();
      console.error('[flights] SerpAPI error', serpResp.status, text.slice(0, 300));
      return res.status(502).json({ error: 'Upstream SerpAPI error', status: serpResp.status });
    }

    const data: any = await serpResp.json();

    const pick = [...(data.best_flights || []), ...(data.other_flights || [])].slice(0, 5);
    const flights = pick.map((f: any, idx: number) => ({
      rank: idx + 1,
      price: f.price,
      currency: String(currency).toUpperCase(),
      duration_min: f.total_duration,
      stops: (f.layovers?.length || 0),
      airlines: (f.flights || []).map((leg: any) => leg.airline).filter(Boolean),
      airline_logo: f.airline_logo,
      segments: (f.flights || []).map((leg: any) => ({
        airline: leg.airline,
        airline_logo: leg.airline_logo,
        flight_number: leg.flight_number,
        from_code: leg.departure_airport?.id,
        from_name: leg.departure_airport?.name,
        from_time: leg.departure_airport?.time,
        to_code: leg.arrival_airport?.id,
        to_name: leg.arrival_airport?.name,
        to_time: leg.arrival_airport?.time,
        duration_min: leg.duration,
        travel_class: leg.travel_class,
      })),
      layovers: (f.layovers || []).map((l: any) => ({
        airport: l.id || l.name,
        duration_min: l.duration,
        overnight: !!l.overnight,
      })),
      carbon_kg: f.carbon_emissions?.this_flight ? Math.round(f.carbon_emissions.this_flight / 1000) : undefined,
      type: f.type,
    }));

    const price_insights = data.price_insights
      ? {
          lowest: data.price_insights.lowest_price,
          typical_range: data.price_insights.typical_price_range,
          price_level: data.price_insights.price_level,
        }
      : undefined;

    // Cache 15 min at edge, stale-while-revalidate 1h.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      flights,
      price_insights,
      currency: String(currency).toUpperCase(),
      search_url: data.search_metadata?.google_flights_url,
    });
  } catch (err: any) {
    console.error('[flights] handler error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
