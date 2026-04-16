import React from 'react';
import {
  Plane,
  ArrowRight,
  Clock,
  Leaf,
  ExternalLink,
  Zap,
  DollarSign,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { FlightOffer, TravelSearchParams, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface FlightOffersSectionProps {
  flights: FlightOffer[];
  searchParams?: TravelSearchParams;
  priceInsights?: { lowest?: number; typical_range?: number[]; price_level?: string };
  language: Language;
}

/**
 * Format a "YYYY-MM-DD HH:mm" string into HH:mm (local time as-provided).
 */
function formatTime(dt: string): string {
  const m = dt?.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

/**
 * Format a "YYYY-MM-DD HH:mm" string to short date like "5/15".
 */
function formatShortDate(dt: string, lang: Language): string {
  const m = dt?.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return d.toLocaleDateString(lang, { month: 'numeric', day: 'numeric' });
}

function formatDuration(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPrice(price: number, currency: string): string {
  if (!price) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

/**
 * Compute deterministic pick badges based on the set.
 */
function computeBadges(flights: FlightOffer[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  flights.forEach((f) => map.set(f.rank, []));

  if (flights.length === 0) return map;

  const cheapest = flights.reduce((a, b) => (a.price < b.price ? a : b));
  const fastest = flights.reduce((a, b) => (a.duration_min < b.duration_min ? a : b));

  map.get(flights[0].rank)!.push('best');
  if (cheapest.rank !== flights[0].rank) map.get(cheapest.rank)!.push('cheapest');
  if (fastest.rank !== flights[0].rank && fastest.rank !== cheapest.rank) {
    map.get(fastest.rank)!.push('fastest');
  }

  return map;
}

const BadgeTag: React.FC<{ kind: string; label: string }> = ({ kind, label }) => {
  const map: Record<string, { bg: string; fg: string; icon: React.ReactNode }> = {
    best: {
      bg: 'bg-gradient-to-r from-amber-400 to-orange-500',
      fg: 'text-white',
      icon: <Trophy className="w-3 h-3" />,
    },
    cheapest: {
      bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
      fg: 'text-white',
      icon: <DollarSign className="w-3 h-3" />,
    },
    fastest: {
      bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      fg: 'text-white',
      icon: <Zap className="w-3 h-3" />,
    },
  };
  const style = map[kind] || map.best;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${style.bg} ${style.fg} shadow-sm`}
    >
      {style.icon}
      {label}
    </span>
  );
};

function googleFlightsUrl(p?: TravelSearchParams): string | null {
  if (!p?.origin_iata || !p?.dest_iata || !p?.check_in) return null;
  const parts = [
    `flights from ${p.origin_iata} to ${p.dest_iata}`,
    `on ${p.check_in}`,
  ];
  if (p.check_out) parts.push(`return ${p.check_out}`);
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`;
}

const FlightOffersSection: React.FC<FlightOffersSectionProps> = ({
  flights,
  searchParams,
  priceInsights,
  language,
}) => {
  if (!flights || flights.length === 0) return null;
  const t = (TRANSLATIONS as any)[language]?.flightOffers || (TRANSLATIONS as any).en.flightOffers;
  const badges = computeBadges(flights);
  const gfUrl = googleFlightsUrl(searchParams);

  return (
    <section className="no-print px-6 md:px-10 py-8 md:py-10 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-sky-500/20">
            <Plane className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              {t.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              {t.subtitle}
              {searchParams?.origin_iata && searchParams?.dest_iata && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600">
                    {searchParams.origin_iata} → {searchParams.dest_iata}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {gfUrl && (
          <a
            href={gfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-white transition"
          >
            {t.seeMore} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {priceInsights?.lowest && (
        <div className="mb-4 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
          {priceInsights.typical_range && (
            <span>
              {t.typicalRange}:{' '}
              <span className="font-mono text-slate-700">
                {formatPrice(priceInsights.typical_range[0], flights[0].currency)} –{' '}
                {formatPrice(priceInsights.typical_range[1], flights[0].currency)}
              </span>
            </span>
          )}
          {priceInsights.price_level && (
            <>
              <span className="text-slate-300">·</span>
              <span className="capitalize">{priceInsights.price_level} prices</span>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {flights.map((f) => {
          const offerBadges = badges.get(f.rank) || [];
          const first = f.segments[0];
          const last = f.segments[f.segments.length - 1];
          if (!first || !last) return null;

          return (
            <article
              key={f.rank}
              className="group relative bg-white rounded-2xl border border-slate-200/70 p-4 md:p-5 hover:border-slate-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.06)] transition-all"
            >
              {/* Badges */}
              {offerBadges.length > 0 && (
                <div className="absolute -top-2 left-4 flex gap-1.5">
                  {offerBadges.map((b) => (
                    <BadgeTag
                      key={b}
                      kind={b}
                      label={b === 'best' ? t.badgeBest : b === 'cheapest' ? t.badgeCheapest : t.badgeFastest}
                    />
                  ))}
                </div>
              )}

              {/* Airline + logo row */}
              <div className="flex items-center gap-2.5 mb-4">
                {f.airline_logo ? (
                  <img
                    src={f.airline_logo}
                    alt={f.airlines.join(' ')}
                    className="w-7 h-7 rounded-md object-contain bg-white border border-slate-100"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                    <Plane className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {f.airlines.join(' + ')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {f.segments.map((s) => s.flight_number).filter(Boolean).join(' · ')}
                  </div>
                </div>
                {f.type && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {f.type}
                  </span>
                )}
              </div>

              {/* Route timeline */}
              <div className="flex items-center gap-2 md:gap-3 mb-4">
                <div className="text-center">
                  <div className="text-2xl md:text-[26px] font-bold text-slate-900 leading-none font-mono">
                    {formatTime(first.from_time)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1 tracking-wider">
                    {first.from_code}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {formatShortDate(first.from_time, language)}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center px-2 min-w-0">
                  <div className="text-[10px] text-slate-400 mb-1 font-medium">
                    {formatDuration(f.duration_min)}
                  </div>
                  <div className="relative w-full flex items-center">
                    <div className="flex-1 h-px bg-slate-200" />
                    <Plane className="w-3 h-3 text-slate-400 mx-1 rotate-90" />
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="text-[10px] mt-1">
                    {f.stops === 0 ? (
                      <span className="text-emerald-600 font-semibold">{t.direct}</span>
                    ) : (
                      <span className="text-slate-500">
                        {f.stops} {f.stops === 1 ? t.stop : t.stops}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl md:text-[26px] font-bold text-slate-900 leading-none font-mono">
                    {formatTime(last.to_time)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1 tracking-wider">
                    {last.to_code}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {formatShortDate(last.to_time, language)}
                  </div>
                </div>
              </div>

              {/* Layovers detail */}
              {f.layovers && f.layovers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 text-[10px]">
                  {f.layovers.map((l, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {t.layover} {l.airport} · {formatDuration(l.duration_min)}
                      {l.overnight && ` · ${t.overnight}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer row */}
              <div className="flex items-end justify-between pt-3 border-t border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">{t.totalPrice}</div>
                  <div className="text-xl md:text-2xl font-bold text-slate-900 tabular-nums">
                    {formatPrice(f.price, f.currency)}
                  </div>
                  {f.carbon_kg && (
                    <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                      <Leaf className="w-2.5 h-2.5" />
                      {f.carbon_kg} kg CO₂
                    </div>
                  )}
                </div>

                {gfUrl && (
                  <a
                    href={gfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    {t.bookNow}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default FlightOffersSection;
