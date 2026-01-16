
import React, { useState, useEffect } from 'react';
import { TrendingUp, MapPin, Users, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface SocialProofProps {
  language: Language;
}

// Translations for social proof section
const SOCIAL_PROOF_TRANSLATIONS: Record<Language, {
  tripsPlanned: string;
  inLast24Hours: string;
  topDestinations: string;
  activeUsers: string;
  planningNow: string;
  satisfactionRate: string;
  basedOn: string;
  reviews: string;
}> = {
  'en': {
    tripsPlanned: 'trips planned',
    inLast24Hours: 'in last 24 hours',
    topDestinations: 'Top destinations',
    activeUsers: 'users',
    planningNow: 'planning now',
    satisfactionRate: 'satisfaction',
    basedOn: 'based on',
    reviews: 'reviews',
  },
  'zh-TW': {
    tripsPlanned: '趟旅程已規劃',
    inLast24Hours: '過去 24 小時',
    topDestinations: '熱門目的地',
    activeUsers: '位用戶',
    planningNow: '正在規劃中',
    satisfactionRate: '滿意度',
    basedOn: '基於',
    reviews: '則評價',
  },
  'zh-CN': {
    tripsPlanned: '趟旅程已规划',
    inLast24Hours: '过去 24 小时',
    topDestinations: '热门目的地',
    activeUsers: '位用户',
    planningNow: '正在规划中',
    satisfactionRate: '满意度',
    basedOn: '基于',
    reviews: '则评价',
  },
  'ja': {
    tripsPlanned: '件の旅程を作成',
    inLast24Hours: '過去24時間',
    topDestinations: '人気の目的地',
    activeUsers: '人のユーザー',
    planningNow: 'が計画中',
    satisfactionRate: '満足度',
    basedOn: '',
    reviews: '件の評価に基づく',
  },
  'ko': {
    tripsPlanned: '건의 여행 계획 완료',
    inLast24Hours: '지난 24시간',
    topDestinations: '인기 여행지',
    activeUsers: '명의 사용자',
    planningNow: '가 계획 중',
    satisfactionRate: '만족도',
    basedOn: '',
    reviews: '개의 리뷰 기반',
  },
  'es': {
    tripsPlanned: 'viajes planificados',
    inLast24Hours: 'últimas 24 horas',
    topDestinations: 'Destinos populares',
    activeUsers: 'usuarios',
    planningNow: 'planificando ahora',
    satisfactionRate: 'satisfacción',
    basedOn: 'basado en',
    reviews: 'reseñas',
  },
  'fr': {
    tripsPlanned: 'voyages planifiés',
    inLast24Hours: 'dernières 24 heures',
    topDestinations: 'Destinations populaires',
    activeUsers: 'utilisateurs',
    planningNow: 'planifient maintenant',
    satisfactionRate: 'satisfaction',
    basedOn: 'basé sur',
    reviews: 'avis',
  },
  'hi': {
    tripsPlanned: 'यात्राएं योजनाबद्ध',
    inLast24Hours: 'पिछले 24 घंटों में',
    topDestinations: 'लोकप्रिय गंतव्य',
    activeUsers: 'उपयोगकर्ता',
    planningNow: 'अभी योजना बना रहे हैं',
    satisfactionRate: 'संतुष्टि',
    basedOn: 'पर आधारित',
    reviews: 'समीक्षाएं',
  },
  'ar': {
    tripsPlanned: 'رحلة تم التخطيط لها',
    inLast24Hours: 'خلال 24 ساعة الماضية',
    topDestinations: 'الوجهات الشائعة',
    activeUsers: 'مستخدم',
    planningNow: 'يخططون الآن',
    satisfactionRate: 'رضا',
    basedOn: 'بناءً على',
    reviews: 'تقييم',
  },
  'pt': {
    tripsPlanned: 'viagens planejadas',
    inLast24Hours: 'últimas 24 horas',
    topDestinations: 'Destinos populares',
    activeUsers: 'usuários',
    planningNow: 'planejando agora',
    satisfactionRate: 'satisfação',
    basedOn: 'baseado em',
    reviews: 'avaliações',
  },
  'ru': {
    tripsPlanned: 'путешествий спланировано',
    inLast24Hours: 'за последние 24 часа',
    topDestinations: 'Популярные направления',
    activeUsers: 'пользователей',
    planningNow: 'планируют сейчас',
    satisfactionRate: 'удовлетворенность',
    basedOn: 'на основе',
    reviews: 'отзывов',
  },
};

// Top destinations by language/region
const TOP_DESTINATIONS: Record<Language, string[]> = {
  'en': ['Tokyo', 'Paris', 'Bali', 'Seoul', 'Bangkok'],
  'zh-TW': ['東京', '京都', '大阪', '首爾', '曼谷'],
  'zh-CN': ['东京', '京都', '大阪', '首尔', '曼谷'],
  'ja': ['京都', '沖縄', '北海道', 'ソウル', '台北'],
  'ko': ['도쿄', '오사카', '방콕', '다낭', '파리'],
  'es': ['Barcelona', 'París', 'Roma', 'Tokio', 'Bali'],
  'fr': ['Tokyo', 'New York', 'Bali', 'Rome', 'Barcelone'],
  'hi': ['दुबई', 'बैंकॉक', 'सिंगापुर', 'बाली', 'पेरिस'],
  'ar': ['دبي', 'إسطنبول', 'باريس', 'لندن', 'بانكوك'],
  'pt': ['Lisboa', 'Paris', 'Tóquio', 'Bali', 'Barcelona'],
  'ru': ['Париж', 'Токио', 'Бали', 'Стамбул', 'Дубай'],
};

// Simulated live counter (in production, this would come from analytics)
function useAnimatedCounter(target: number, duration: number = 2000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = Math.floor(target * 0.7); // Start from 70%

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (target - startValue) * easeOut);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

// Generate pseudo-random but consistent numbers based on current hour
function getStats() {
  const now = new Date();
  const hourSeed = now.getHours() + now.getDate() * 24;

  // Trips in last 24h: 2000-4000
  const tripsBase = 2000 + (hourSeed % 20) * 100;
  const trips = tripsBase + Math.floor(Math.random() * 500);

  // Active users: 50-150
  const usersBase = 50 + (hourSeed % 10) * 10;
  const activeUsers = usersBase + Math.floor(Math.random() * 30);

  // Reviews: 10000-15000
  const reviews = 10000 + (hourSeed % 50) * 100;

  return { trips, activeUsers, reviews };
}

const SocialProof: React.FC<SocialProofProps> = ({ language }) => {
  const t = SOCIAL_PROOF_TRANSLATIONS[language] || SOCIAL_PROOF_TRANSLATIONS['en'];
  const destinations = TOP_DESTINATIONS[language] || TOP_DESTINATIONS['en'];

  const [stats] = useState(getStats);
  const animatedTrips = useAnimatedCounter(stats.trips);
  const animatedUsers = useAnimatedCounter(stats.activeUsers, 1500);

  // Pulse effect for active users
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-slate-600">
        {/* Trips Counter */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="font-semibold text-slate-900">{animatedTrips.toLocaleString()}</span>
          <span className="text-slate-500">{t.tripsPlanned}</span>
          <span className="text-xs text-slate-400 hidden md:inline">({t.inLast24Hours})</span>
        </div>

        {/* Active Users */}
        <div className={`flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm transition-all duration-300 ${pulse ? 'scale-105 ring-2 ring-blue-300' : ''}`}>
          <Users className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-slate-900">{animatedUsers}</span>
          <span className="text-slate-500">{t.activeUsers}</span>
          <span className="text-xs text-slate-400 hidden md:inline">{t.planningNow}</span>
        </div>

        {/* Satisfaction Rate */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-slate-900">4.8/5</span>
          <span className="text-slate-500">{t.satisfactionRate}</span>
          <span className="text-xs text-slate-400 hidden md:inline">({stats.reviews.toLocaleString()} {t.reviews})</span>
        </div>
      </div>

      {/* Top Destinations */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-rose-500" />
        <span className="text-slate-500">{t.topDestinations}:</span>
        <div className="flex flex-wrap justify-center gap-2">
          {destinations.map((dest, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-gradient-to-r from-blue-50 to-purple-50 text-slate-700 rounded-full text-xs font-medium border border-white/50"
            >
              {dest}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SocialProof;
