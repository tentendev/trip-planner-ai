import { TripInput, Language, FlightOffer, HotelOffer, TravelSearchParams } from '../types';

export interface TravelData {
  params: TravelSearchParams;
  flights: FlightOffer[] | null;
  hotels: HotelOffer[] | null;
  flight_price_insights?: { lowest?: number; typical_range?: number[]; price_level?: string };
  currency: string;
  errors: string[];
}

/**
 * Map app language → SerpAPI hl (host language) code.
 */
function hlForLang(lang: Language): string {
  const map: Record<Language, string> = {
    'en': 'en',
    'zh-CN': 'zh-cn',
    'zh-TW': 'zh-tw',
    'ja': 'ja',
    'ko': 'ko',
    'hi': 'hi',
    'es': 'es',
    'fr': 'fr',
    'ar': 'ar',
    'pt': 'pt',
    'ru': 'ru',
  };
  return map[lang] || 'en';
}

/**
 * Map app language → default currency (travelers usually want their home currency).
 * This can be overridden per-call.
 */
function defaultCurrency(lang: Language): string {
  const map: Record<Language, string> = {
    'en': 'USD',
    'zh-CN': 'CNY',
    'zh-TW': 'TWD',
    'ja': 'JPY',
    'ko': 'KRW',
    'hi': 'INR',
    'es': 'EUR',
    'fr': 'EUR',
    'ar': 'USD',
    'pt': 'EUR',
    'ru': 'USD',
  };
  return map[lang] || 'USD';
}

/**
 * Ask an LLM to extract structured search params from free-text TripInput.
 * Uses temperature 0, JSON-only output.
 */
