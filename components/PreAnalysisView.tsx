
import React, { useState } from 'react';
import { PreAnalysisQuestion, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { Sparkles, ChevronRight, CheckCircle2, SkipForward, MessageSquare } from 'lucide-react';

interface PreAnalysisViewProps {
  questions: PreAnalysisQuestion[];
  language: Language;
  onConfirm: (answers: Record<string, string[]>) => void;
  onSkip: () => void;
}

const PreAnalysisView: React.FC<PreAnalysisViewProps> = ({ questions, language, onConfirm, onSkip }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    questions.forEach(q => { init[q.id] = []; });
    return init;
  });

  const handleToggle = (questionId: string, option: string, allowMultiple: boolean) => {
    setSelections(prev => {
      const current = prev[questionId] || [];
      if (allowMultiple) {
        return {
          ...prev,
          [questionId]: current.includes(option)
            ? current.filter(o => o !== option)
            : [...current, option]
        };
      }
      return {
        ...prev,
        [questionId]: current.includes(option) ? [] : [option]
      };
    });
  };

  const answeredCount = Object.values(selections).filter((s: string[]) => s.length > 0).length;

  return (
    <div className="space-y-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 md:p-10 rounded-3xl shadow-2xl border border-white/40 dark:border-slate-700/40 relative animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="relative z-10 text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-full text-amber-700 dark:text-amber-300 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          {t.preAnalysis.badge}
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t.preAnalysis.title}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
          {t.preAnalysis.subtitle}
        </p>
      </div>

      {/* Progress */}
      <div className="relative z-10 flex items-center justify-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">{t.preAnalysis.answered}</span>
        <span className={`font-bold ${answeredCount === questions.length ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
          {answeredCount}/{questions.length}
        </span>
      </div>

      {/* Questions */}
      <div className="relative z-10 space-y-6">
        {questions.map((q, idx) => {
          const isAnswered = (selections[q.id] || []).length > 0;
          return (
            <div
              key={q.id}
              className={`p-5 rounded-2xl border transition-all ${
                isAnswered
                  ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 shadow-sm'
                  : 'bg-white/70 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isAnswered
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {isAnswered ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100 text-sm leading-relaxed">{q.question}</p>
                  {q.allowMultiple && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 inline-block">{t.preAnalysis.multiSelect}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 ml-10">
                {q.options.map(opt => {
                  const isSelected = (selections[q.id] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleToggle(q.id, opt, q.allowMultiple)}
                      className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${
                        isSelected
                          ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-600 shadow-md scale-105'
                          : 'bg-white/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="button"
          onClick={() => onConfirm(selections)}
          className="flex-1 py-4 px-6 rounded-2xl font-bold text-lg text-white bg-slate-900 hover:bg-slate-800 shadow-xl transition-all transform hover:-translate-y-0.5 hover:shadow-2xl flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-5 h-5" />
          {answeredCount > 0 ? t.preAnalysis.confirmWithAnswers : t.preAnalysis.confirmSkipAll}
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="sm:w-auto py-4 px-6 rounded-2xl font-medium text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          {t.preAnalysis.skip}
        </button>
      </div>
    </div>
  );
};

export default PreAnalysisView;
