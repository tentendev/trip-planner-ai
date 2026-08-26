
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, ListChecks, Loader2, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { parsePlanDays } from '../utils/exportCalendar';
import {
  PlanActivityState,
  loadPlanState,
  savePlanState,
} from '../utils/planState';
import { regenerateDay } from '../services/planEdit';
import { FriendlyError } from '../services/geminiService';

interface TripProgressProps {
  markdown: string;
  destination?: string;
  language: Language;
  /** Called with the FULL new markdown after a scoped day regeneration */
  onRegenerated: (newMarkdown: string) => void;
}

interface CopySet {
  panelTitle: string;
  percentComplete: string;
  showDay: string;
  hideDay: string;
  markDone: string;
  hideActivity: string;
  hiddenLabel: string;
  restoreActivity: string;
  regenerate: string;
  regenerating: string;
  hintPlaceholder: string;
  errorRateLimited: string;
  errorBusy: string;
  errorGeneric: string;
}

// Every UI string lives here (component-local record), matching the SocialProof
// pattern — utils/i18n.ts is display-copy for other surfaces.
const COPY: Record<Language, CopySet> = {
  'en': {
    panelTitle: 'Trip progress',
    percentComplete: '{pct}% complete',
    showDay: 'Show day details',
    hideDay: 'Hide day details',
    markDone: 'Mark as done',
    hideActivity: 'Hide this activity',
    hiddenLabel: 'Hidden',
    restoreActivity: 'Show again',
    regenerate: 'Regenerate this day',
    regenerating: 'Regenerating…',
    hintPlaceholder: 'e.g. make it less busy',
    errorRateLimited: 'Too many requests — please wait about a minute and try again.',
    errorBusy: 'The AI planner is busy right now — please try again in a moment.',
    errorGeneric: 'Could not regenerate that day. Please try again.',
  },
  'zh-TW': {
    panelTitle: '行程進度',
    percentComplete: '完成 {pct}%',
    showDay: '展開當日細節',
    hideDay: '收起當日細節',
    markDone: '標記為已完成',
    hideActivity: '隱藏此活動',
    hiddenLabel: '已隱藏',
    restoreActivity: '重新顯示',
    regenerate: '重新產生這一天',
    regenerating: '重新產生中…',
    hintPlaceholder: '例如：排輕鬆一點',
    errorRateLimited: '請求太頻繁了，請約一分鐘後再試。',
    errorBusy: 'AI 規劃系統目前忙碌中，請稍後再試。',
    errorGeneric: '無法重新產生這一天，請再試一次。',
  },
  'zh-CN': {
    panelTitle: '行程进度',
    percentComplete: '完成 {pct}%',
    showDay: '展开当日详情',
    hideDay: '收起当日详情',
    markDone: '标记为已完成',
    hideActivity: '隐藏此活动',
    hiddenLabel: '已隐藏',
    restoreActivity: '重新显示',
    regenerate: '重新生成这一天',
    regenerating: '重新生成中…',
    hintPlaceholder: '例如：排轻松一点',
    errorRateLimited: '请求太频繁了，请约一分钟后再试。',
    errorBusy: 'AI 规划系统目前繁忙，请稍后再试。',
    errorGeneric: '无法重新生成这一天，请再试一次。',
  },
  'ja': {
    panelTitle: '旅行の進捗',
    percentComplete: '{pct}% 完了',
    showDay: 'その日の詳細を表示',
    hideDay: 'その日の詳細を閉じる',
    markDone: '完了としてマーク',
    hideActivity: 'このアクティビティを非表示',
    hiddenLabel: '非表示中',
    restoreActivity: '再表示',
    regenerate: 'この日だけ再生成',
    regenerating: '再生成中…',
    hintPlaceholder: '例：ゆったりめにして',
    errorRateLimited: 'リクエストが集中しています。約1分待ってからもう一度お試しください。',
    errorBusy: 'AIプランナーが混み合っています。しばらくしてからもう一度お試しください。',
    errorGeneric: 'この日を再生成できませんでした。もう一度お試しください。',
  },
  'ko': {
    panelTitle: '여행 진행률',
    percentComplete: '{pct}% 완료',
    showDay: '그날 일정 펼치기',
    hideDay: '그날 일정 접기',
    markDone: '완료로 표시',
    hideActivity: '이 활동 숨기기',
    hiddenLabel: '숨김',
    restoreActivity: '다시 표시',
    regenerate: '이 날만 다시 만들기',
    regenerating: '다시 생성 중…',
    hintPlaceholder: '예: 좀 더 여유롭게',
    errorRateLimited: '요청이 너무 많습니다. 약 1분 후에 다시 시도해 주세요.',
    errorBusy: 'AI 플래너가 혼잡합니다. 잠시 후 다시 시도해 주세요.',
    errorGeneric: '그 날을 다시 만들지 못했습니다. 다시 시도해 주세요.',
  },
  'hi': {
    panelTitle: 'यात्रा प्रगति',
    percentComplete: '{pct}% पूर्ण',
    showDay: 'दिन का विवरण देखें',
    hideDay: 'दिन का विवरण छिपाएँ',
    markDone: 'पूर्ण चिह्नित करें',
    hideActivity: 'यह गतिविधि छिपाएँ',
    hiddenLabel: 'छिपी हुई',
    restoreActivity: 'फिर से दिखाएँ',
    regenerate: 'केवल यह दिन दोबारा बनाएं',
    regenerating: 'दोबारा बनाया जा रहा है…',
    hintPlaceholder: 'जैसे: इसे कम व्यस्त बनाएं',
    errorRateLimited: 'बहुत सारे अनुरोध — कृपया लगभग एक मिनट प्रतीक्षा करें।',
    errorBusy: 'AI प्लानर व्यस्त है — कृपया थोड़ी देर में पुनः प्रयास करें।',
    errorGeneric: 'उस दिन को दोबारा नहीं बनाया जा सका। कृपया पुनः प्रयास करें।',
  },
  'es': {
    panelTitle: 'Progreso del viaje',
    percentComplete: '{pct}% completado',
    showDay: 'Mostrar detalles del día',
    hideDay: 'Ocultar detalles del día',
    markDone: 'Marcar como hecho',
    hideActivity: 'Ocultar esta actividad',
    hiddenLabel: 'Ocultas',
    restoreActivity: 'Volver a mostrar',
    regenerate: 'Regenerar solo este día',
    regenerating: 'Regenerando…',
    hintPlaceholder: 'ej.: hazlo más relajado',
    errorRateLimited: 'Demasiadas solicitudes: espera alrededor de un minuto e inténtalo de nuevo.',
    errorBusy: 'El planificador IA está ocupado: inténtalo en un momento.',
    errorGeneric: 'No se pudo regenerar ese día. Inténtalo de nuevo.',
  },
  'fr': {
    panelTitle: 'Progression du voyage',
    percentComplete: '{pct} % terminé',
    showDay: 'Afficher les détails du jour',
    hideDay: 'Masquer les détails du jour',
    markDone: 'Marquer comme fait',
    hideActivity: 'Masquer cette activité',
    hiddenLabel: 'Masquées',
    restoreActivity: 'Afficher à nouveau',
    regenerate: 'Régénérer ce jour',
    regenerating: 'Régénération…',
    hintPlaceholder: 'ex. : rendre la journée plus tranquille',
    errorRateLimited: 'Trop de requêtes — patientez environ une minute avant de réessayer.',
    errorBusy: 'Le planificateur IA est occupé — réessayez dans un instant.',
    errorGeneric: 'Impossible de régénérer ce jour. Veuillez réessayer.',
  },
  'ar': {
    panelTitle: 'تقدّم الرحلة',
    percentComplete: 'اكتمل {pct}%',
    showDay: 'إظهار تفاصيل اليوم',
    hideDay: 'إخفاء تفاصيل اليوم',
    markDone: 'تحديد كمكتمل',
    hideActivity: 'إخفاء هذا النشاط',
    hiddenLabel: 'مخفي',
    restoreActivity: 'إظهار مجددًا',
    regenerate: 'إعادة إنشاء هذا اليوم فقط',
    regenerating: 'جارٍ إعادة الإنشاء…',
    hintPlaceholder: 'مثال: اجعله أقل ازدحامًا',
    errorRateLimited: 'طلبات كثيرة جدًا — يرجى الانتظار حوالي دقيقة والمحاولة مجددًا.',
    errorBusy: 'مخطط الذكاء الاصطناعي مشغول الآن — حاول بعد قليل.',
    errorGeneric: 'تعذر إعادة إنشاء هذا اليوم. يرجى المحاولة مرة أخرى.',
  },
  'pt': {
    panelTitle: 'Progresso da viagem',
    percentComplete: '{pct}% concluído',
    showDay: 'Mostrar detalhes do dia',
    hideDay: 'Ocultar detalhes do dia',
    markDone: 'Marcar como feito',
    hideActivity: 'Ocultar esta atividade',
    hiddenLabel: 'Ocultas',
    restoreActivity: 'Mostrar novamente',
    regenerate: 'Regenerar só este dia',
    regenerating: 'Regenerando…',
    hintPlaceholder: 'ex.: deixe o dia mais leve',
    errorRateLimited: 'Muitas solicitações — aguarde cerca de um minuto e tente novamente.',
    errorBusy: 'O planejador com IA está ocupado — tente em instantes.',
    errorGeneric: 'Não foi possível regenerar esse dia. Tente novamente.',
  },
  'ru': {
    panelTitle: 'Прогресс поездки',
    percentComplete: 'выполнено {pct}%',
    showDay: 'Показать детали дня',
    hideDay: 'Скрыть детали дня',
    markDone: 'Отметить выполненным',
    hideActivity: 'Скрыть это занятие',
    hiddenLabel: 'Скрытые',
    restoreActivity: 'Показать снова',
    regenerate: 'Пересоздать только этот день',
    regenerating: 'Пересоздание…',
    hintPlaceholder: 'напр., сделать день спокойнее',
    errorRateLimited: 'Слишком много запросов — подождите около минуты и попробуйте снова.',
    errorBusy: 'ИИ-планировщик занят — попробуйте чуть позже.',
    errorGeneric: 'Не удалось пересоздать этот день. Попробуйте снова.',
  },
};

