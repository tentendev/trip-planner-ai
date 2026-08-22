
import React from 'react';
import { Plane, Languages, Sparkles, MapPin } from 'lucide-react';
import { Language } from '../types';

interface SocialProofProps {
  language: Language;
}

// Honest capability badges. Every claim here must be verifiable in the product:
// real flight/hotel data comes from Google Flights/Hotels via SerpAPI, the UI ships
// 11 languages, and planning is free with no account required. No fabricated usage
// counters or review scores — those destroyed credibility, and faking them for a
// new product is a trust (and potentially legal) liability.
const SOCIAL_PROOF_TRANSLATIONS: Record<Language, {
  liveData: string;
  liveDataSub: string;
  languages: string;
  languagesSub: string;
  free: string;
  freeSub: string;
  topDestinations: string;
}> = {
  'en': {
    liveData: 'Live flights & hotels',
    liveDataSub: 'Google data',
    languages: '11 languages',
    languagesSub: 'AI itineraries',
    free: 'Free',
    freeSub: 'No sign-up',
    topDestinations: 'Popular now',
  },
  'zh-TW': {
    liveData: '即時航班與飯店',
    liveDataSub: 'Google 數據',
    languages: '11 種語言',
    languagesSub: 'AI 行程規劃',
    free: '免費',
    freeSub: '無需註冊',
    topDestinations: '熱門目的地',
  },
  'zh-CN': {
    liveData: '实时航班与酒店',
    liveDataSub: 'Google 数据',
    languages: '11 种语言',
    languagesSub: 'AI 行程规划',
    free: '免费',
    freeSub: '无需注册',
    topDestinations: '热门目的地',
  },
  'ja': {
    liveData: 'リアルタイム航空券・ホテル',
    liveDataSub: 'Google データ',
    languages: '11言語対応',
    languagesSub: 'AI旅程プラン',
    free: '無料',
    freeSub: '登録不要',
    topDestinations: '人気の目的地',
  },
  'ko': {
    liveData: '실시간 항공·호텔',
    liveDataSub: 'Google 데이터',
    languages: '11개 언어',
    languagesSub: 'AI 여행 일정',
    free: '무료',
    freeSub: '가입 불필요',
    topDestinations: '인기 여행지',
  },
  'es': {
    liveData: 'Vuelos y hoteles en vivo',
    liveDataSub: 'Datos de Google',
    languages: '11 idiomas',
    languagesSub: 'Itinerarios con IA',
    free: 'Gratis',
    freeSub: 'Sin registro',
    topDestinations: 'Populares ahora',
  },
  'fr': {
    liveData: 'Vols et hôtels en direct',
    liveDataSub: 'Données Google',
    languages: '11 langues',
    languagesSub: 'Itinéraires IA',
    free: 'Gratuit',
    freeSub: 'Sans inscription',
    topDestinations: 'Populaires',
  },
  'hi': {
    liveData: 'लाइव फ्लाइट और होटल',
    liveDataSub: 'Google डेटा',
    languages: '11 भाषाएं',
    languagesSub: 'AI यात्रा योजना',
    free: 'मुफ़्त',
    freeSub: 'साइन-अप नहीं',
    topDestinations: 'लोकप्रिय',
  },
  'ar': {
    liveData: 'رحلات طيران وفنادق مباشرة',
    liveDataSub: 'بيانات Google',
    languages: '11 لغة',
    languagesSub: 'خط سير بالذكاء الاصطناعي',
    free: 'مجاني',
    freeSub: 'بدون تسجيل',
    topDestinations: 'الوجهات الشائعة',
  },
  'pt': {
    liveData: 'Voos e hotéis ao vivo',
    liveDataSub: 'Dados do Google',
    languages: '11 idiomas',
    languagesSub: 'Roteiros com IA',
    free: 'Grátis',
    freeSub: 'Sem cadastro',
    topDestinations: 'Populares agora',
  },
  'ru': {
    liveData: 'Рейсы и отели в реальном времени',
    liveDataSub: 'Данные Google',
    languages: '11 языков',
    languagesSub: 'ИИ-маршруты',
    free: 'Бесплатно',
    freeSub: 'Без регистрации',
    topDestinations: 'Популярные направления',
  },
};

// Top destinations by language/region (suggestion chips, not a usage claim)
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

const SocialProof: React.FC<SocialProofProps> = ({ language }) => {
  const t = SOCIAL_PROOF_TRANSLATIONS[language] || SOCIAL_PROOF_TRANSLATIONS['en'];
  const destinations = TOP_DESTINATIONS[language] || TOP_DESTINATIONS['en'];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-sm text-slate-600">
        {/* Live travel data */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
          <Plane className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-slate-900">{t.liveData}</span>
          <span className="text-xs text-slate-400 hidden md:inline">({t.liveDataSub})</span>
        </div>

        {/* Languages */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
          <Languages className="w-4 h-4 text-violet-600" />
          <span className="font-semibold text-slate-900">{t.languages}</span>
          <span className="text-xs text-slate-400 hidden md:inline">({t.languagesSub})</span>
        </div>

        {/* Free */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-900">{t.free}</span>
          <span className="text-xs text-slate-400 hidden md:inline">({t.freeSub})</span>
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
