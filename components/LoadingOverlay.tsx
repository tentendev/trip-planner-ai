
import React, { useState, useEffect, useRef } from 'react';
import { Globe, Plane, CircleStop } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import MarkdownRenderer from './MarkdownRenderer';

interface LoadingOverlayProps {
  language: Language;
  /** Accumulated markdown so far — switches the overlay into live-preview mode. */
  partialMarkdown?: string;
  /** Milliseconds since generation started; App ticks this once per second. */
  elapsedMs?: number;
  /** Present => show Stop. Aborts generation; App resets to idle without an error. */
  onCancel?: () => void;
}

// Kept local (not in i18n.ts): a single word per locale doesn't justify widening the
// shared translation surface, and the task scope reserves i18n edits.
const STOP_LABELS: Record<Language, string> = {
  en: 'Stop',
  'zh-TW': '停止',
  'zh-CN': '停止',
  ja: '停止',
  ko: '정지',
  hi: 'रोकें',
  es: 'Detener',
  fr: 'Arrêter',
  ar: 'إيقاف',
  pt: 'Parar',
  ru: 'Стоп',
};

// Distance (px) from the pane bottom within which we still treat the user as "stuck
// to bottom" and keep auto-scrolling as content grows.
const STICK_THRESHOLD_PX = 48;

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ language, partialMarkdown, elapsedMs, onCancel }) => {
  const t = TRANSLATIONS[language];
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');

  const previewPaneRef = useRef<HTMLDivElement>(null);
  // Ref (not state): stickiness must not trigger re-renders, only read scroll events.
  const stickToBottomRef = useRef(true);

  const hasPreview = !!partialMarkdown && partialMarkdown.trim().length > 0;

  // Rotate through loading tips (pre-stream phase only; preview replaces them).
  useEffect(() => {
    if (hasPreview) return;
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % t.loading.tips.length);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, [t.loading.tips.length, hasPreview]);

  // Animate dots
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  // Follow the growing content while the user hasn't scrolled up to inspect it.
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [partialMarkdown]);

  const handlePreviewScroll = () => {
    const el = previewPaneRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  };

  const totalSeconds = Math.floor((elapsedMs ?? 0) / 1000);
  const clockLabel = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;

  const stopButton = onCancel ? (
    <button
      type="button"
      onClick={onCancel}
      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 border-red-300 bg-white text-red-600 font-semibold text-sm hover:bg-red-50 hover:border-red-400 active:scale-[0.98] transition shadow-sm"
    >
      <CircleStop className="w-4 h-4" strokeWidth={2.25} />
      {STOP_LABELS[language] || STOP_LABELS.en}
    </button>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
      {hasPreview ? (
        /* ---------- Streaming phase: compact header + live preview pane ---------- */
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-5 md:p-7 max-w-lg md:max-w-2xl w-full mx-4 text-left border border-white/20 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
          {/* Compact loader header */}
          <div className="flex items-center gap-4 mb-4 flex-none">
            {/* Mini compass instrument — same animations as the full-size one */}
            <div className="relative w-14 h-14 flex-none" aria-hidden="true">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300/70 loader-ring" />
              <div className="loader-orbit absolute inset-0">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0.5 shadow-sm shadow-blue-200/80 ring-1 ring-slate-100">
                  <Plane className="w-3 h-3 text-blue-600 rotate-45" strokeWidth={2.25} />
                </div>
              </div>
              <div className="loader-badge absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30 ring-2 ring-white/60">
                  <Globe className="w-4 h-4 text-white/90" strokeWidth={1.75} />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">
                {t.loading.title}
              </h2>
              <p className="text-slate-500 font-mono text-xs truncate">
                {t.loading.subtitle}<span className="inline-block w-4">{dots}</span>
              </p>
            </div>

            {/* Elapsed timer — the honest heartbeat of the run */}
            <div className="text-right flex-none">
              <span className="block font-mono text-3xl md:text-4xl font-bold text-slate-800 tabular-nums leading-none tracking-tight">
                {clockLabel}
              </span>
            </div>
          </div>

          {/* Thin progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4 flex-none">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-loading-bar" />
          </div>

          {/* Live preview — content grows in real time */}
          <div className="flex flex-col min-h-0 flex-1">
            <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-2 font-mono">
              Live Preview
            </p>
            <div
              ref={previewPaneRef}
              onScroll={handlePreviewScroll}
              className="max-h-[40vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5"
              aria-live="polite"
            >
              <MarkdownRenderer content={partialMarkdown!} />
            </div>
          </div>

          {/* Footer: estimate + Stop */}
          <div className="mt-5 flex items-center justify-between gap-4 flex-none">
            <p className="text-xs text-slate-400 font-mono">
              {t.loading.estimated_time}
            </p>
            {stopButton}
          </div>
        </div>
      ) : (
        /* ---------- Pre-stream phase: original centered experience ---------- */
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 max-w-md mx-4 text-center border border-white/20">
          {/* Compass loader — plane circling a breathing globe (pure CSS, see index.css) */}
          <div className="relative w-40 h-40 mx-auto mb-6" aria-hidden="true">
            {/* Soft ambient glow behind the whole instrument */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-blue-200/60 via-purple-100/50 to-pink-200/50 blur-2xl" />

            {/* Dashed outer ring drifting counter-clockwise */}
            <div className="loader-ring absolute inset-0">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300/70" />
            </div>

            {/* Orbit carrying the plane clockwise around the globe */}
            <div className="loader-orbit absolute inset-0">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1.5 shadow-md shadow-blue-200/80 ring-1 ring-slate-100">
                <Plane className="w-5 h-5 text-blue-600 rotate-45" strokeWidth={2.25} />
              </div>
            </div>

            {/* Globe gently breathing at the center */}
            <div className="loader-badge absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-white/60">
                <Globe className="w-9 h-9 text-white/90" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          {/* Main Loading Text */}
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
            {t.loading.title}
          </h2>

          {/* Subtitle with animated dots */}
          <p className="text-slate-500 mb-6 font-mono text-sm">
            {t.loading.subtitle}<span className="inline-block w-6 text-left">{dots}</span>
          </p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-loading-bar" />
          </div>

          {/* Rotating Tips */}
          <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-100">
            <p className="text-xs text-blue-400 uppercase tracking-wider font-bold mb-2">
              {t.loading.tip_label}
            </p>
            <p className="text-sm text-blue-700 leading-relaxed transition-all duration-500">
              {t.loading.tips[tipIndex]}
            </p>
          </div>

          {/* Footer: estimate + Stop */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400 font-mono text-left">
              {t.loading.estimated_time}
            </p>
            {stopButton}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;
