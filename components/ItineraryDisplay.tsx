
import React, { useState, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { Download, Map, Compass, Printer, Copy, FileDown, ChevronDown, Check, PenLine, CloudSun, Globe, Radio, Share2, Link, Sparkles, Image } from 'lucide-react';
import { GeneratedPlan, Language, TripInput } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { saveSharedPlan, generateShareUrl } from '../utils/shareStorage';

interface ItineraryDisplayProps {
  plan: GeneratedPlan;
  onReset: () => void;
  language: Language;
  planId?: string;
  tripInput?: TripInput;
  onOpenShareCard?: (shareUrl: string, highlights: string[]) => void;
}

const ItineraryDisplay: React.FC<ItineraryDisplayProps> = ({ plan, onReset, language, planId, tripInput, onOpenShareCard }) => {
  const t = TRANSLATIONS[language];
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(plan.markdown);
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

  const handleShare = async () => {
    try {
      // Save to localStorage and get short ID
      const shareId = saveSharedPlan(plan, language);
      const fullUrl = generateShareUrl(shareId, language);

      // Try native share API first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: t.title + ' - ' + t.itinerary.title,
          text: t.hero.desc,
          url: fullUrl
        });
        setShareSuccess(true);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(fullUrl);
        setShareUrl(fullUrl);
        setShareSuccess(true);
      }

      setTimeout(() => {
        setShareSuccess(false);
        setShareUrl(null);
      }, 3000);
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to share', err);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      // Save to localStorage and get short ID
      const shareId = saveSharedPlan(plan, language);
      const fullUrl = generateShareUrl(shareId, language);

      await navigator.clipboard.writeText(fullUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to copy share link', err);
    }
  };

  const handleOpenShareCard = () => {
    // Generate share URL first
    const shareId = saveSharedPlan(plan, language);
    const fullUrl = generateShareUrl(shareId, language);
    const highlights = extractHighlights();

    // Call parent callback to open ShareCard at root level
    if (onOpenShareCard) {
      onOpenShareCard(fullUrl, highlights);
    }
  };

  // Extract trip highlights from markdown content
  const extractHighlights = (): string[] => {
    const markdown = plan.markdown;
    const highlights: string[] = [];

    // Try to extract from Day 1 activities or main attractions
    const dayMatch = markdown.match(/Day\s*1[^\n]*\n([^\n]+)/i) ||
                     markdown.match(/第[一1]天[^\n]*\n([^\n]+)/i);
    if (dayMatch) {
      const activities = dayMatch[1].match(/[^|]+/g);
      if (activities) {
        activities.slice(0, 3).forEach(a => {
          const cleaned = a.replace(/[*#\-|]/g, '').trim();
          if (cleaned && cleaned.length > 2 && cleaned.length < 30) {
            highlights.push(cleaned);
          }
        });
      }
    }

    // Also try to extract from bullet points
    const bulletMatches = markdown.match(/[-•]\s*([^-•\n]{5,40})/g);
    if (bulletMatches && highlights.length < 4) {
      bulletMatches.slice(0, 4 - highlights.length).forEach(match => {
        const cleaned = match.replace(/[-•]\s*/, '').trim();
        if (cleaned && !highlights.includes(cleaned)) {
          highlights.push(cleaned);
        }
      });
    }

    return highlights.slice(0, 4);
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden relative">
      
      {/* Decorative noise texture overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none no-print"></div>

      {/* Print Header - Visible ONLY when printing */}
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

      {/* "Tactical Dashboard" Header - Hidden when printing */}
      <div className="bg-slate-900 text-white p-6 md:p-10 relative overflow-hidden no-print">
         {/* Abstract data lines */}
         <div className="absolute top-0 right-0 w-64 h-full border-l border-white/10 opacity-50 transform skew-x-12"></div>
         <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-blue-300 mb-1">
                 <Radio className="w-4 h-4 animate-pulse" />
                 <span className="font-mono text-xs uppercase tracking-widest opacity-80">System Optimized • Live Data</span>
               </div>
               
               <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                 {t.itinerary.title}
               </h2>

               <div className="flex flex-wrap gap-4 pt-2">
                 <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/10 border border-white/10 backdrop-blur text-xs font-mono text-slate-300">
                   <span className="w-2 h-2 rounded-full bg-green-500"></span>
                   <span>STATUS: READY</span>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/10 border border-white/10 backdrop-blur text-xs font-mono text-slate-300">
                   <span>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                 </div>
               </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur text-sm font-medium transition"
              >
                <PenLine className="w-4 h-4" /> {t.actions.refine}
              </button>

              <button
                onClick={handleOpenShareCard}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/30 text-sm font-bold transition"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">{t.actions.shareCard || 'Share Card'}</span>
                <span className="md:hidden"><Image className="w-4 h-4" /></span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white border border-white/10 backdrop-blur text-sm font-medium transition ${shareSuccess ? 'bg-green-600' : 'bg-white/10 hover:bg-white/20'}`}
              >
                {shareSuccess ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {shareSuccess ? t.actions.copied : t.actions.share}
              </button>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50 text-sm font-bold transition"
                >
                  <Download className="w-4 h-4" /> 
                  {t.actions.export}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-slate-700 ring-1 ring-black/5">
                    <div className="py-1">
                      {/* 1. Copy */}
                      <button
                        onClick={handleCopyMarkdown}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        {copySuccess ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />}
                        {copySuccess ? <span className="text-green-600 font-medium">{t.actions.copied}</span> : t.actions.copy}
                      </button>
                      
                      {/* 2. Export Markdown File */}
                      <button
                        onClick={handleDownloadMarkdown}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors border-t border-slate-100 group"
                      >
                        <FileDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                        {t.actions.download}
                      </button>
                      
                      {/* 3. Print */}
                      <button
                        onClick={handlePrint}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors border-t border-slate-100 group"
                      >
                        <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                        {t.actions.print}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      <div className="p-6 md:p-12 relative z-10">
        {plan.sources && plan.sources.length > 0 && (
          <div className="mb-8 bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex items-start gap-4 no-print shadow-sm">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
               <CloudSun className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-sm text-blue-900">
              <span className="font-bold block mb-1 text-base">{t.itinerary.weather_title}</span>
              <p className="opacity-80 leading-relaxed">{t.itinerary.weather_desc}</p>
            </div>
          </div>
        )}

        <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-slate-900 prose-h3:text-blue-700 prose-a:text-blue-600 prose-li:marker:text-slate-400">
          <MarkdownRenderer content={plan.markdown} />
        </div>

        {plan.sources && plan.sources.length > 0 && (
          <div className="mt-16 pt-8 border-t border-slate-200 no-print">
            <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest font-mono flex items-center gap-2">
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 text-xs hover:bg-white hover:shadow-md transition duration-300"
                >
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-slate-50/80 p-8 text-center text-slate-400 text-xs font-mono border-t border-slate-100 no-print">
        <p className="mb-2 uppercase tracking-wide opacity-70">{t.itinerary.footer_disclaimer}</p>
        <p>
           © Built with Love ❤️ by <a href="https://tenten.co/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">Tenten AI</a> | The Leading AI-First Agency in Asia
        </p>
      </div>

    </div>
  );
};

// Helper to extract destination from markdown if tripInput not available
function extractDestinationFromMarkdown(markdown: string): string {
  // Try to find destination in title or first heading
  const h1Match = markdown.match(/^#\s+(.+)/m);
  if (h1Match) {
    const title = h1Match[1];
    // Remove common suffixes like "行程", "Itinerary", etc.
    return title.replace(/(行程|旅行|旅程|Itinerary|Trip|Travel|Plan).*/gi, '').trim();
  }

  const h2Match = markdown.match(/^##\s+(.+)/m);
  if (h2Match) {
    return h2Match[1].replace(/(行程|旅行|Itinerary|Trip).*/gi, '').trim();
  }

  return 'My Trip';
}

export default ItineraryDisplay;
