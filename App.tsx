
import React, { useState, useEffect, useRef } from 'react';
import InputForm from './components/InputForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import PreAnalysisView from './components/PreAnalysisView';
import SocialProof from './components/SocialProof';
import ShareCard from './components/ShareCard';
import { generateTripPlan, preAnalyzeTrip, CURRENT_MODEL } from './services/geminiService';
import { TripInput, LoadingState, GeneratedPlan, Language, PreAnalysisQuestion } from './types';
import { Globe, Terminal, ChevronDown, Check } from 'lucide-react';
import { TRANSLATIONS, LANGUAGE_NAMES } from './utils/i18n';
import { getSharedPlan } from './utils/shareStorage';

const STORAGE_KEY = 'trip_os_v1_state';

// Persisted shape. Partial streaming markdown is intentionally kept OUT of here:
// it changes many times per second and would spam localStorage writes (and restore
// a half-finished plan after a reload). Only final GeneratedPlans are persisted.
interface AppState {
  lastInput?: TripInput;
  tripPlan?: GeneratedPlan | null;
}

/**
 * Hero titles in i18n contain a literal <br/> to control line wrapping. Rendering them
 * via dangerouslySetInnerHTML would execute any HTML that ever lands in translations —
 * splitting on the token and rendering real <br> elements gets the same layout safely.
 */
const renderHeroTitle = (title: string): React.ReactNode =>
  title.split(/<br\s*\/?>/i).map((part, i, arr) =>
    i < arr.length - 1 ? (
      <React.Fragment key={i}>
        {part}
        <br />
      </React.Fragment>
    ) : (
      part
    )
  );

