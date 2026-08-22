
import React, { useState, useEffect } from 'react';
import { Globe, Plane } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface LoadingOverlayProps {
  language: Language;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');

  // Rotate through loading tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % t.loading.tips.length);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, [t.loading.tips.length]);

  // Animate dots
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
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

        {/* Estimated time */}
        <p className="text-xs text-slate-400 mt-6 font-mono">
          {t.loading.estimated_time}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
