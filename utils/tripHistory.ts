
import { GeneratedPlan, Language } from '../types';

/**
 * Multi-trip history ("My Trips"). The app previously kept only the single most
 * recent plan (trip_os_v1_state) — planning a second trip erased the first.
 * Research flags a trips dashboard as table stakes (TripIt's three-level
 * navigation starts here).
 *
 * Storage discipline: plans carry heavy flight/hotel/weather payloads that are
 * stale the moment they're stored, so history entries keep only the markdown +
 * light summary (the display path reattaches live data on demand — flights and
 * hotels simply don't render for restored history entries).
 */

const HISTORY_KEY = 'trip_os_history_v1';
const MAX_TRIPS = 10;

export interface TripHistoryEntry {
  id: string;
  destination: string;
  dates: string;
  lang: Language;
  savedAt: number;
  markdown: string;
}

function loadAll(): TripHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(entries: TripHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Quota pressure: drop the heaviest half and retry once.
    try {
      const trimmed = [...entries]
        .sort((a, b) => b.savedAt - a.savedAt)
        .slice(0, Math.ceil(MAX_TRIPS / 2));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn('[tripHistory] storage unavailable — history not persisted');
    }
  }
}

/** Persist a generated plan into history (deduped by markdown, newest first, LRU-capped). */
export function saveTripToHistory(
  plan: GeneratedPlan,
  destination: string,
  dates: string,
  lang: Language
): void {
  if (!plan.markdown) return;
  const entries = loadAll().filter(e => e.markdown !== plan.markdown);
  entries.unshift({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    destination: destination || 'Trip',
    dates: dates || '',
    lang,
    savedAt: Date.now(),
    markdown: plan.markdown,
  });
  saveAll(entries.slice(0, MAX_TRIPS));
}

export function loadTripHistory(): TripHistoryEntry[] {
  return loadAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function deleteTripFromHistory(id: string): void {
  saveAll(loadAll().filter(e => e.id !== id));
}

/** Relative "2 days ago" style label, localized via Intl.RelativeTimeFormat. */
export function formatSavedAt(ts: number, language: Language): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    const diffDays = Math.round((ts - Date.now()) / 86_400_000);
    if (Math.abs(diffDays) < 1) {
      const diffHours = Math.round((ts - Date.now()) / 3_600_000);
      return rtf.format(Math.min(-1, diffHours), 'hour');
    }
    return rtf.format(diffDays, 'day');
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}
