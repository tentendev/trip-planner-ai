
export type Language =
  | 'en'      // English
  | 'zh-CN'   // Simplified Chinese
  | 'zh-TW'   // Traditional Chinese
  | 'ja'      // Japanese
  | 'ko'      // Korean
  | 'hi'      // Hindi
  | 'es'      // Spanish
  | 'fr'      // French
  | 'ar'      // Arabic
  | 'pt'      // Portuguese
  | 'ru';     // Russian

export interface TripInput {
  destination: string;
  arrivalDetail: string;
  departureDetail: string;
  dates: string;
  travelers: string;
  budget: string;
  pace: string;
  interests: string;
  mustDos: string;
  constraints: string;
  accommodation: string;
  transportPref: string;
  diet: string;
  work: string;
  bookings: string;
  other: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  PRE_ANALYZING = 'PRE_ANALYZING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface PreAnalysisQuestion {
  id: string;
  question: string;
  options: string[];
  selected: string[];
  allowMultiple: boolean;
}

// --- Real-time travel data structures (from SerpAPI) ---

export interface FlightSegment {
  airline: string;
  airline_logo?: string;
  flight_number: string;
  from_code: string;
  from_name: string;
  from_time: string;   // "YYYY-MM-DD HH:mm"
  to_code: string;
  to_name: string;
  to_time: string;
  duration_min: number;
  travel_class: string;
}

export interface FlightLayover {
  airport: string;
  duration_min: number;
  overnight: boolean;
}

export interface FlightOffer {
  rank: number;
  price: number;
  currency: string;
  duration_min: number;
  stops: number;
  airlines: string[];
  airline_logo?: string;
  segments: FlightSegment[];
  layovers: FlightLayover[];
  carbon_kg?: number;
  type?: string;       // "One way" | "Round trip"
}

export interface HotelNearby {
  name: string;
  walk?: string;
  transit?: string;
}

export interface HotelOffer {
  rank: number;
  name: string;
  type?: string;
  rating?: number;
  reviews?: number;
  price_per_night?: number;
  price_per_night_display?: string;
  total_price?: number;
  total_price_display?: string;
  currency: string;
  link?: string;
  thumbnail?: string;
  check_in_time?: string;
  check_out_time?: string;
  amenities: string[];
  nearby: HotelNearby[];
  gps?: { latitude: number; longitude: number };
  hotel_class?: string;
  description?: string;
}

export interface TravelSearchParams {
  origin_iata: string | null;
  dest_iata: string | null;
  dest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number;
}

export interface GeneratedPlan {
  markdown: string;
  sources: { title: string; uri: string }[];
  flights?: FlightOffer[];
  hotels?: HotelOffer[];
  searchParams?: TravelSearchParams;
  flightPriceInsights?: {
    lowest?: number;
    typical_range?: number[];
    price_level?: string;
  };
}
