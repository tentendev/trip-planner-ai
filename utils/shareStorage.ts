
import { GeneratedPlan, Language, TripInput, FlightOffer, HotelOffer, TravelSearchParams } from '../types';

const SHARE_STORAGE_KEY = 'trip_os_shared_plans';
const MAX_STORED_PLANS = 50;

// Lean summary of TripInput stored with the share so previews can render
// rich meta tags (title, description) without re-parsing markdown heavily.
export interface SharedPlanSummary {
  destination?: string;
  dates?: string;
  travelers?: string;
  budget?: string;
  pace?: string;
  interests?: string;
}

export interface SharedPlan {
  id: string;
  markdown: string;
  sources: Array<{ uri: string; title: string }>;
  lang: Language;
  createdAt: number;
  summary?: SharedPlanSummary;
  // Real-time travel data captured at generation time so shared views
  // render identical flight & hotel cards, not stale LLM text.
  flights?: FlightOffer[];
  hotels?: HotelOffer[];
  searchParams?: TravelSearchParams;
  flightPriceInsights?: {
    lowest?: number;
    typical_range?: number[];
    price_level?: string;
  };
}

// Generate a short, URL-safe ID
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- localStorage helpers (used as cache + fallback) ---

function getStoredPlans(): Record<string, SharedPlan> {
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function cleanupOldPlans(plans: Record<string, SharedPlan>): Record<string, SharedPlan> {
  const entries = Object.entries(plans);
  if (entries.length <= MAX_STORED_PLANS) return plans;
  const sorted = entries.sort((a, b) => b[1].createdAt - a[1].createdAt);
  return Object.fromEntries(sorted.slice(0, MAX_STORED_PLANS));
}

function saveToLocalStorage(plan: SharedPlan) {
  const plans = getStoredPlans();
  plans[plan.id] = plan;
  const cleaned = cleanupOldPlans(plans);
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(cleaned));
}

function getFromLocalStorage(id: string): SharedPlan | null {
  const plans = getStoredPlans();
  return plans[id] || null;
}

// --- API calls (primary storage via Vercel Blob) ---

async function saveToApi(plan: SharedPlan): Promise<boolean> {
  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getFromApi(id: string): Promise<SharedPlan | null> {
  try {
    const response = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.markdown) return data as SharedPlan;
    return null;
  } catch {
    return null;
  }
}

// --- Public API ---

// Save a plan and return its short ID.
// Saves to both API (persistent, cross-device) and localStorage (cache).
export async function saveSharedPlan(plan: GeneratedPlan, lang: Language, tripInput?: TripInput): Promise<{ id: string; synced: boolean }> {
  const id = generateShortId();
  const summary: SharedPlanSummary | undefined = tripInput
    ? {
        destination: tripInput.destination || undefined,
        dates: tripInput.dates || undefined,
        travelers: tripInput.travelers || undefined,
        budget: tripInput.budget || undefined,
        pace: tripInput.pace || undefined,
        interests: tripInput.interests || undefined,
      }
    : undefined;
  const sharedPlan: SharedPlan = {
    id,
    markdown: plan.markdown,
    sources: plan.sources || [],
    lang,
    createdAt: Date.now(),
    summary,
    flights: plan.flights,
    hotels: plan.hotels,
    searchParams: plan.searchParams,
    flightPriceInsights: plan.flightPriceInsights,
  };

  // Save to localStorage immediately (fast, works offline)
  saveToLocalStorage(sharedPlan);

  // Persist to the API and WAIT — the share URL is copied to the clipboard right
  // after this returns, and a not-yet-uploaded id produces a dead link for anyone
  // on another device. Falls back to local-only sharing if upload fails.
  let synced = false;
  try {
    await Promise.race([
      saveToApi(sharedPlan),
      new Promise((_, reject) => setTimeout(() => reject(new Error('share upload timeout')), 12_000)),
    ]);
    synced = true;
  } catch {
    console.warn('[shareStorage] cloud save failed — share link will only work on this device');
  }

  return { id, synced };
}

// Retrieve a shared plan by ID.
// Tries localStorage first (instant), then falls back to API.
export async function getSharedPlan(id: string): Promise<SharedPlan | null> {
  // 1. Check localStorage cache first
  const localPlan = getFromLocalStorage(id);
  if (localPlan) return localPlan;

  // 2. Fetch from API (cross-device case)
  const apiPlan = await getFromApi(id);
  if (apiPlan) {
    // Cache in localStorage for future access
    saveToLocalStorage(apiPlan);
    return apiPlan;
  }

  return null;
}

// Generate the share URL with just the short ID
export function generateShareUrl(id: string, lang: Language): string {
  const url = new URL(window.location.origin);
  url.searchParams.set('share', id);
  url.searchParams.set('lang', lang);
  return url.toString();
}
