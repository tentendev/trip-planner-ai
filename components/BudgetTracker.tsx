
import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import { Language } from '../types';
import {
  BudgetLedger,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  load,
  addExpense,
  removeExpense,
  setTotalBudget,
  setCurrency,
  summarize,
  parseLeadingAmount,
  detectCurrency,
} from '../utils/budgetState';

interface BudgetTrackerProps {
  /** Stable per-trip id — use deriveTripKey(destination, dates). */
  tripKey: string;
  /** Free-text budget from tripInput.budget, e.g. "Total 2,000 USD"; parsed once to prefill. */
  initialBudget?: string;
  language: Language;
}

// --- Localized copy -------------------------------------------------------------

interface BudgetCopy {
  title: string;
  subtitle: string;
  totalBudget: string;
  spent: string;
  remaining: string;
  overBy: string;
  noBudgetHint: string;
  amount: string;
  note: string;
  category: string;
  add: string;
  currency: string;
  deleteExpense: string;
  emptyTitle: string;
  emptyBody: string;
  catLodging: string;
  catTransport: string;
  catFood: string;
  catTickets: string;
  catShopping: string;
  catOther: string;
}

const COPY: Record<Language, BudgetCopy> = {
  en: {
    title: 'Trip budget',
    subtitle: 'Track spending as you book and go',
    totalBudget: 'Total budget',
    spent: 'Spent',
    remaining: 'left',
    overBy: 'over budget',
    noBudgetHint: 'Set a budget to see what is left',
    amount: 'Amount',
    note: 'Note (optional)',
    category: 'Category',
    add: 'Add',
    currency: 'Currency',
    deleteExpense: 'Delete expense',
    emptyTitle: 'No expenses yet',
    emptyBody: 'Log your first expense below to see spending against your plan.',
    catLodging: 'Lodging', catTransport: 'Transport', catFood: 'Food',
    catTickets: 'Tickets', catShopping: 'Shopping', catOther: 'Other',
  },
  'zh-TW': {
    title: '旅程預算',
    subtitle: '隨時記錄花費，掌握預算',
    totalBudget: '總預算',
    spent: '已花費',
    remaining: '剩餘',
    overBy: '已超出預算',
    noBudgetHint: '設定預算即可查看剩餘額度',
    amount: '金額',
    note: '備註（選填）',
    category: '分類',
    add: '新增',
    currency: '貨幣',
    deleteExpense: '刪除支出',
    emptyTitle: '還沒有任何支出',
    emptyBody: '在下方記錄第一筆支出，即可對照行程掌握花費。',
    catLodging: '住宿', catTransport: '交通', catFood: '餐飲',
    catTickets: '門票', catShopping: '購物', catOther: '其他',
  },
  'zh-CN': {
    title: '旅行预算',
    subtitle: '随时记录花费，掌控预算',
    totalBudget: '总预算',
    spent: '已花费',
    remaining: '剩余',
    overBy: '已超出预算',
    noBudgetHint: '设置预算即可查看剩余额度',
    amount: '金额',
    note: '备注（可选）',
    category: '分类',
    add: '添加',
    currency: '货币',
    deleteExpense: '删除支出',
    emptyTitle: '还没有任何支出',
    emptyBody: '在下方记录第一笔支出，对照行程掌握花费。',
    catLodging: '住宿', catTransport: '交通', catFood: '餐饮',
    catTickets: '门票', catShopping: '购物', catOther: '其他',
  },
  ja: {
    title: '旅の予算',
    subtitle: '支出を記録して予算を管理',
    totalBudget: '総予算',
    spent: '使った金額',
    remaining: '残り',
    overBy: '予算超過',
    noBudgetHint: '予算を設定すると残りが表示されます',
    amount: '金額',
    note: 'メモ（任意）',
    category: 'カテゴリ',
    add: '追加',
    currency: '通貨',
    deleteExpense: '支出を削除',
    emptyTitle: 'まだ支出がありません',
    emptyBody: '最初の支出を追加すると、予定に対する使い方がひと目でわかります。',
    catLodging: '宿泊', catTransport: '交通', catFood: '食事',
    catTickets: 'チケット', catShopping: '買い物', catOther: 'その他',
  },
  ko: {
    title: '여행 예산',
    subtitle: '지출을 기록하고 예산을 관리하세요',
    totalBudget: '총 예산',
    spent: '지출',
    remaining: '남음',
    overBy: '예산 초과',
    noBudgetHint: '예산을 설정하면 남은 금액이 표시됩니다',
    amount: '금액',
    note: '메모 (선택)',
    category: '분류',
    add: '추가',
    currency: '통화',
    deleteExpense: '지출 삭제',
    emptyTitle: '아직 지출이 없어요',
    emptyBody: '첫 지출을 기록하면 계획 대비 지출을 한눈에 볼 수 있어요.',
    catLodging: '숙박', catTransport: '교통', catFood: '식사',
    catTickets: '입장권', catShopping: '쇼핑', catOther: '기타',
  },
  hi: {
    title: 'यात्रा बजट',
    subtitle: 'खर्च दर्ज करें और बजट पर नज़र रखें',
    totalBudget: 'कुल बजट',
    spent: 'खर्च',
    remaining: 'शेष',
    overBy: 'बजट से अधिक',
    noBudgetHint: 'बची राशि देखने के लिए बजट सेट करें',
    amount: 'राशि',
    note: 'नोट (वैकल्पिक)',
    category: 'श्रेणी',
    add: 'जोड़ें',
    currency: 'मुद्रा',
    deleteExpense: 'खर्च हटाएं',
    emptyTitle: 'अभी कोई खर्च नहीं',
    emptyBody: 'योजना के मुक़ाबले खर्च देखने के लिए पहला खर्च दर्ज करें।',
    catLodging: 'ठहरना', catTransport: 'परिवहन', catFood: 'भोजन',
    catTickets: 'टिकट', catShopping: 'खरीदारी', catOther: 'अन्य',
  },
  es: {
    title: 'Presupuesto del viaje',
    subtitle: 'Registra gastos y controla tu presupuesto',
    totalBudget: 'Presupuesto total',
    spent: 'Gastado',
    remaining: 'restante',
    overBy: 'por encima del presupuesto',
    noBudgetHint: 'Fija un presupuesto para ver lo que queda',
    amount: 'Importe',
    note: 'Nota (opcional)',
    category: 'Categoría',
    add: 'Añadir',
    currency: 'Moneda',
    deleteExpense: 'Eliminar gasto',
    emptyTitle: 'Aún no hay gastos',
    emptyBody: 'Registra tu primer gasto para verlo frente a tu plan.',
    catLodging: 'Alojamiento', catTransport: 'Transporte', catFood: 'Comida',
    catTickets: 'Entradas', catShopping: 'Compras', catOther: 'Otros',
  },
  fr: {
    title: 'Budget du voyage',
    subtitle: 'Suivez vos dépenses et gardez le cap',
    totalBudget: 'Budget total',
    spent: 'Dépensé',
    remaining: 'restant',
    overBy: 'hors budget',
    noBudgetHint: 'Définissez un budget pour voir ce qui reste',
    amount: 'Montant',
    note: 'Note (facultatif)',
    category: 'Catégorie',
    add: 'Ajouter',
    currency: 'Devise',
    deleteExpense: 'Supprimer la dépense',
    emptyTitle: 'Aucune dépense pour l’instant',
    emptyBody: 'Ajoutez votre première dépense pour la comparer au plan.',
    catLodging: 'Hébergement', catTransport: 'Transport', catFood: 'Repas',
    catTickets: 'Billets', catShopping: 'Shopping', catOther: 'Autres',
  },
  ar: {
    title: 'ميزانية الرحلة',
    subtitle: 'سجّل المصروفات وتابع ميزانيتك',
    totalBudget: 'الميزانية الإجمالية',
    spent: 'المصروف',
    remaining: 'المتبقي',
    overBy: 'تجاوز الميزانية',
    noBudgetHint: 'حدّد ميزانية لعرض المبلغ المتبقي',
    amount: 'المبلغ',
    note: 'ملاحظة (اختياري)',
    category: 'الفئة',
    add: 'إضافة',
    currency: 'العملة',
    deleteExpense: 'حذف المصروف',
    emptyTitle: 'لا مصروفات بعد',
    emptyBody: 'سجّل أول مصروف لمقارنة الإنفاق بخطتك.',
    catLodging: 'الإقامة', catTransport: 'المواصلات', catFood: 'الطعام',
    catTickets: 'التذاكر', catShopping: 'التسوق', catOther: 'أخرى',
  },
  pt: {
    title: 'Orçamento da viagem',
    subtitle: 'Registre gastos e acompanhe seu orçamento',
    totalBudget: 'Orçamento total',
    spent: 'Gasto',
    remaining: 'restante',
    overBy: 'acima do orçamento',
    noBudgetHint: 'Defina um orçamento para ver o que resta',
    amount: 'Valor',
    note: 'Nota (opcional)',
    category: 'Categoria',
    add: 'Adicionar',
    currency: 'Moeda',
    deleteExpense: 'Excluir gasto',
    emptyTitle: 'Nenhum gasto ainda',
    emptyBody: 'Registre o primeiro gasto para comparar com o plano.',
    catLodging: 'Hospedagem', catTransport: 'Transporte', catFood: 'Comida',
    catTickets: 'Ingressos', catShopping: 'Compras', catOther: 'Outros',
  },
  ru: {
    title: 'Бюджет поездки',
    subtitle: 'Записывайте расходы и следите за бюджетом',
    totalBudget: 'Общий бюджет',
    spent: 'Потрачено',
    remaining: 'осталось',
    overBy: 'сверх бюджета',
    noBudgetHint: 'Задайте бюджет, чтобы видеть остаток',
    amount: 'Сумма',
    note: 'Заметка (необязательно)',
    category: 'Категория',
    add: 'Добавить',
    currency: 'Валюта',
    deleteExpense: 'Удалить расход',
    emptyTitle: 'Расходов пока нет',
    emptyBody: 'Запишите первый расход, чтобы сравнить его с планом.',
    catLodging: 'Жильё', catTransport: 'Транспорт', catFood: 'Еда',
    catTickets: 'Билеты', catShopping: 'Покупки', catOther: 'Другое',
  },
};

