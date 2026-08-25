// Per-trip expense ledger persisted in localStorage under 'trip_os_budget_v1'.
// All access is guarded — private-mode browsers, quota errors and corrupted JSON
// degrade to an in-memory ledger instead of crashing the itinerary page.

export const BUDGET_STORAGE_KEY = 'trip_os_budget_v1';

export type ExpenseCategory =
  | 'lodging'
  | 'transport'
  | 'food'
  | 'tickets'
  | 'shopping'
  | 'other';

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'lodging',
  'transport',
  'food',
  'tickets',
  'shopping',
  'other',
];

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'TWD', 'KRW', 'CNY', 'INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const DEFAULT_CURRENCY: SupportedCurrency = 'USD';
const MAX_EXPENSES_PER_TRIP = 500;
const MAX_TRIPS = 60; // oldest-updated ledgers are evicted to bound storage size

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  dateISO?: string; // YYYY-MM-DD
}

export interface BudgetLedger {
  totalBudget: number | null;
  currency: string; // ISO 4217 code
  expenses: Expense[]; // newest first (prepended on add)
  updatedAt: number;
}

export interface BudgetSummary {
  spent: number;
  /** null when no total budget is set */
  remaining: number | null;
  perCategory: Record<ExpenseCategory, number>;
  count: number;
}

interface BudgetStore {
  trips: Record<string, BudgetLedger>;
}

// --- Trip key -----------------------------------------------------------------

// 32-bit FNV-1a, hex-encoded. Short, dependency-free, stable across sessions.
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Stable key for a trip derived from destination + dates. Case/whitespace
 * insensitive so "Tokyo" and " tokyo " land on the same ledger.
 */
export function deriveTripKey(destination: string, dates: string): string {
  const norm = `${(destination || '').trim().toLowerCase()}|${(dates || '').trim().toLowerCase()}`;
  return `t${fnv1a(norm)}`;
}

// --- Free-text budget parsing ---------------------------------------------------

/**
 * Extracts the first plausible monetary amount from free text such as
 * "Total 2,000 USD", "~€1.5k", "20000円". Handles thousands separators
 * (comma, space, NBSP) and optional decimals. Returns null when no amount
 * is present.
 */
export function parseLeadingAmount(text?: string | null): number | null {
  if (!text) return null;
  const normalized = text.replace(/[\u00A0\u202F ]/g, " "); // normalize NBSP / narrow-NBSP thousand seps
  const match = normalized.match(
    /(\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/,
  );
  if (!match) return null;
  // Drop thousands separators ("2,000" / "2.000" -> 2000), then normalize the decimal mark.
  let cleaned = match[1].replace(/[ .,](?=\d{3}(\D|$))/g, '');
  cleaned = cleaned.replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Best-effort currency detection from free budget text ("Total 2,000 USD",
 * "NT$30,000", "£800"). Explicit codes win, then symbols with disambiguation
 * (NT$ -> TWD, bare ¥ -> JPY). Returns null when undetectable.
 */
export function detectCurrency(text?: string | null): SupportedCurrency | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/nt\s*\$|twd|新台幣|新臺幣/.test(t)) return 'TWD';
  if (/\busd\b|us\s*\$|美元/.test(t)) return 'USD';
  if (/\beur\b|欧元|歐元/.test(t)) return 'EUR';
  if (/\bgbp\b|英镑|英鎊/.test(t)) return 'GBP';
  if (/\bjpy\b|日元|日圓|円/.test(t)) return 'JPY';
  if (/\bkrw\b|韩元|韓元|원/.test(t)) return 'KRW';
  if (/\bcny\b|\brmb\b|人民币|人民幣/.test(t)) return 'CNY';
  if (/\binr\b|卢比|盧比|रुपया|रु/.test(t)) return 'INR';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('₩')) return 'KRW';
  if (text.includes('₹')) return 'INR';
  if (text.includes('¥')) return 'JPY';
  if (text.includes('$')) return 'USD';
  return null;
}

// --- Persistence ---------------------------------------------------------------

function emptyLedger(): BudgetLedger {
  return { totalBudget: null, currency: DEFAULT_CURRENCY, expenses: [], updatedAt: Date.now() };
}

/** Validates an unknown parsed value into a safe BudgetLedger. */
function sanitizeLedger(raw: unknown): BudgetLedger {
  if (!raw || typeof raw !== 'object') return emptyLedger();
  const r = raw as Partial<BudgetLedger>;
  const totalBudget =
    typeof r.totalBudget === 'number' && Number.isFinite(r.totalBudget) && r.totalBudget >= 0
      ? r.totalBudget
      : null;
  const currency =
    typeof r.currency === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(r.currency)
      ? r.currency
      : DEFAULT_CURRENCY;
  const expenses: Expense[] = Array.isArray(r.expenses)
    ? r.expenses.flatMap((e): Expense[] => {
        if (!e || typeof e !== 'object') return [];
        const ex = e as Partial<Expense>;
        if (typeof ex.id !== 'string' || !ex.id) return [];
        if (typeof ex.amount !== 'number' || !Number.isFinite(ex.amount) || ex.amount <= 0) return [];
        const category: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(
          ex.category as string,
        )
          ? (ex.category as ExpenseCategory)
          : 'other';
        return [
          {
            id: ex.id,
            amount: ex.amount,
            category,
            ...(typeof ex.note === 'string' && ex.note ? { note: ex.note } : {}),
            ...(typeof ex.dateISO === 'string' && ex.dateISO ? { dateISO: ex.dateISO } : {}),
          },
        ];
      })
    : [];
  return {
    totalBudget,
    currency,
    expenses,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
  };
}

