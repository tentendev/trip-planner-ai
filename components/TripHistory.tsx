
import React, { useState } from 'react';
import { History, MapPin, Trash2, ChevronRight } from 'lucide-react';
import { Language } from '../types';
import { TripHistoryEntry, formatSavedAt, deleteTripFromHistory } from '../utils/tripHistory';

interface TripHistoryProps {
  entries: TripHistoryEntry[];
  language: Language;
  onOpen: (entry: TripHistoryEntry) => void;
  onChanged: () => void;
}

const LABELS: Record<Language, { title: string; empty: string; open: string }> = {
  'en': { title: 'Your trips', open: 'Open', empty: 'No trips yet' },
  'zh-TW': { title: '你的旅程', open: '開啟', empty: '尚無旅程' },
  'zh-CN': { title: '你的旅程', open: '打开', empty: '暂无旅程' },
  'ja': { title: 'あなたの旅', open: '開く', empty: '旅はまだありません' },
  'ko': { title: '나의 여행', open: '열기', empty: '아직 여행이 없습니다' },
  'es': { title: 'Tus viajes', open: 'Abrir', empty: 'Aún no hay viajes' },
  'fr': { title: 'Vos voyages', open: 'Ouvrir', empty: 'Aucun voyage pour le moment' },
  'pt': { title: 'Suas viagens', open: 'Abrir', empty: 'Ainda sem viagens' },
  'ru': { title: 'Ваши поездки', open: 'Открыть', empty: 'Пока нет поездок' },
  'ar': { title: 'رحلاتك', open: 'فتح', empty: 'لا توجد رحلات بعد' },
  'hi': { title: 'आपकी यात्राएँ', open: 'खोलें', empty: 'अभी कोई यात्रा नहीं' },
};

/**
 * "My Trips" dashboard row (TripIt's trips-list pattern). Restores a past plan
 * instantly from local storage — planning trip #2 no longer erases trip #1.
 */
const TripHistory: React.FC<TripHistoryProps> = ({ entries, language, onOpen, onChanged }) => {
  const t = LABELS[language] || LABELS.en;
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  return (
    <div className="mt-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 mb-3 justify-center">
        <History className="w-4 h-4 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em] font-mono">
          {t.title}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => (
          <div
            key={e.id}
            className="group relative bg-white/70 backdrop-blur-sm border border-slate-200/70 rounded-2xl p-4 text-start hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
            onClick={() => onOpen(e)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') onOpen(e); }}
          >
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 mt-0.5 text-rose-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 text-sm truncate">{e.destination}</div>
                <div className="text-xs text-slate-400 truncate">{e.dates || formatSavedAt(e.savedAt, language)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
            </div>
            <button
              type="button"
              aria-label="delete"
              onClick={(ev) => {
                ev.stopPropagation();
                if (confirmId === e.id) {
                  deleteTripFromHistory(e.id);
                  setConfirmId(null);
                  onChanged();
                } else {
                  setConfirmId(e.id);
                  setTimeout(() => setConfirmId((cur) => (cur === e.id ? null : cur)), 2500);
                }
              }}
              className={`absolute top-3 end-3 p-1.5 rounded-lg transition-all ${
                confirmId === e.id
                  ? 'bg-red-100 text-red-600'
                  : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TripHistory;