async function extractSearchParams(input: TripInput, lang: Language): Promise<TravelSearchParams | null> {
  const today = new Date().toISOString().slice(0, 10);

  const system = `You are a structured data extractor for a travel planning app. Given free-text trip input, you extract fields needed to call the Google Flights and Google Hotels APIs.

Rules:
- Today's date is ${today}. Interpret relative dates accordingly.
- IATA codes are 3-letter uppercase airport codes (e.g., TPE, NRT, HND, JFK, LHR, ICN, KIX, CDG, SIN, HKG, PEK, PVG, DXB, BKK, SFO, LAX).
- For cities with multiple airports, pick the primary international airport (e.g., Tokyo → NRT, Seoul → ICN, London → LHR, New York → JFK, Shanghai → PVG, Paris → CDG).
- If the user lists multiple destinations (e.g. "Tokyo + Kyoto"), use the FIRST/entry city as dest.
- dest_name: English name of destination city (for hotel search).
- Infer adults count from travelers text (e.g. "情侶" = 2, "家庭 4 人" = 2 adults + 2 children treated as 2 here, "solo" = 1).
- If origin city is not specified, return null for origin_iata (do NOT guess).
- Dates MUST be YYYY-MM-DD format.

Return ONLY a valid JSON object — no markdown fences, no commentary. Schema:
{
  "origin_iata": string | null,
  "dest_iata": string | null,
  "dest_name": string | null,
  "check_in": string | null,
  "check_out": string | null,
  "adults": number
}`;

  const user = `TripInput:
${JSON.stringify({
  destination: input.destination,
  arrivalDetail: input.arrivalDetail,
  departureDetail: input.departureDetail,
  dates: input.dates,
  travelers: input.travelers,
}, null, 2)}`;

  try {
    const controller = new AbortController();
    // Tight 12s budget — this is a tiny structured-extraction task, not a 4-minute itinerary.
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const resp = await fetch(`${origin}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        // Special alias — the proxy maps "fast" to a small/fast model per provider so a
        // slow OPENROUTER_MODEL doesn't make us wait 5 minutes just to parse IATA codes.
        model: 'fast',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn('[travelData] extraction API error', resp.status);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonStr = String(content).replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    // Be defensive: find the first { ... } block.
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    return {
      origin_iata: normalizeIATA(parsed.origin_iata),
      dest_iata: normalizeIATA(parsed.dest_iata),
      dest_name: parsed.dest_name || null,
      check_in: isValidDate(parsed.check_in) ? parsed.check_in : null,
      check_out: isValidDate(parsed.check_out) ? parsed.check_out : null,
      adults: Number.isFinite(parsed.adults) && parsed.adults > 0 ? Math.min(9, Math.floor(parsed.adults)) : 2,
    };
  } catch (err) {
    console.warn('[travelData] extraction failed', err);
    return null;
  }
}

function normalizeIATA(v: any): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null;
}

function isValidDate(s: any): boolean {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/**
 * Fetch real-time flight offers via /api/flights/search.
 */
async function fetchFlights(
  params: TravelSearchParams,
  lang: Language,
  currency: string,
  origin: string
): Promise<{ flights: FlightOffer[]; price_insights?: any } | null> {
  if (!params.origin_iata || !params.dest_iata || !params.check_in) return null;

  const q = new URLSearchParams({
    departure_id: params.origin_iata,
    arrival_id: params.dest_iata,
    outbound_date: params.check_in,
    adults: String(params.adults),
    currency,
    hl: hlForLang(lang),
  });
  if (params.check_out) q.set('return_date', params.check_out);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const resp = await fetch(`${origin}/api/flights/search?${q.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn('[travelData] /api/flights/search status', resp.status);
      return null;
    }
    const data = await resp.json();
    return { flights: data.flights || [], price_insights: data.price_insights };
  } catch (err) {
    console.warn('[travelData] flight fetch failed', err);
    return null;
  }
}

/**
 * Fetch real-time hotel offers via /api/hotels/search.
 */
async function fetchHotels(
  params: TravelSearchParams,
  lang: Language,
  currency: string,
  origin: string
): Promise<HotelOffer[] | null> {
  if (!params.dest_name || !params.check_in || !params.check_out) return null;

  const q = new URLSearchParams({
    q: `${params.dest_name} hotels`,
    check_in_date: params.check_in,
    check_out_date: params.check_out,
    adults: String(params.adults),
    currency,
    hl: hlForLang(lang),
    // No sort_by → Google's "Best" ranking (balances rating, price, popularity).
    // This gives the LLM a mix of budget / mid-range / luxury options to tier.
    rating: '8', // 4.0+ minimum — filters out hostels with <4 stars so results are usable
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const resp = await fetch(`${origin}/api/hotels/search?${q.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn('[travelData] /api/hotels/search status', resp.status);
      return null;
    }
    const data = await resp.json();
    return data.hotels || [];
  } catch (err) {
    console.warn('[travelData] hotel fetch failed', err);
    return null;
  }
}

// Overall hard deadline for SerpAPI gathering. If the LLM extraction or flight/hotel APIs
// hang, we'd rather generate the itinerary without real-time data than burn the whole
// 300s function budget here.
const TRAVEL_DATA_BUDGET_MS = 25_000;

/**
 * Orchestrate: extract params → call flights + hotels APIs in parallel → return aggregated data.
 * Never throws; returns null/partial data on timeout or failure.
 */
export async function gatherTravelData(input: TripInput, lang: Language): Promise<TravelData | null> {
  const t0 = Date.now();
  const result = await Promise.race([
    doGatherTravelData(input, lang),
    new Promise<null>((resolve) => setTimeout(() => {
      console.warn(`[travelData] overall ${TRAVEL_DATA_BUDGET_MS / 1000}s budget exceeded, skipping real-time data`);
      resolve(null);
    }, TRAVEL_DATA_BUDGET_MS)),
  ]);
  console.log('[travelData] gather complete', { ms: Date.now() - t0, hasResult: !!result });
  return result;
}

async function doGatherTravelData(input: TripInput, lang: Language): Promise<TravelData | null> {
  const params = await extractSearchParams(input, lang);
  if (!params) return null;

  const currency = defaultCurrency(lang);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const errors: string[] = [];

  const [flightRes, hotelRes] = await Promise.all([
    fetchFlights(params, lang, currency, origin).catch((e) => {
      errors.push(`flights: ${e?.message || e}`);
      return null;
    }),
    fetchHotels(params, lang, currency, origin).catch((e) => {
      errors.push(`hotels: ${e?.message || e}`);
      return null;
    }),
  ]);

  return {
    params,
    flights: flightRes?.flights || null,
    hotels: hotelRes || null,
    flight_price_insights: flightRes?.price_insights,
    currency,
    errors,
  };
}

/**
 * Format gathered travel data as a compact prompt-injection string.
 * Designed to be appended to the system instructions.
 */
/**
 * Compact prompt-injection string for timing-only info.
 *
 * The LLM now does NOT generate flight/hotel recommendation sections — those are rendered
 * as React cards above the itinerary. However, the LLM still needs to know the inbound/outbound
 * flight times to correctly schedule Day 1 arrival activities and Last Day departure logistics.
 *
 * This function returns ONLY the top-pick inbound + outbound flight times, plus a flag
 * telling the LLM to skip Sections 7 & 8.
 */
export function formatTravelDataForPrompt(data: TravelData | null): string {
  if (!data) return '';

  const sections: string[] = [];

  const top = data.flights?.[0];
  if (top && top.segments.length > 0) {
    const outboundFirst = top.segments[0];
    const outboundLast = top.segments[top.segments.length - 1];

    // For a round trip, SerpAPI round-trip offers include both directions across segments.
    // For a one-way, segments are only the outbound.
    // Find an inbound leg (departure from dest back to origin) if present.
    const destCode = data.params.dest_iata;
    const originCode = data.params.origin_iata;
    const returnLeg = top.segments.find(
      (s) => s.from_code === destCode && s.to_code === originCode
    );

    sections.push(`[REAL-TIME FLIGHT TIMING — use these exact times for Day 1 arrival & Last Day departure scheduling]`);
    sections.push(`Inbound arrival:  ${outboundLast.to_time} at ${outboundLast.to_code} (${outboundLast.airline} ${outboundLast.flight_number})`);
    if (returnLeg) {
      sections.push(`Outbound departure: ${returnLeg.from_time} from ${returnLeg.from_code} (${returnLeg.airline} ${returnLeg.flight_number})`);
    }
    sections.push(`Departure city IATA: ${outboundFirst.from_code} → Destination IATA: ${outboundLast.to_code}`);
  }

  if (data.hotels && data.hotels.length > 0) {
    sections.push(`\n[HOTEL DATA AVAILABLE — ${data.hotels.length} real hotels will be displayed as interactive cards above the itinerary]`);
  }

  sections.push(`\n[IMPORTANT OUTPUT INSTRUCTIONS]
1. DO NOT generate a "Flight Ticket Recommendations" section (Section 8). Real flight cards are rendered by the app UI.
2. DO NOT generate a "Hotel Recommendations" section (Section 7). Real hotel cards are rendered by the app UI.
3. In the Daily Itinerary, Day 1 MUST start AFTER the inbound arrival time + 90 min airport-to-hotel buffer. Last Day activities MUST end at least 3 hours before the outbound departure time.
4. In the Booking OS / budget sections, you may reference that flights & hotels are shown separately above the itinerary. Do not restate their details.`);

  return sections.join('\n');
}
