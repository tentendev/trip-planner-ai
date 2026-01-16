
import React, { useState, useEffect, useRef } from 'react';
import InputForm from './components/InputForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import { generateTripPlan } from './services/geminiService';
import { TripInput, LoadingState, GeneratedPlan, Language } from './types';
import { Globe, Terminal, ChevronDown, Check } from 'lucide-react';
import { TRANSLATIONS, LANGUAGE_NAMES } from './utils/i18n';
import { getSharedPlan } from './utils/shareStorage';

const STORAGE_KEY = 'trip_os_v1_state';

interface AppState {
  lastInput?: TripInput;
  tripPlan?: GeneratedPlan | null;
}

const App: React.FC = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [tripPlan, setTripPlan] = useState<GeneratedPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<TripInput | undefined>(undefined);
  const [isSharedView, setIsSharedView] = useState(false);

  // Language Dropdown State
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

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
      const sharedPlan = getSharedPlan(shareId);
      if (sharedPlan) {
        setTripPlan({
          markdown: sharedPlan.markdown,
          sources: sharedPlan.sources || []
        });
        setIsSharedView(true);
        setLoadingState(LoadingState.SUCCESS);

        // Set language from shared data if available
        if (sharedPlan.lang && Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, sharedPlan.lang)) {
          setLanguage(sharedPlan.lang as Language);
        }
        return;
      }
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

          // Set language from shared data if available
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
    document.title = t.metaTitle;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed: AppState = JSON.parse(savedState);
        if (parsed.lastInput) setLastInput(parsed.lastInput);
        if (parsed.tripPlan) setTripPlan(parsed.tripPlan);
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
  }, [language, t.metaTitle]);

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [lastInput, tripPlan]);

  const handleFormSubmit = async (data: TripInput) => {
    setLoadingState(LoadingState.GENERATING);
    setLastInput(data); 
    setErrorMsg(null);
    
    try {
      const result = await generateTripPlan(data, language);
      setTripPlan(result);
      setLoadingState(LoadingState.SUCCESS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setLoadingState(LoadingState.ERROR);
      setErrorMsg(t.error);
    }
  };

  const handleRefineTrip = () => {
    setTripPlan(null);
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
    const confirmMsg = language === 'zh-TW' 
      ? "確定要清除歷史紀錄嗎？" 
      : "Are you sure you want to clear history?";
      
    if(window.confirm(confirmMsg)) {
        localStorage.removeItem(STORAGE_KEY);
        setLastInput(undefined);
        setTripPlan(null);
        setLoadingState(LoadingState.IDLE);
    }
  };

  return (
    <div className="min-h-screen text-slate-800 pb-20 flex flex-col font-sans relative">
      <div className="aurora-bg"></div>
      
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
        
        {loadingState === LoadingState.IDLE && !tripPlan && (
          <div className="mb-12 text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
               <span dangerouslySetInnerHTML={{ __html: t.hero.title }} />
            </h2>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-light">
              {t.hero.desc}
            </p>
          </div>
        )}

        {loadingState === LoadingState.ERROR && (
          <div className="mb-8 p-4 bg-red-50/80 backdrop-blur border border-red-200 rounded-xl text-red-700 flex items-center gap-3 shadow-lg shadow-red-100/50">
             <div className="w-6 h-6 flex items-center justify-center">⚠️</div>
             <div>
               <p className="font-bold font-mono text-xs uppercase tracking-wider">System Error</p>
               <p className="text-sm">{errorMsg}</p>
             </div>
          </div>
        )}

        {tripPlan ? (
          <ItineraryDisplay plan={tripPlan} onReset={handleRefineTrip} language={language} />
        ) : (
          <InputForm 
            onSubmit={handleFormSubmit} 
            isLoading={loadingState === LoadingState.GENERATING}
            initialValues={lastInput} 
            language={language}
          />
        )}
      </main>

      <footer className="py-8 text-center text-slate-400 text-sm no-print relative z-10">
         <p>
           © Built with Love ❤️ by <a href="https://tenten.co/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Tenten AI</a> | The Leading AI-First Agency in Asia
        </p>
      </footer>
    </div>
  );
};

export default App;
