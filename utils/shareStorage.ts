
import { GeneratedPlan, Language } from '../types';

const SHARE_STORAGE_KEY = 'trip_os_shared_plans';
const MAX_STORED_PLANS = 50; // Limit to prevent localStorage bloat

export interface SharedPlan {
  id: string;
  markdown: string;
  sources: Array<{ uri: string; title: string }>;
  lang: Language;
  createdAt: number;
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

// Get all stored shared plans
function getStoredPlans(): Record<string, SharedPlan> {
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Clean up old plans if we exceed the limit
function cleanupOldPlans(plans: Record<string, SharedPlan>): Record<string, SharedPlan> {
  const entries = Object.entries(plans);
  if (entries.length <= MAX_STORED_PLANS) return plans;

  // Sort by creation time and keep only the newest
  const sorted = entries.sort((a, b) => b[1].createdAt - a[1].createdAt);
  const kept = sorted.slice(0, MAX_STORED_PLANS);
  return Object.fromEntries(kept);
}

// Save a plan and return its short ID
export function saveSharedPlan(plan: GeneratedPlan, lang: Language): string {
  const id = generateShortId();
  const sharedPlan: SharedPlan = {
    id,
    markdown: plan.markdown,
    sources: plan.sources || [],
    lang,
    createdAt: Date.now()
  };

  const plans = getStoredPlans();
  plans[id] = sharedPlan;

  const cleanedPlans = cleanupOldPlans(plans);
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(cleanedPlans));

  return id;
}

// Retrieve a shared plan by ID
export function getSharedPlan(id: string): SharedPlan | null {
  const plans = getStoredPlans();
  return plans[id] || null;
}

// Generate the share URL with just the short ID
export function generateShareUrl(id: string, lang: Language): string {
  const url = new URL(window.location.origin);
  url.searchParams.set('share', id);
  url.searchParams.set('lang', lang);
  return url.toString();
}