type ErrorBucket = 'rateLimited' | 'busy' | 'generic';

function bucketFor(code: string): ErrorBucket {
  // Mirrors api/chat.ts codes: 429 gets wait-a-minute copy, proxy/upstream
  // failures get try-shortly copy, anything else (validation, network shape)
  // falls back to generic.
  if (code === 'RATE_LIMITED') return 'rateLimited';
  if (
    code === 'TIMEOUT' ||
    code === 'UPSTREAM_BUSY' ||
    code === 'UPSTREAM_ERROR' ||
    code === 'PROXY_ERROR' ||
    code === 'CONFIG_ERROR' ||
    code === 'FORBIDDEN_ORIGIN' ||
    code === 'BAD_REQUEST'
  ) {
    return 'busy';
  }
  return 'generic';
}

/**
 * Wanderlog-style progress tracking over the parsed plan. State persists in
 * localStorage keyed by the plan markdown's hash, so editing any part of the
 * plan — including a scoped day regeneration — starts a fresh tracker instead
 * of keeping check-offs that no longer match the text.
 *
 * Activities come from parsePlanDays, whose extractor caps each day at its top
 * highlights (the same cap the calendar export and map pins use); the tracker
 * stays consistent with every other surface by sharing that source of truth.
 */
const TripProgress: React.FC<TripProgressProps> = ({ markdown, destination, language, onRegenerated }) => {
  const t = COPY[language] || COPY['en'];

  const days = useMemo(() => parsePlanDays(markdown), [markdown]);
  const [state, setState] = useState<PlanActivityState>(() => loadPlanState(markdown));
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const [hintDrafts, setHintDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<{ day: number; bucket: ErrorBucket } | null>(null);

  // New markdown ⇒ new hash ⇒ fresh slate. Reset transient UI too so a swap
  // never leaves stale spinners/errors pointing at days that changed.
  const markdownRef = useRef(markdown);
  useEffect(() => {
    markdownRef.current = markdown;
    setState(loadPlanState(markdown));
    setError(null);
  }, [markdown]);

  if (days.length === 0) return null;

  const persist = (next: PlanActivityState) => {
    setState(next);
    savePlanState(markdown, next);
  };

  const toggleCheck = (activity: string) => {
    const has = state.checkedActivities.includes(activity);
    persist({
      ...state,
      checkedActivities: has
        ? state.checkedActivities.filter((a) => a !== activity)
        : [...state.checkedActivities, activity],
    });
  };

  const toggleHide = (activity: string) => {
    const has = state.hiddenActivities.includes(activity);
    persist({
      ...state,
      checkedActivities: state.checkedActivities.filter((a) => a !== activity),
      hiddenActivities: has
        ? state.hiddenActivities.filter((a) => a !== activity)
        : [...state.hiddenActivities, activity],
    });
  };

  const visibleOf = (activities: string[]) => activities.filter((a) => !state.hiddenActivities.includes(a));
  const doneCount = (dayActivities: string[]) => visibleOf(dayActivities).filter((a) => state.checkedActivities.includes(a)).length;

  let totalVisible = 0;
  let totalDone = 0;
  for (const day of days) {
    totalVisible += visibleOf(day.activities).length;
    totalDone += doneCount(day.activities);
  }
  const pct = totalVisible > 0 ? Math.round((totalDone / totalVisible) * 100) : 0;

  const toggleExpanded = (dayNumber: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  };

  const handleRegenerate = async (dayNumber: number) => {
    setBusyDay(dayNumber);
    setError(null);
    const requestMarkdown = markdownRef.current;
    try {
      const hint = hintDrafts[dayNumber]?.trim();
      const next = await regenerateDay({
        markdown,
        dayNumber,
        destination,
        language,
        hint: hint || undefined,
      });
      setBusyDay(null);
      // If the plan swapped while we were in flight, our splice is built on a
      // stale base — drop it rather than clobbering the newer plan.
      if (markdownRef.current !== requestMarkdown) return;
      onRegenerated(next);
    } catch (err: unknown) {
      setBusyDay(null);
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TripProgress] regenerate failed', err);
      setError({ day: dayNumber, bucket: bucketFor(err instanceof FriendlyError ? err.code : '') });
    }
  };

  return (
    <section className="no-print mb-6 rounded-2xl border border-white/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm shadow-sm p-4 md:p-5">
      {/* Header: aggregate completion rides the brand gradient; per-day bars
          below are emerald because checking off is a success signal. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.panelTitle}</h2>
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          {t.percentComplete.replace('{pct}', String(pct))}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 rounded-full bg-gradient-to-r from-blue-100 to-violet-100 dark:from-blue-500/20 dark:to-violet-500/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {days.map((day) => {
          const isOpen = expanded.has(day.dayNumber);
          const visible = visibleOf(day.activities);
          const hidden = day.activities.filter((a) => state.hiddenActivities.includes(a));
          const done = doneCount(day.activities);
          const dayPct = visible.length > 0 ? Math.round((done / visible.length) * 100) : 0;
          const dayError = error && error.day === day.dayNumber ? error.bucket : null;

          return (
            <li key={day.anchorId} className="rounded-xl">
              <button
                onClick={() => toggleExpanded(day.dayNumber)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/40 cursor-pointer text-left transition-colors duration-150 motion-reduce:transition-none"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">{day.title}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:block h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${dayPct}%` }}
                    />
                  </span>
                  <span className={`text-xs tabular-nums ${done === visible.length && visible.length > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                    {done}/{visible.length}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="px-2 pb-3 pt-1">
                  <ul className="space-y-0.5">
                    {visible.map((activity) => {
                      const isChecked = state.checkedActivities.includes(activity);
                      return (
                        <li key={activity} className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors duration-150 motion-reduce:transition-none">
                          <button
                            onClick={() => toggleCheck(activity)}
                            aria-pressed={isChecked}
                            title={t.markDone}
                            className="flex items-center gap-2.5 flex-1 min-w-0 py-1.5 px-1 text-left cursor-pointer rounded-lg"
                          >
                            <span
                              className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none ${
                                isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-emerald-400'
                              }`}
                              aria-hidden
                            >
                              <Check className={`w-3 h-3 ${isChecked ? 'text-white' : 'text-transparent'}`} />
                            </span>
                            <span className={`text-sm truncate ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                              {activity}
                            </span>
                          </button>
                          <button
                            onClick={() => toggleHide(activity)}
                            title={t.hideActivity}
                            aria-label={t.hideActivity}
                            className="flex-shrink-0 p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {hidden.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                        <EyeOff className="w-3 h-3" />
                        {t.hiddenLabel}
                      </span>
                      {hidden.map((activity) => (
                        <button
                          key={activity}
                          onClick={() => toggleHide(activity)}
                          title={t.restoreActivity}
                          aria-label={`${t.restoreActivity}: ${activity}`}
                          className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-150 motion-reduce:transition-none"
                        >
                          <span className="truncate max-w-[180px] line-through">{activity}</span>
                          <Eye className="w-3 h-3 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Scoped edit: regenerate just this day. Full-plan
                      regeneration destroys trust; one day is cheap to redo. */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      value={hintDrafts[day.dayNumber] ?? ''}
                      onChange={(e) => setHintDrafts((prev) => ({ ...prev, [day.dayNumber]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && busyDay !== day.dayNumber) handleRegenerate(day.dayNumber);
                      }}
                      placeholder={t.hintPlaceholder}
                      maxLength={120}
                      disabled={busyDay !== null}
                      className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-60"
                    />
                    <button
                      onClick={() => handleRegenerate(day.dayNumber)}
                      disabled={busyDay !== null}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm shadow-blue-500/20 hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 disabled:hover:from-blue-600 disabled:hover:to-violet-600 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 motion-reduce:transition-none whitespace-nowrap"
                    >
                      {busyDay === day.dayNumber ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                          {t.regenerating}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                          {t.regenerate}
                        </>
                      )}
                    </button>
                  </div>
                  {dayError && (
                    <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                      {dayError === 'rateLimited' ? t.errorRateLimited : dayError === 'busy' ? t.errorBusy : t.errorGeneric}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TripProgress;