function readStore(): BudgetStore {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return { trips: {} };
    const raw = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return { trips: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !(parsed as BudgetStore).trips) return { trips: {} };
    return parsed as BudgetStore;
  } catch {
    return { trips: {} };
  }
}

function writeStore(store: BudgetStore): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    // Evict least-recently-updated trips to keep the payload bounded.
    const entries = Object.entries(store.trips)
      .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
      .slice(0, MAX_TRIPS);
    window.localStorage.setItem(
      BUDGET_STORAGE_KEY,
      JSON.stringify({ trips: Object.fromEntries(entries) }),
    );
  } catch {
    // Storage full or blocked — the caller's in-memory state remains usable.
  }
}

/** Loads the ledger for a trip, or a fresh empty one. Never throws. */
export function load(tripKey: string): BudgetLedger {
  try {
    const found = readStore().trips[tripKey];
    return found ? sanitizeLedger(found) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

/** Persists a ledger for a trip. Never throws. */
export function save(tripKey: string, ledger: BudgetLedger): void {
  try {
    const store = readStore();
    store.trips[tripKey] = { ...ledger, updatedAt: Date.now() };
    writeStore(store);
  } catch {
    /* ignore */
  }
}

function makeId(): string {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeAmount(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export interface NewExpenseInput {
  amount: number;
  category: ExpenseCategory;
  note?: string;
  dateISO?: string;
}

/** Adds an expense (prepended, so the list renders recent-first) and persists. */
export function addExpense(tripKey: string, ledger: BudgetLedger, input: NewExpenseInput): BudgetLedger {
  const amount = sanitizeAmount(input.amount);
  if (amount <= 0) return ledger;
  const expense: Expense = {
    id: makeId(),
    amount,
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(input.category)
      ? input.category
      : 'other',
    ...(input.note && input.note.trim() ? { note: input.note.trim().slice(0, 120) } : {}),
    ...(input.dateISO ? { dateISO: input.dateISO } : {}),
  };
  const next: BudgetLedger = {
    ...ledger,
    expenses: [expense, ...ledger.expenses].slice(0, MAX_EXPENSES_PER_TRIP),
    updatedAt: Date.now(),
  };
  save(tripKey, next);
  return next;
}

/** Removes an expense by id and persists. */
export function removeExpense(tripKey: string, ledger: BudgetLedger, id: string): BudgetLedger {
  const next: BudgetLedger = {
    ...ledger,
    expenses: ledger.expenses.filter((e) => e.id !== id),
    updatedAt: Date.now(),
  };
  save(tripKey, next);
  return next;
}

/** Sets (or clears with null) the total budget, optionally switching currency. */
export function setTotalBudget(
  tripKey: string,
  ledger: BudgetLedger,
  total: number | null,
  currency?: string,
): BudgetLedger {
  const next: BudgetLedger = {
    ...ledger,
    totalBudget: total !== null && Number.isFinite(total) && total >= 0 ? total : null,
    ...(currency && (SUPPORTED_CURRENCIES as readonly string[]).includes(currency)
      ? { currency }
      : {}),
    updatedAt: Date.now(),
  };
  save(tripKey, next);
  return next;
}

/** Switches the display currency and persists. */
export function setCurrency(tripKey: string, ledger: BudgetLedger, currency: string): BudgetLedger {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) return ledger;
  const next: BudgetLedger = { ...ledger, currency, updatedAt: Date.now() };
  save(tripKey, next);
  return next;
}

/** Wipes the ledger for a trip (fresh empty state) and persists. */
export function clear(tripKey: string): BudgetLedger {
  const fresh = emptyLedger();
  save(tripKey, fresh);
  return fresh;
}

/** Aggregates spent / remaining / per-category totals. Pure, never throws. */
export function summarize(ledger: BudgetLedger): BudgetSummary {
  const perCategory: Record<ExpenseCategory, number> = {
    lodging: 0,
    transport: 0,
    food: 0,
    tickets: 0,
    shopping: 0,
    other: 0,
  };
  let spent = 0;
  let count = 0;
  for (const e of ledger.expenses || []) {
    const amt = typeof e?.amount === 'number' && Number.isFinite(e.amount) ? e.amount : 0;
    if (amt <= 0) continue;
    spent += amt;
    count += 1;
    const cat: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(e.category)
      ? e.category
      : 'other';
    perCategory[cat] += amt;
  }
  // Avoid float dust like 1999.9999999999998 in the UI.
  spent = Math.round(spent * 100) / 100;
  for (const k of Object.keys(perCategory) as ExpenseCategory[]) {
    perCategory[k] = Math.round(perCategory[k] * 100) / 100;
  }
  const remaining =
    ledger.totalBudget !== null && Number.isFinite(ledger.totalBudget)
      ? Math.round((ledger.totalBudget - spent) * 100) / 100
      : null;
  return { spent, remaining, perCategory, count };
}
