
// ---------------------------------------------------------------------------
// Per-plan interactive state (activity check-offs, hidden rows, regen stamps)
//
// State is content-addressed: plans are keyed by an FNV-1a hash of their
// markdown, so any edit to the plan — including a scoped day regeneration —
// produces a new key and the tracker starts from a clean slate instead of
// pointing stale check-offs at activities that no longer exist. That reset is
// intentional: it is cheaper and more trustworthy than fuzzy-matching edited
// activity strings.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'trip_os_plan_states';
// Without a cap the store grows by one entry per generated plan forever; a
// small LRU-by-updatedAt window covers every plan a session could revisit.
const MAX_STORED_PLANS = 20;

export interface PlanActivityState {
  /** Exact activity strings (as emitted by parsePlanDays) marked done */
  checkedActivities: string[];
  /** Exact activity strings dismissed from the tracker */
  hiddenActivities: string[];
  /** dayNumber -> ISO timestamp of the last scoped regeneration */
  regeneratedDays: Record<number, string>;
  updatedAt: string;
}

export type PlanActivityStateDraft = Omit<PlanActivityState, 'updatedAt'>;

/**
 * FNV-1a 32-bit — the same tiny dependency-free hash family exportCalendar
 * uses for .ics UIDs. Hex-padded so keys stay fixed-width strings.
 */
export function hashPlanMarkdown(markdown: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < markdown.length; i++) {
    hash ^= markdown.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function emptyState(): PlanActivityState {
  return { checkedActivities: [], hiddenActivities: [], regeneratedDays: {}, updatedAt: '' };
}

// localStorage content is user-editable, so validate shape instead of casting
// blind — a hand-mangled entry must degrade to "fresh state", never throw.
function sanitizeState(value: unknown): PlanActivityState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Partial<PlanActivityState>;
  if (!Array.isArray(v.checkedActivities) || !Array.isArray(v.hiddenActivities)) return null;
  const strings = (arr: unknown[]) => arr.filter((x): x is string => typeof x === 'string');
  const regen: Record<number, string> = {};
  if (v.regeneratedDays && typeof v.regeneratedDays === 'object') {
    for (const [k, iso] of Object.entries(v.regeneratedDays)) {
      const day = Number(k);
      if (Number.isInteger(day) && day > 0 && typeof iso === 'string') regen[day] = iso;
    }
  }
  return {
    checkedActivities: strings(v.checkedActivities),
    hiddenActivities: strings(v.hiddenActivities),
    regeneratedDays: regen,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
  };
}

function readStore(): Record<string, PlanActivityState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const store: Record<string, PlanActivityState> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const clean = sanitizeState(value);
      if (clean) store[key] = clean;
    }
    return store;
  } catch {
    // Private mode / disabled storage / corrupt JSON all mean "no memory",
    // which is a valid way to run the tracker.
    return {};
  }
}

function writeStore(store: Record<string, PlanActivityState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage blocked — persistence is best-effort; the
    // in-memory component state keeps working for the current view.
  }
}

/** State for this exact markdown, or empty defaults when nothing is stored. */
export function loadPlanState(markdown: string): PlanActivityState {
  try {
    const found = readStore()[hashPlanMarkdown(markdown)];
    if (found) return found;
  } catch {
    // fall through to defaults
  }
  return emptyState();
}

/** Merge-and-persist a draft, stamping updatedAt. Best-effort, never throws. */
export function savePlanState(markdown: string, draft: PlanActivityStateDraft): void {
  try {
    const store = readStore();
    const entry: PlanActivityState = {
      checkedActivities: [...draft.checkedActivities],
      hiddenActivities: [...draft.hiddenActivities],
      regeneratedDays: { ...draft.regeneratedDays },
      updatedAt: new Date().toISOString(),
    };
    store[hashPlanMarkdown(markdown)] = entry;

    const keys = Object.keys(store);
    if (keys.length > MAX_STORED_PLANS) {
      // Newest first; evict from the tail.
      keys.sort(
        (a, b) =>
          (Date.parse(store[b]?.updatedAt || '') || 0) - (Date.parse(store[a]?.updatedAt || '') || 0),
      );
      for (const stale of keys.slice(MAX_STORED_PLANS)) delete store[stale];
    }
    writeStore(store);
  } catch {
    // Never let persistence trouble the interaction.
  }
}

/** Wipe every plan's tracker state (used by tests / "reset all" affordances). */
export function clearPlanStates(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage refuses.
  }
}