const CATEGORY_LABEL_KEYS: Record<ExpenseCategory, keyof BudgetCopy> = {
  lodging: 'catLodging',
  transport: 'catTransport',
  food: 'catFood',
  tickets: 'catTickets',
  shopping: 'catShopping',
  other: 'catOther',
};

// Data-viz palette only — emerald stays reserved for success states and rose
// for the share CTA elsewhere in the app.
const CATEGORY_COLORS: Record<ExpenseCategory, { dot: string; bar: string }> = {
  lodging: { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  transport: { dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  food: { dot: 'bg-violet-500', bar: 'bg-violet-500' },
  tickets: { dot: 'bg-sky-500', bar: 'bg-sky-500' },
  shopping: { dot: 'bg-teal-500', bar: 'bg-teal-500' },
  other: { dot: 'bg-slate-400', bar: 'bg-slate-400' },
};

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar',
  pt: 'pt-BR',
  ru: 'ru-RU',
};

function makeFormatter(locale: string, currency: string): (n: number) => string {
  try {
    const f = new Intl.NumberFormat(locale, { style: 'currency', currency });
    return (n: number) => f.format(n);
  } catch {
    try {
      const f = new Intl.NumberFormat(locale);
      return (n: number) => `${f.format(n)} ${currency}`;
    } catch {
      return (n: number) => `${n} ${currency}`;
    }
  }
}

function formatDateShort(dateISO: string, locale: string): string {
  const parts = dateISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return dateISO;
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
      new Date(parts[0], parts[1] - 1, parts[2]),
    );
  } catch {
    return dateISO;
  }
}

