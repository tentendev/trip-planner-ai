import React from 'react';
import {
  Hotel,
  Star,
  ExternalLink,
  MapPin,
  Sparkles,
  Gem,
  Wallet,
  Coins,
} from 'lucide-react';
import { HotelOffer, TravelSearchParams, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface HotelOffersSectionProps {
  hotels: HotelOffer[];
  searchParams?: TravelSearchParams;
  language: Language;
}

function formatPrice(price: number, currency: string, lang?: string): string {
  if (!price) return '—';
  try {
    return new Intl.NumberFormat(lang || 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

type Tier = 'budget' | 'mid' | 'luxury';

/**
 * Deterministically assign price tiers by quantile of price_per_night.
 */
function computeTiers(hotels: HotelOffer[]): Map<number, Tier> {
  const prices = hotels.map((h) => h.price_per_night || 0).filter((p) => p > 0);
  const map = new Map<number, Tier>();
  if (prices.length < 2) {
    hotels.forEach((h) => map.set(h.rank, 'mid'));
    return map;
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.33)];
  const q2 = sorted[Math.floor(sorted.length * 0.67)];

  hotels.forEach((h) => {
    const p = h.price_per_night || 0;
    if (p === 0) map.set(h.rank, 'mid');
    else if (p <= q1) map.set(h.rank, 'budget');
    else if (p <= q2) map.set(h.rank, 'mid');
    else map.set(h.rank, 'luxury');
  });
  return map;
}

const TierBadge: React.FC<{ tier: Tier; label: string }> = ({ tier, label }) => {
  const styles: Record<Tier, { bg: string; fg: string; icon: React.ReactNode }> = {
    budget: {
      bg: 'bg-emerald-50 border-emerald-200',
      fg: 'text-emerald-700',
      icon: <Wallet className="w-3 h-3" />,
    },
    mid: {
      bg: 'bg-blue-50 border-blue-200',
      fg: 'text-blue-700',
      icon: <Coins className="w-3 h-3" />,
    },
    luxury: {
      bg: 'bg-violet-50 border-violet-200',
      fg: 'text-violet-700',
      icon: <Gem className="w-3 h-3" />,
    },
  };
  const s = styles[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${s.bg} ${s.fg}`}
    >
      {s.icon}
      {label}
    </span>
  );
};

const StarRating: React.FC<{ rating: number; reviews?: number }> = ({ rating, reviews }) => (
  <div className="flex items-center gap-1 text-[11px]">
    <span className="flex items-center gap-0.5 text-amber-500">
      <Star className="w-3 h-3 fill-current" />
      <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
    </span>
    {typeof reviews === 'number' && reviews > 0 && (
      <span className="text-slate-400">({reviews.toLocaleString()})</span>
    )}
  </div>
);

function googleHotelsUrl(p?: TravelSearchParams): string | null {
  if (!p?.dest_name || !p?.check_in || !p?.check_out) return null;
  const q = encodeURIComponent(`${p.dest_name} hotels`);
  return `https://www.google.com/travel/hotels?q=${q}&checkin=${p.check_in}&checkout=${p.check_out}&adults=${p.adults || 2}`;
}

const HotelOffersSection: React.FC<HotelOffersSectionProps> = ({
  hotels,
  searchParams,
  language,
}) => {
  if (!hotels || hotels.length === 0) return null;
  const t = (TRANSLATIONS as any)[language]?.hotelOffers || (TRANSLATIONS as any).en.hotelOffers;
  const tiers = computeTiers(hotels);
  const ghUrl = googleHotelsUrl(searchParams);

  const tierLabels: Record<Tier, string> = {
    budget: t.tierBudget,
    mid: t.tierMid,
    luxury: t.tierLuxury,
  };

  return (
    <section className="no-print px-6 md:px-10 py-8 md:py-10 border-b border-slate-100">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shadow-rose-500/20">
            <Hotel className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              {t.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-pink-500" />
              {t.subtitle}
              {searchParams?.dest_name && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">{searchParams.dest_name}</span>
                </>
              )}
              {searchParams?.check_in && searchParams?.check_out && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600">
                    {searchParams.check_in} → {searchParams.check_out}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {ghUrl && (
          <a
            href={ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-white transition"
          >
            {t.seeMore} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {hotels.map((h) => {
          const tier = tiers.get(h.rank) || 'mid';
          return (
            <article
              key={h.rank}
              className="group bg-white rounded-2xl border border-slate-200/70 overflow-hidden hover:border-slate-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)] transition-all flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                {h.thumbnail ? (
                  <img
                    src={h.thumbnail}
                    alt={h.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Hotel className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <TierBadge tier={tier} label={tierLabels[tier]} />
                </div>
                {h.hotel_class && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
                    {h.hotel_class}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-semibold text-slate-900 text-[15px] leading-tight line-clamp-2 mb-1.5">
                  {h.name}
                </h4>

                {h.rating && <StarRating rating={h.rating} reviews={h.reviews} />}

                {h.nearby && h.nearby.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      {h.nearby.slice(0, 2).map((n, i) => (
                        <div key={i} className="truncate">
                          {n.name}
                          {n.walk && <span className="text-slate-400"> · {t.walk} {n.walk}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {h.amenities && h.amenities.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {h.amenities.slice(0, 3).map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">
                      {h.price_per_night
                        ? formatPrice(h.price_per_night, h.currency, language)
                        : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {t.perNight}
                      {h.total_price && (
                        <>
                          {' · '}
                          {t.total}: {formatPrice(h.total_price, h.currency, language)}
                        </>
                      )}
                    </div>
                  </div>

                  {h.link && (
                    <a
                      href={h.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors flex-shrink-0"
                    >
                      {t.bookNow}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default HotelOffersSection;
