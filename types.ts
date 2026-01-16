
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
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface GeneratedPlan {
  markdown: string;
  sources: { title: string; uri: string }[];
}