/**
 * Wanderlog-style per-trip budget tracker. Sits inside the itinerary page:
 * editable total budget + currency, big spent/remaining figure (amber warning
 * when over), per-category progress bars, quick add-expense row and a
 * recent-first expense list. Every change persists immediately via
 * utils/budgetState (localStorage, keyed by trip).
 */
const BudgetTracker: React.FC<BudgetTrackerProps> = ({ tripKey, initialBudget, language }) => {
  const t = COPY[language] || COPY.en;
  const locale = LOCALES[language] || 'en-US';
  const isRtl = language === 'ar';

  const [ledger, setLedger] = useState<BudgetLedger>(() => load(tripKey));
  const [budgetInput, setBudgetInput] = useState<string>(
    () => (ledger.totalBudget !== null ? String(ledger.totalBudget) : ''),
  );
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');

  // Load on trip change; seed total/currency from free-text initialBudget once
  // when the stored ledger has no total yet ("Total 2,000 USD" -> 2000 / USD).
  useEffect(() => {
    let next = load(tripKey);
    if (next.totalBudget === null && initialBudget) {
      const amt = parseLeadingAmount(initialBudget);
      const cur = detectCurrency(initialBudget);
      if (amt !== null || cur) next = setTotalBudget(tripKey, next, amt, cur ?? undefined);
    }
    setLedger(next);
    setBudgetInput(next.totalBudget !== null ? String(next.totalBudget) : '');
    setAmountInput('');
    setNoteInput('');
    setCategory('food');
  }, [tripKey, initialBudget]);

  const fmt = useMemo(() => makeFormatter(locale, ledger.currency), [locale, ledger.currency]);
  const s = useMemo(() => summarize(ledger), [ledger]);

  const over = s.remaining !== null && s.remaining < 0;
  const hasBudget = ledger.totalBudget !== null;
  const spentPct =
    hasBudget && ledger.totalBudget! > 0
      ? Math.min(100, Math.max(0, (s.spent / ledger.totalBudget!) * 100))
      : 0;

  const commitBudget = () => {
    const raw = budgetInput.trim();
    if (raw === '') {
      setLedger(setTotalBudget(tripKey, ledger, null));
      return;
    }
    const n = Number(raw.replace(/[ ,]/g, ''));
    if (Number.isFinite(n) && n >= 0) {
      setLedger(setTotalBudget(tripKey, ledger, n));
    } else {
      setBudgetInput(ledger.totalBudget !== null ? String(ledger.totalBudget) : '');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    // type="number" inputs always yield a clean decimal string here.
    const parsed = Number.parseFloat(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setLedger(
      addExpense(tripKey, ledger, {
        amount: parsed,
        category,
        note: noteInput.trim() || undefined,
        dateISO: new Date().toISOString().slice(0, 10),
      }),
    );
    setAmountInput('');
    setNoteInput('');
  };

  const handleRemove = (id: string) => {
    setLedger(removeExpense(tripKey, ledger, id));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLedger(setCurrency(tripKey, ledger, e.target.value));
  };

  const maxCategory = Math.max(...EXPENSE_CATEGORIES.map((c) => s.perCategory[c]), 1);
  const amountValid = Number.parseFloat(amountInput.replace(/,/g, '')) > 0;

  return (
    <section
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={t.title}
      className="mx-6 md:mx-10 mb-8 no-print"
    >
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800/60 shadow-sm overflow-hidden">
        {/* Header: identity + editable total budget */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3 bg-gradient-to-r from-blue-50/70 via-white to-violet-50/70 dark:from-blue-500/10 dark:via-slate-800/60 dark:to-violet-500/10 border-b border-slate-100 dark:border-slate-700/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Wallet className="w-4 h-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{t.title}</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{t.subtitle}</p>
            </div>
          </div>

          <label className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 font-mono">
              {t.totalBudget}
            </span>
            <select
              value={ledger.currency}
              onChange={handleCurrencyChange}
              aria-label={t.currency}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-1.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-500/20 transition-colors cursor-pointer"
            >
              {(SUPPORTED_CURRENCIES as readonly string[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={budgetInput}
              placeholder="—"
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={commitBudget}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitBudget();
                }
              }}
              aria-label={t.totalBudget}
              className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-500/20 focus:border-violet-300 dark:focus:border-violet-500 transition-colors"
            />
          </label>
        </div>

        {/* Big figure: spent vs remaining */}
        <div className="flex items-end justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 font-mono mb-0.5">
              {t.spent}
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
              {fmt(s.spent)}
            </div>
          </div>
          <div className="text-right shrink-0">
            {hasBudget && s.remaining !== null ? (
              <>
                <div
                  className={`text-[10px] font-bold uppercase tracking-[0.14em] font-mono mb-0.5 ${
                    over ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {over ? t.overBy : t.remaining}
                </div>
                <div
                  className={`text-xl font-bold tabular-nums leading-none ${
                    over ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {fmt(Math.abs(s.remaining))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[170px] leading-snug">
                {t.noBudgetHint}
              </p>
            )}
          </div>
        </div>

        {/* Overall progress against the budget */}
        {hasBudget && (
          <div className="px-5 pb-4">
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${
                  over
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-blue-500 to-violet-500'
                }`}
                style={{ width: `${spentPct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(spentPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {s.count > 0 && (
          <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {EXPENSE_CATEGORIES.map((cat) => {
              const v = s.perCategory[cat];
              const w = v > 0 ? Math.max(3, (v / maxCategory) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                      <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat].dot}`} aria-hidden />
                      {t[CATEGORY_LABEL_KEYS[cat]]}
                    </span>
                    <span className={`tabular-nums ${v > 0 ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-300 dark:text-slate-600'}`}>
                      {fmt(v)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${CATEGORY_COLORS[cat].bar}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick add-expense row */}
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-900/40"
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder={t.amount}
            aria-label={t.amount}
            required
            className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-500/20 focus:border-violet-300 dark:focus:border-violet-500 transition-colors"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            aria-label={t.category}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:border-violet-300 dark:hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-500/20 transition-colors"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t[CATEGORY_LABEL_KEYS[c]]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder={t.note}
            maxLength={120}
            aria-label={t.note}
            className="flex-1 min-w-[110px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-500/20 focus:border-violet-300 dark:focus:border-violet-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!amountValid}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold shadow-sm hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity motion-reduce:transition-none"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            {t.add}
          </button>
        </form>

        {/* Expense list — recent first, scrollable to keep the card compact */}
        {s.count === 0 ? (
          <div className="px-5 py-6 text-center border-t border-slate-100 dark:border-slate-700/70">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t.emptyTitle}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-snug">{t.emptyBody}</p>
          </div>
        ) : (
          <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50 border-t border-slate-100 dark:border-slate-700/70">
            {ledger.expenses.map((ex) => (
              <li
                key={ex.id}
                className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors motion-reduce:transition-none"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[ex.category].dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {ex.note || t[CATEGORY_LABEL_KEYS[ex.category]]}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t[CATEGORY_LABEL_KEYS[ex.category]]}
                    {ex.dateISO ? ` · ${formatDateShort(ex.dateISO, locale)}` : ''}
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200 shrink-0">
                  {fmt(ex.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(ex.id)}
                  aria-label={`${t.deleteExpense}: ${ex.note || ex.category}`}
                  className="shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 focus-visible:text-red-500 dark:focus-visible:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 dark:focus-visible:ring-red-500/30 transition-colors motion-reduce:transition-none"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default BudgetTracker;
