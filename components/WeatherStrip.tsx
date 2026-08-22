import React from 'react';
import { Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets } from 'lucide-react';
import { TripWeather, Language } from '../types';

interface WeatherStripProps {
  weather: TripWeather;
  language: Language;
}

/**
 * Map WMO weather interpretation codes to an icon + accent color.
 */
function wmoIcon(code: number): { Icon: React.FC<any>; className: string } {
  if (code < 0) return { Icon: Cloud, className: 'text-slate-400' };
  if (code === 0) return { Icon: Sun, className: 'text-amber-500' };
  if (code === 1 || code === 2) return { Icon: CloudSun, className: 'text-amber-400' };
  if (code === 3) return { Icon: Cloud, className: 'text-slate-500' };
  if (code >= 45 && code <= 48) return { Icon: CloudFog, className: 'text-slate-400' };
  if (code >= 51 && code <= 57) return { Icon: CloudRain, className: 'text-sky-500' };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, className: 'text-sky-600' };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, className: 'text-blue-300' };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, className: 'text-sky-700' };
  if (code === 85 || code === 86) return { Icon: CloudSnow, className: 'text-blue-300' };
  if (code >= 95) return { Icon: CloudLightning, className: 'text-violet-500' };
  return { Icon: Cloud, className: 'text-slate-400' };
}

/**
 * Real per-day forecast strip rendered above the itinerary. Data comes from
 * /api/weather (Open-Meteo). Days beyond the forecast horizon are simply absent —
 * the LLM's table covers those as labeled climate estimates.
 */
const WeatherStrip: React.FC<WeatherStripProps> = ({ weather, language }) => {
  const locale = language === 'zh-CN' ? 'zh-CN' : language;
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="mx-6 md:mx-10 mb-8 no-print">
      <div className="flex items-center gap-2 mb-3">
        <Droplets className="w-4 h-4 text-sky-500" />
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em] font-mono">
          {weather.location.name} · Open-Meteo
        </h4>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {weather.days.map((d) => {
          const { Icon, className } = wmoIcon(d.code);
          // Parse YYYY-MM-DD as a local date (avoids UTC off-by-one)
          const [y, m, dd] = d.date.split('-').map(Number);
          const dateObj = new Date(y, m - 1, dd);
          const rainy = (d.precip_prob_pct ?? 0) >= 50;
          return (
            <div
              key={d.date}
              className={`flex-shrink-0 min-w-[104px] rounded-2xl border p-3 text-center transition-colors ${
                rainy
                  ? 'bg-sky-50/80 border-sky-100'
                  : 'bg-white border-slate-200/70 shadow-sm'
              }`}
              title={d.condition}
            >
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {fmtDay.format(dateObj)}
              </div>
              <Icon className={`w-6 h-6 mx-auto mb-1.5 ${className}`} aria-hidden />
              <div className="text-sm font-bold text-slate-800 leading-none mb-1">
                {d.temp_max_c !== null ? `${Math.round(d.temp_max_c)}°` : '—'}
                <span className="text-slate-400 font-medium">
                  {' / '}{d.temp_min_c !== null ? `${Math.round(d.temp_min_c)}°` : '—'}
                </span>
              </div>
              <div className={`text-[11px] font-medium ${rainy ? 'text-sky-600' : 'text-slate-400'}`}>
                {d.precip_prob_pct !== null ? `💧 ${d.precip_prob_pct}%` : d.condition}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherStrip;
