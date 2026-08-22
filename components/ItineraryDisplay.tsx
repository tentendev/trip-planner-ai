
import React, { useState, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import FlightOffersSection from './FlightOffersSection';
import HotelOffersSection from './HotelOffersSection';
import WeatherStrip from './WeatherStrip';
import DayNav from './DayNav';
import {
  Download,
  Compass,
  Calendar,
  Printer,
  Copy,
  FileDown,
  ChevronDown,
  Check,
  PenLine,
  CloudSun,
  Globe,
  Share2,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { GeneratedPlan, Language, TripInput } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { saveSharedPlan, generateShareUrl } from '../utils/shareStorage';
import { downloadIcs } from '../utils/exportCalendar';

interface ItineraryDisplayProps {
  plan: GeneratedPlan;
  onReset: () => void;
  language: Language;
  planId?: string;
  tripInput?: TripInput;
  onOpenShareCard?: (shareUrl: string, highlights: string[]) => void;
}

/**
 * Clipboard with a legacy fallback — navigator.clipboard is unavailable on
 * non-secure origins (plain http), which would silently break Copy/Share.
 */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

const ItineraryDisplay: React.FC<ItineraryDisplayProps> = ({
  plan,
  onReset,
  language,
  tripInput,
  onOpenShareCard,
}) => {
  const t = TRANSLATIONS[language];
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyMarkdown = async () => {
    try {
      await copyToClipboard(plan.markdown);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([plan.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trip-OS-Plan-${language}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDropdown(false);
  };

  const handlePrint = () => {
    window.print();
    setShowDropdown(false);
  };

  const handleDownloadIcs = () => {
    downloadIcs(plan, tripInput, language);
    setShowDropdown(false);
  };

  const handleCopyShareLink = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { id: shareId } = await saveSharedPlan(plan, language, tripInput);
      const fullUrl = generateShareUrl(shareId, language);
      await copyToClipboard(fullUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to create share link', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenShareCard = async () => {
    try {
      const { id: shareId } = await saveSharedPlan(plan, language, tripInput);
      const fullUrl = generateShareUrl(shareId, language);
      const highlights = extractHighlights();
      if (onOpenShareCard) onOpenShareCard(fullUrl, highlights);
    } catch (err) {
      console.error('Failed to prepare share card', err);
    }
  };

  const extractHighlights = (): string[] => {
    const markdown = plan.markdown;
    const highlights: string[] = [];

    const dayMatch =
      markdown.match(/Day\s*1[^\n]*\n([^\n]+)/i) ||
      markdown.match(/第[一1]天[^\n]*\n([^\n]+)/i);
    if (dayMatch) {
      const activities = dayMatch[1].match(/[^|]+/g);
      if (activities) {
        activities.slice(0, 3).forEach((a) => {
          const cleaned = a.replace(/[*#\-|]/g, '').trim();
          if (cleaned && cleaned.length > 2 && cleaned.length < 30) highlights.push(cleaned);
        });
      }
    }

    const bulletMatches = markdown.match(/[-•]\s*([^-•\n]{5,40})/g);
    if (bulletMatches && highlights.length < 4) {
      bulletMatches.slice(0, 4 - highlights.length).forEach((match) => {
        const cleaned = match.replace(/[-•]\s*/, '').trim();
        if (cleaned && !highlights.includes(cleaned)) highlights.push(cleaned);
      });
    }

    return highlights.slice(0, 4);
  };

  const generatedAt = new Date().toLocaleDateString(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    // overflow-clip instead of overflow-hidden: identical corner clipping, but
    // it does not create a scroll container, so the sticky DayNav still works.
    <div className="trip-fade-up bg-white rounded-[28px] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_20px_60px_-20px_rgba(15,23,42,0.15)] border border-slate-200/60 overflow-clip relative">
      {/* Print-only header */}
      <div className="print-only mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <Compass className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-0">{t.title}</h1>
            <p className="text-slate-600 text-sm font-medium uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-500 flex justify-between font-mono border-t border-slate-200 pt-2">
          <span>{new Date().toLocaleString(language)}</span>
          <span>Generated by Trip OS AI</span>
        </div>
      </div>

      {/* Refined Header — clean, elegant, Google-style */}
      <div className="no-print relative">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />

        <div className="px-6 md:px-10 pt-8 md:pt-10 pb-6">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t.actions.ready || 'Ready'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono normal-case tracking-normal text-slate-400">{generatedAt}</span>
            {tripInput?.destination && (
              <>
                <span className="text-slate-300">·</span>
                <span className="normal-case tracking-normal text-slate-500 truncate max-w-[220px]">
                  {tripInput.destination}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-[28px] md:text-[40px] leading-[1.1] font-bold tracking-tight text-slate-900">
                {t.itinerary.title}
              </h2>
              <p className="mt-2.5 text-slate-500 text-[15px] md:text-base max-w-xl leading-relaxed">
                {t.itinerary.verified} · {t.subtitle}
              </p>
            </div>

            {/* Action cluster */}
            <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
              <button
                onClick={onReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                <PenLine className="w-4 h-4" />
                <span className="hidden sm:inline">{t.actions.refine}</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                disabled={isSharing}
                aria-busy={isSharing}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-70 ${
                  shareSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isSharing ? (
                  <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-slate-700 animate-spin" />
                ) : shareSuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {shareSuccess ? t.actions.copied : t.actions.share}
                </span>
              </button>

              <button
                onClick={handleOpenShareCard}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-semibold shadow-sm shadow-pink-500/20 transition-all hover:shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">{t.actions.shareCard || 'Share Card'}</span>
                <ImageIcon className="w-4 h-4 md:hidden" />
              </button>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.actions.export}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                  />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.12)] border border-slate-200/70 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="py-1.5">
                      <button
                        onClick={handleCopyMarkdown}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        {copySuccess ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{copySuccess ? t.actions.copied : t.actions.copy}</span>
                      </button>
                      <button
                        onClick={handleDownloadMarkdown}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <FileDown className="w-4 h-4 text-slate-400" />
                        <span>{t.actions.download}</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <Printer className="w-4 h-4 text-slate-400" />
                        <span>{t.actions.print}</span>
                      </button>
                      <button
                        onClick={handleDownloadIcs}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Calendar (.ics)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Weather callout */}
        {plan.sources && plan.sources.length > 0 && (
          <div className="mx-6 md:mx-10 mb-6 flex items-start gap-4 p-4 md:p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-100/80">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-blue-100 flex items-center justify-center flex-shrink-0">
              <CloudSun className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-700 flex-1 min-w-0">
              <div className="font-semibold text-slate-900 mb-0.5">{t.itinerary.weather_title}</div>
              <p className="text-slate-600 leading-relaxed">{t.itinerary.weather_desc}</p>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-100" />
      </div>

      {/* Real-time flight offers (data-driven, not LLM-rendered) */}
      {plan.flights && plan.flights.length > 0 && (
        <FlightOffersSection
          flights={plan.flights}
          searchParams={plan.searchParams}
          priceInsights={plan.flightPriceInsights}
          language={language}
        />
      )}

      {/* Real-time hotel offers */}
      {plan.hotels && plan.hotels.length > 0 && (
        <HotelOffersSection
          hotels={plan.hotels}
          searchParams={plan.searchParams}
          language={language}
        />
      )}

      {/* Real weather forecast (Open-Meteo) */}
      {plan.weather && plan.weather.days.length > 0 && (
        <WeatherStrip weather={plan.weather} language={language} />
      )}

      {/* Jump-to-day navigation (sticky under the app header).
          display:contents keeps the wrapper box-free so the child's own
          position:sticky still resolves against this whole card, not the
          wrapper; .no-print/[data-daynav] give print a redundant hide hook
          alongside DayNav's internal .no-print. */}
      <div className="no-print contents" data-daynav>
        <DayNav
          markdown={plan.markdown}
          destination={tripInput?.destination}
          language={language}
        />
      </div>

      {/* Content */}
      <div className="px-5 md:px-12 py-8 md:py-12 relative z-10">
        <MarkdownRenderer content={plan.markdown} />

        {plan.sources && plan.sources.length > 0 && (
          <div className="mt-16 pt-8 border-t border-slate-100 no-print">
            <h4 className="text-[11px] font-bold text-slate-400 mb-4 uppercase tracking-[0.14em] font-mono flex items-center gap-2">
              <Globe className="w-3 h-3" />
              {t.itinerary.sources}
            </h4>
            <div className="flex flex-wrap gap-2">
              {plan.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 border border-slate-200/70 text-slate-600 text-xs hover:bg-white hover:border-slate-300 hover:text-slate-900 transition-all"
                >
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50/60 px-8 py-6 text-center text-slate-400 text-xs border-t border-slate-100 no-print">
        <p className="uppercase tracking-widest opacity-70">
          {t.itinerary.footer_disclaimer}
        </p>
      </div>
    </div>
  );
};

export default ItineraryDisplay;
