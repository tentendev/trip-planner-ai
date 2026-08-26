
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Language } from '../types';
import { parsePlanDays } from '../utils/exportCalendar';

interface DayNavProps {
  markdown: string;
  destination?: string;
  language: Language;
}

// Day ordinals need no plural rules (no singular/plural distinction), so an
// inline label table beats wiring Intl.PluralRules for eleven locales.
const DAY_LABELS: Record<Language, string> = {
  en: 'Day {n}',
  'zh-CN': '第{n}天',
  'zh-TW': '第{n}天',
  ja: '{n}日目',
  ko: '{n}일차',
  hi: 'दिन {n}',
  es: 'Día {n}',
  fr: 'Jour {n}',
  ar: 'اليوم {n}',
  pt: 'Dia {n}',
  ru: 'День {n}',
};

const dayLabel = (language: Language, n: number): string =>
  DAY_LABELS[language].replace('{n}', String(n));

// Sticky band sits below the ~72px app header; headings carry scroll-mt-28 so
// smooth scrolls land clear of both bars.
const SCROLL_MARGIN_BAND = '-110px 0px -60% 0px';

/**
 * Jump-to-day pill row for generated itineraries. Anchors are parsed from the
 * same markdown the renderer ids come from (utils/exportCalendar), so pills,
 * heading ids and calendar events can never disagree.
 */
const DayNav: React.FC<DayNavProps> = ({ markdown, destination, language }) => {
  const days = useMemo(() => parsePlanDays(markdown), [markdown]);
  const [activeAnchor, setActiveAnchor] = useState('');
  const visibleAnchorsRef = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    visibleAnchorsRef.current.clear();
    if (days.length === 0) return;

    // A day counts as "active" once its heading enters the band just below
    // the sticky nav; the first such day wins so sections activate top-down.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) visibleAnchorsRef.current.add(id);
          else visibleAnchorsRef.current.delete(id);
        }
        const topVisible = days.find((d) => visibleAnchorsRef.current.has(d.anchorId));
        if (topVisible) setActiveAnchor(topVisible.anchorId);
      },
      { rootMargin: SCROLL_MARGIN_BAND, threshold: 0 },
    );

    for (const day of days) {
      const el = document.getElementById(day.anchorId);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [days]);

  // Keep the highlighted pill inside a long horizontally-scrolled strip.
  useEffect(() => {
    if (!activeAnchor || !listRef.current) return;
    const pill = listRef.current.querySelector(`[data-anchor="${activeAnchor}"]`);
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeAnchor]);

  if (days.length < 2) {
    // One day needs no navigation; also avoids a flash during early streaming.
    return null;
  }

  const scrollToDay = (anchorId: string) => {
    setActiveAnchor(anchorId);
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openInMaps = (query: string) => {
    if (!query) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className="no-print sticky top-[76px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
      <div ref={listRef} className="flex items-center gap-2 px-5 md:px-12 py-3 overflow-x-auto">
        {days.map((day) => {
          const isActive = day.anchorId === activeAnchor;
          const label = dayLabel(language, day.index);
          const mapsQuery = [destination, day.activities[0]].filter(Boolean).join(' ');
          return (
            <div
              key={day.anchorId}
              data-anchor={day.anchorId}
              className={`flex items-center rounded-full flex-shrink-0 transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <button
                onClick={() => scrollToDay(day.anchorId)}
                aria-current={isActive ? 'true' : undefined}
                title={day.title}
                className="pl-3.5 pr-1 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer"
              >
                {label}
              </button>
              <span
                className={`w-px h-3.5 ${isActive ? 'bg-white/40' : 'bg-slate-200 dark:bg-slate-700'}`}
                aria-hidden
              />
              <button
                onClick={() => openInMaps(mapsQuery)}
                aria-label={`Open ${day.title} on Google Maps`}
                title={mapsQuery || day.title}
                className={`p-1.5 mr-1 rounded-full cursor-pointer transition-colors ${
                  isActive ? 'hover:bg-white/20' : 'hover:bg-slate-200/80'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayNav;