const App: React.FC = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [tripPlan, setTripPlan] = useState<GeneratedPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<TripInput | undefined>(undefined);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isFetchingShare, setIsFetchingShare] = useState(false);
  const [preAnalysisQuestions, setPreAnalysisQuestions] = useState<PreAnalysisQuestion[] | null>(null);

  // Live-generation state (see AppState note above — deliberately NOT persisted).
  const [partialMarkdown, setPartialMarkdown] = useState<string | undefined>(undefined);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // rAF coalescing for token deltas: at most one re-render per frame no matter how
  // chatty the upstream stream is.
  const pendingPartialRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);

  // Language Dropdown State
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // One-shot flag so localStorage restore runs on mount only
  const hasRestoredRef = useRef(false);

  // ShareCard State (placed at root level for proper mobile positioning)
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardData, setShareCardData] = useState<{ shareUrl: string; highlights: string[] }>({
    shareUrl: '',
    highlights: []
  });

  // Initialize language priority: URL -> Browser -> Default (zh-TW)
  const [language, setLanguage] = useState<Language>(() => {
    // 1. Check URL Parameter
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, urlLang)) {
      return urlLang as Language;
    }

    // 2. Check Browser Settings
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.toLowerCase();

      if (browserLang.startsWith('zh')) {
        // Traditional Chinese for Taiwan or Hong Kong regions
        return (browserLang.includes('tw') || browserLang.includes('hk')) ? 'zh-TW' : 'zh-CN';
      }
      if (browserLang.startsWith('ja')) return 'ja';
      if (browserLang.startsWith('ko')) return 'ko';
      if (browserLang.startsWith('es')) return 'es';
      if (browserLang.startsWith('fr')) return 'fr';
      if (browserLang.startsWith('pt')) return 'pt';
      if (browserLang.startsWith('ru')) return 'ru';
      if (browserLang.startsWith('ar')) return 'ar';
      if (browserLang.startsWith('hi')) return 'hi';
      if (browserLang.startsWith('en')) return 'en';
    }

    // 3. Fallback
    return 'zh-TW';
  });

  // Check for shared itinerary in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // New short ID based sharing (preferred)
    const shareId = params.get('share');
    if (shareId) {
      // Lightweight fetch indicator — NOT the generation overlay, which would
      // falsely imply an itinerary is being created.
      setIsFetchingShare(true);

      getSharedPlan(shareId).then(sharedPlan => {
        if (sharedPlan) {
          setTripPlan({
            markdown: sharedPlan.markdown,
            sources: sharedPlan.sources || [],
            flights: sharedPlan.flights,
            hotels: sharedPlan.hotels,
            searchParams: sharedPlan.searchParams,
            weather: sharedPlan.weather,
            flightPriceInsights: sharedPlan.flightPriceInsights,
          });
          setIsSharedView(true);
          setLoadingState(LoadingState.SUCCESS);

          if (sharedPlan.lang && Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, sharedPlan.lang)) {
            setLanguage(sharedPlan.lang as Language);
          }
        } else {
          // Share not found — reset to idle
          setLoadingState(LoadingState.IDLE);
        }
      }).catch(() => {
        setLoadingState(LoadingState.IDLE);
      }).finally(() => {
        setIsFetchingShare(false);
      });
      return;
    }

    // Legacy: base64 encoded sharing (backward compatibility)
    const sharedData = params.get('shared');
    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(sharedData)));
        if (decoded.markdown) {
          setTripPlan({
            markdown: decoded.markdown,
            sources: decoded.sources || []
          });
          setIsSharedView(true);
          setLoadingState(LoadingState.SUCCESS);

          if (decoded.lang && Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, decoded.lang)) {
            setLanguage(decoded.lang as Language);
          }
        }
      } catch (e) {
        console.error("Failed to parse shared itinerary", e);
      }
    }
  }, []);

  // Defensive check: Ensure t exists. If invalid lang is somehow passed, fallback to English.
  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];

  // Sync URL, Document Title, and Direction when language changes
  const switchLanguage = (newLang: Language) => {
    setLanguage(newLang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.history.pushState({}, '', url);
    setIsLangMenuOpen(false);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    // If the user is viewing a shared plan, the server (via /api/preview) has
    // already injected meaningful meta tags — don't overwrite them with
    // generic locale defaults.
    const hasShareParam = new URLSearchParams(window.location.search).has('share');
    if (!hasShareParam) {
      document.title = t.metaTitle;

      const updateMetaTag = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
        }
        if (meta) {
          meta.content = content;
        }
      };

      updateMetaTag('og:title', t.metaTitle);
      updateMetaTag('og:description', t.hero.desc);
      updateMetaTag('twitter:title', t.metaTitle);
      updateMetaTag('twitter:description', t.hero.desc);
      updateMetaTag('description', t.hero.desc);
    }

    // Restore persisted state exactly once per page load — re-running this on
    // every language switch used to clobber fresh in-memory state.
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      let savedState: string | null = null;
      try {
        savedState = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        console.warn('[App] localStorage unavailable, skipping restore', e);
      }
      if (savedState) {
        try {
          const parsed: AppState = JSON.parse(savedState);
          if (parsed.lastInput) setLastInput(parsed.lastInput);
          if (parsed.tripPlan) setTripPlan(parsed.tripPlan);
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      }
    }
  }, [language, t.metaTitle, t.hero.desc]);

  // Handle clicking outside language menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (lastInput || tripPlan) {
      const stateToSave: AppState = {
        lastInput,
        tripPlan: tripPlan || undefined
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (err) {
        // Quota exceeded (plans with flights[]/hotels[] can be hundreds of KB) or
        // storage blocked. Retry with a slimmed payload that keeps the markdown.
        console.warn('[App] localStorage save failed, retrying slim payload', err);
        try {
          const slim: AppState = {
            lastInput,
            tripPlan: tripPlan
              ? { ...tripPlan, flights: undefined, hotels: undefined }
              : undefined
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
        } catch (err2) {
          console.warn('[App] localStorage unavailable — state will not persist', err2);
        }
      }
    }
  }, [lastInput, tripPlan]);

  const handleFormSubmit = async (data: TripInput) => {
    setLastInput(data);
    setErrorMsg(null);
    setLoadingState(LoadingState.PRE_ANALYZING);

    try {
      const questions = await preAnalyzeTrip(data, language);
      setPreAnalysisQuestions(questions);
      setLoadingState(LoadingState.IDLE);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      // If pre-analysis fails, fall back to direct generation
      console.warn("Pre-analysis failed, falling back to direct generation:", err);
      await handleGenerate(data);
    }
  };

  // Coalesce streaming deltas into one setState per animation frame.
  const queuePartialUpdate = (accumulated: string) => {
    pendingPartialRef.current = accumulated;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setPartialMarkdown(pendingPartialRef.current);
      });
    }
  };

  // Drop any in-flight frame when the component unmounts mid-generation.
  useEffect(() => () => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Tick the elapsed timer once per second while generating; the overlay reads it
  // as its big monospace clock. Interval only exists during GENERATING.
  useEffect(() => {
    if (loadingState !== LoadingState.GENERATING || generationStartedAt == null) return;
    setElapsedMs(Date.now() - generationStartedAt);
    const id = setInterval(() => setElapsedMs(Date.now() - generationStartedAt), 1000);
    return () => clearInterval(id);
  }, [loadingState, generationStartedAt]);

  const handleGenerate = async (data: TripInput, answers?: Record<string, string[]>) => {
    setLoadingState(LoadingState.GENERATING);
    setErrorMsg(null);
    setPartialMarkdown(undefined);

    // Fresh controller per attempt — Stop aborts exactly this generation.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setGenerationStartedAt(Date.now());

    try {
      const result = await generateTripPlan(data, language, answers, preAnalysisQuestions || undefined, {
        signal: controller.signal,
        onDelta: queuePartialUpdate,
      });
      setTripPlan(result);
      setPreAnalysisQuestions(null);
      setLoadingState(LoadingState.SUCCESS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Graceful cancel via Stop: no error banner, and any previously generated
        // plan stays exactly where it was on screen.
        console.info('[App] generation cancelled by user');
        setPreAnalysisQuestions(null);
        setLoadingState(LoadingState.IDLE);
      } else {
        console.error('[handleGenerate] generation failed', err);
        setLoadingState(LoadingState.ERROR);
        // FriendlyError messages are already localized and user-appropriate — show them
        // as-is. Anything else gets the generic localized error plus the technical detail.
        const detail = err?.name === 'FriendlyError'
          ? err.message
          : err?.message ? `${t.error} (${err.message})` : t.error;
        setErrorMsg(detail);
        setPreAnalysisQuestions(null);
      }
    } finally {
      abortControllerRef.current = null;
      setGenerationStartedAt(null);
      setPartialMarkdown(undefined);
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handlePreAnalysisConfirm = (answers: Record<string, string[]>) => {
    if (lastInput) {
      handleGenerate(lastInput, answers);
    }
  };

  const handlePreAnalysisSkip = () => {
    if (lastInput) {
      handleGenerate(lastInput);
    }
  };

  const handleRefineTrip = () => {
    setTripPlan(null);
    setPreAnalysisQuestions(null);
    setLoadingState(LoadingState.IDLE);
    setIsSharedView(false);

    // Clear share params from URL if present
    const url = new URL(window.location.href);
    let needsUpdate = false;
    if (url.searchParams.has('share')) {
      url.searchParams.delete('share');
      needsUpdate = true;
    }
    if (url.searchParams.has('shared')) {
      url.searchParams.delete('shared');
      needsUpdate = true;
    }
    if (needsUpdate) {
      window.history.replaceState({}, '', url);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    const CONFIRM_CLEAR: Partial<Record<Language, string>> = {
      'en': 'Are you sure you want to clear your saved trip data?',
      'zh-TW': '確定要清除已儲存的行程資料嗎？',
      'zh-CN': '确定要清除已保存的行程数据吗？',
      'ja': '保存した旅行データを消去しますか？',
      'ko': '저장된 여행 데이터를 지우시겠습니까?',
      'es': '¿Seguro que quieres borrar los datos guardados del viaje?',
      'fr': 'Voulez-vous vraiment effacer les données du voyage enregistré ?',
      'pt': 'Tem certeza de que deseja limpar os dados da viagem salvos?',
      'ru': 'Вы уверены, что хотите удалить сохранённые данные поездки?',
      'ar': 'هل أنت متأكد أنك تريد مسح بيانات الرحلة المحفوظة؟',
      'hi': 'क्या आप वाकई सहेजे गए यात्रा डेटा को मिटाना चाहते हैं?',
    };

    if(window.confirm(CONFIRM_CLEAR[language] || CONFIRM_CLEAR['en']!)) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch { /* storage unavailable */ }
        setLastInput(undefined);
        setTripPlan(null);
        setLoadingState(LoadingState.IDLE);
    }
  };

  // Handler for opening ShareCard from ItineraryDisplay
  const handleOpenShareCard = (shareUrl: string, highlights: string[]) => {
    setShareCardData({ shareUrl, highlights });
    setShowShareCard(true);
  };

  return (
    <div className="min-h-screen text-slate-800 pb-20 flex flex-col font-sans relative">
      <div className="aurora-bg"></div>

      {/* Loading Overlay */}
      {loadingState === LoadingState.GENERATING && (
        <LoadingOverlay
          language={language}
          partialMarkdown={partialMarkdown}
          elapsedMs={elapsedMs}
          onCancel={handleCancelGeneration}
        />
      )}
      
      <header className="bg-white/70 backdrop-blur-md border-b border-white/20 sticky top-0 z-50 no-print flex-none supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = `/?lang=${language}`}>
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-slate-900 leading-none flex items-center gap-2">
                {t.title} <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-mono">v1.0</span>
              </h1>
              <span className="text-xs text-slate-500 font-medium tracking-wide">{t.subtitle}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 text-sm font-medium text-slate-500">
            {/* Clear History - Desktop only */}
            {(lastInput || tripPlan) && (
                <button onClick={handleClearHistory} className="hidden md:block hover:text-red-500 transition mr-2 text-xs font-mono opacity-60 hover:opacity-100">
                    [ {t.actions.clear} ]
                </button>
            )}

            {/* Language Dropdown - Works on both mobile and desktop */}
            <div className="relative" ref={langMenuRef}>
               <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1 md:gap-2 hover:text-blue-600 transition px-2 md:px-3 py-2 rounded-lg hover:bg-white/50 backdrop-blur-sm"
               >
                 <Globe className="w-4 h-4" />
                 <span className="hidden md:inline">{LANGUAGE_NAMES[language]}</span>
                 <ChevronDown className={`w-3 h-3 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
               </button>

               {isLangMenuOpen && (
                 <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto">
                    {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => switchLanguage(code as Language)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50/50 flex items-center justify-between transition-colors ${language === code ? 'text-blue-600 font-bold bg-blue-50/80' : 'text-slate-700'}`}
                      >
                        {name}
                        {language === code && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 pt-8 md:pt-12 flex-grow w-full relative z-10">

        {isFetchingShare && (
          <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300" role="status" aria-live="polite">
            <div className="relative w-14 h-14 mb-5">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t.loading.subtitle}</p>
          </div>
        )}

        {!isFetchingShare && loadingState === LoadingState.IDLE && !tripPlan && !preAnalysisQuestions && (
          <div className="mb-12 text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
               {renderHeroTitle(t.hero.title)}
            </h2>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-light mb-8">
              {t.hero.desc}
            </p>

            {/* Social Proof Section */}
            <SocialProof language={language} />
          </div>
        )}

        {loadingState === LoadingState.ERROR && (
          <div className="mb-8 p-4 bg-red-50/80 backdrop-blur border border-red-200 rounded-xl text-red-700 flex items-center gap-3 shadow-lg shadow-red-100/50" role="alert">
             <div className="w-6 h-6 flex items-center justify-center">⚠️</div>
             <div>
               <p className="font-bold font-mono text-xs uppercase tracking-wider">{t.actions.errorTitle || 'Error'}</p>
               <p className="text-sm">{errorMsg}</p>
             </div>
          </div>
        )}

        {/* Pre-Analysis Loading State */}
        {loadingState === LoadingState.PRE_ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 animate-spin"></div>
            </div>
            <p className="text-lg font-bold text-slate-800">{t.preAnalysis.analyzing}</p>
            <p className="text-sm text-slate-500 mt-2">{t.preAnalysis.analyzingSubtitle}</p>
          </div>
        )}

        {tripPlan ? (
          <ItineraryDisplay plan={tripPlan} onReset={handleRefineTrip} language={language} tripInput={lastInput} onOpenShareCard={handleOpenShareCard} />
        ) : preAnalysisQuestions ? (
          <PreAnalysisView
            questions={preAnalysisQuestions}
            language={language}
            onConfirm={handlePreAnalysisConfirm}
            onSkip={handlePreAnalysisSkip}
          />
        ) : !isFetchingShare && loadingState !== LoadingState.PRE_ANALYZING ? (
          <InputForm
            onSubmit={handleFormSubmit}
            isLoading={loadingState === LoadingState.GENERATING}
            initialValues={lastInput}
            language={language}
          />
        ) : null}
      </main>

      <footer className="py-8 text-center text-slate-400 text-sm no-print relative z-10">
         <p>
           © Built with Love ❤️ by <a href="https://tenten.co/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Tenten AI</a> | The Leading AI-First Agency in Asia
        </p>
        <p className="mt-2 text-xs text-slate-400/70 font-mono flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          Powered by <span className="text-slate-500">{CURRENT_MODEL}</span>
        </p>
      </footer>

      {/* ShareCard Modal - Placed at root level for proper mobile centering */}
      <ShareCard
        isOpen={showShareCard}
        onClose={() => setShowShareCard(false)}
        language={language}
        tripData={{
          destination: lastInput?.destination || '',
          dates: lastInput?.dates || '',
          travelers: lastInput?.travelers || '',
          budget: lastInput?.budget || '',
          pace: lastInput?.pace || 'Moderate',
          interests: lastInput?.interests || '',
          highlights: shareCardData.highlights,
        }}
        shareUrl={shareCardData.shareUrl}
      />
    </div>
  );
};

export default App;
