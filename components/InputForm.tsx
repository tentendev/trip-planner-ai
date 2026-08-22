
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TripInput, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { buildFullPrompt } from '../services/geminiService';
import { Plane, Users, DollarSign, Activity, Heart, AlertTriangle, Coffee, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bed, Utensils, PlaneLanding, PlaneTakeoff, Plus, Gauge, Zap, CheckCircle2, Code, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: TripInput) => void;
  isLoading: boolean;
  initialValues?: TripInput;
  language: Language;
}

const RawPromptPreview: React.FC<{ formData: TripInput; language: Language; t: typeof TRANSLATIONS['en'] }> = ({ formData, language, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const rawPrompt = useMemo(() => buildFullPrompt(formData, language), [formData, language]);

  const filledCount = useMemo(() => {
    const values = [
      formData.destination, formData.arrivalDetail, formData.departureDetail,
      formData.dates, formData.travelers, formData.budget, formData.pace,
      formData.interests, formData.mustDos, formData.constraints,
      formData.accommodation, formData.transportPref, formData.diet,
      formData.work, formData.bookings, formData.other
    ];
    return values.filter(v => v && v.trim() !== '').length;
  }, [formData]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
      >
        <Code className="w-4 h-4" />
        {isOpen ? t.actions.hidePrompt : t.actions.viewPrompt}
        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-mono">{filledCount}/16</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 rounded-xl border border-slate-200/60 bg-slate-900 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">RAW PROMPT</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                <Zap className="w-3 h-3" /> LIVE
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t.actions.promptCopied : t.actions.copyPrompt}
            </button>
          </div>
          <pre className="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap break-words max-h-80 overflow-y-auto leading-relaxed">
            {rawPrompt}
          </pre>
        </div>
      )}
    </div>
  );
};

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues, language }) => {
  const t = TRANSLATIONS[language];
  
  const defaultValues: TripInput = {
    destination: '',
    arrivalDetail: '',
    departureDetail: '',
    dates: '',
    travelers: '',
    budget: '',
    pace: 'Moderate',
    interests: '',
    mustDos: '',
    constraints: '',
    accommodation: '',
    transportPref: '',
    diet: '',
    work: '',
    bookings: '',
    other: ''
  };

  const [formData, setFormData] = useState<TripInput>(initialValues || defaultValues);

  useEffect(() => {
    if (initialValues) {
      setFormData(prev => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Restore calendar selection from persisted form values ("refine" flow used to
  // come back with empty date fields even though formData.dates survived).
  useEffect(() => {
    if (!initialValues?.dates) return;
    if (startDate || endDate) return; // don't clobber live edits
    const isoMatch = initialValues.dates.match(/(\d{4}-\d{2}-\d{2})(?:\/(\d{4}-\d{2}-\d{2}))?/);
    if (!isoMatch) return;
    const parse = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const s = parse(isoMatch[1]);
    if (!s) return;
    const e = isoMatch[2] ? parse(isoMatch[2]) : null;
    setStartDate(s);
    if (e) setEndDate(e);
    setViewDate(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Serialize a Date as local YYYY-MM-DD (not toISOString, which shifts by timezone)
  const toISOLocal = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (startDate && endDate) {
      // Include the YEAR and an ISO tail: the previous year-less display string forced
      // both the LLM and SerpAPI param extraction to guess which year was meant.
      // Format: "<pretty range> (<N> days) · YYYY-MM-DD/YYYY-MM-DD"
      const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      const startStr = startDate.toLocaleDateString(language, opts);
      const endStr = endDate.toLocaleDateString(language, opts);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      setFormData(prev => ({
        ...prev,
        dates: `${startStr} - ${endStr} (${diffDays} ${t.form.dates_days}) · ${toISOLocal(startDate)}/${toISOLocal(endDate)}`
      }));
    } else if (startDate) {
      const startStr = startDate.toLocaleDateString(language, { month: 'long', day: 'numeric', year: 'numeric' });
      setFormData(prev => ({
        ...prev,
        dates: `${startStr} · ${toISOLocal(startDate)}`
      }));
    }
  }, [startDate, endDate, language]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaceChange = (pace: string) => {
    setFormData(prev => ({ ...prev, pace }));
  };

  const handleMultiSelectToggle = (field: keyof TripInput, option: string, exclusiveOption?: string) => {
    const currentStr = formData[field] as string;
    const current = currentStr 
      ? currentStr.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    let updated: string[];

    if (exclusiveOption && option === exclusiveOption) {
        if (current.includes(option)) {
            updated = []; 
        } else {
            updated = [option]; 
        }
    } else {
        let temp = exclusiveOption ? current.filter(i => i !== exclusiveOption) : current;
        if (temp.includes(option)) {
            updated = temp.filter(item => item !== option);
        } else {
            updated = [...temp, option];
        }
    }
    
    setFormData(prev => ({ ...prev, [field]: updated.join(', ') }));
  };

  const handleChipClick = (field: keyof TripInput, value: string) => {
    const current = (formData[field] as string)
      ? (formData[field] as string).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    // Toggle on exact match — the substring includes() check previously made
    // "Food" and "Seafood" collide and left no way to remove a chip-added value.
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFormData(prev => ({ ...prev, [field]: updated.join(', ') }));
  };

  // Localized validation messages (kept local to avoid i18n.ts churn in this pass)
  const VALIDATION_MSGS: Record<Language, { destination: string; dates: string; past: string }> = {
    'en': {
      destination: 'Please enter a destination.',
      dates: 'Please select your travel dates.',
      past: 'The start date is in the past — please pick an upcoming date.',
    },
    'zh-TW': {
      destination: '請輸入目的地。',
      dates: '請選擇旅行日期。',
      past: '出發日期已過期，請選擇未來的日期。',
    },
    'zh-CN': {
      destination: '请输入目的地。',
      dates: '请选择旅行日期。',
      past: '出发日期已过期，请选择未来的日期。',
    },
    'ja': {
      destination: '旅行先を入力してください。',
      dates: '旅行日を選択してください。',
      past: '出発日が過去です。今後の日付を選んでください。',
    },
    'ko': {
      destination: '여행지를 입력해 주세요.',
      dates: '여행 날짜를 선택해 주세요.',
      past: '출발일이 과거입니다. 이후 날짜를 선택해 주세요.',
    },
    'hi': {
      destination: 'कृपया गंतव्य दर्ज करें।',
      dates: 'कृपया अपनी यात्रा की तारीखें चुनें।',
      past: 'प्रारंभ तिथि बीत चुकी है — कृपया आने वाली तारीख चुनें।',
    },
    'es': {
      destination: 'Introduce un destino.',
      dates: 'Selecciona las fechas del viaje.',
      past: 'La fecha de inicio ya pasó — elige una fecha futura.',
    },
    'fr': {
      destination: 'Veuillez saisir une destination.',
      dates: 'Veuillez sélectionner vos dates de voyage.',
      past: "La date de début est passée — choisissez une date à venir.",
    },
    'ar': {
      destination: 'يرجى إدخال الوجهة.',
      dates: 'يرجى تحديد تواريخ السفر.',
      past: 'تاريخ البدء في الماضي — يرجى اختيار تاريخ قادم.',
    },
    'pt': {
      destination: 'Informe um destino.',
      dates: 'Selecione as datas da viagem.',
      past: 'A data de início já passou — escolha uma data futura.',
    },
    'ru': {
      destination: 'Введите направление.',
      dates: 'Выберите даты поездки.',
      past: 'Дата начала уже прошла — выберите будущую дату.',
    },
  };

  const [validationError, setValidationError] = useState<{ field: 'destination' | 'dates'; msg: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msgs = VALIDATION_MSGS[language] || VALIDATION_MSGS.en;

    // Whitespace-only destination previously slipped past the `required` attribute
    // and produced prompts with no destination at all.
    if (!formData.destination.trim()) {
      setValidationError({ field: 'destination', msg: msgs.destination });
      return;
    }
    if (!startDate) {
      setValidationError({ field: 'dates', msg: msgs.dates });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);
    if (startDay < today) {
      setValidationError({ field: 'dates', msg: msgs.past });
      setShowDatePicker(true);
      return;
    }

    setValidationError(null);
    // Trim the destination so prompts never carry stray whitespace.
    onSubmit({ ...formData, destination: formData.destination.trim() });
  };

  // Calculate form completion progress
  const formProgress = useMemo(() => {
    const fields = {
      // Required fields (higher weight)
      destination: { value: formData.destination, weight: 3 },
      dates: { value: formData.dates, weight: 3 },
      // Important fields
      travelers: { value: formData.travelers, weight: 2 },
      budget: { value: formData.budget, weight: 2 },
      pace: { value: formData.pace, weight: 2 },
      // Optional fields
      interests: { value: formData.interests, weight: 1 },
      mustDos: { value: formData.mustDos, weight: 1 },
      constraints: { value: formData.constraints, weight: 1 },
      accommodation: { value: formData.accommodation, weight: 1 },
      transportPref: { value: formData.transportPref, weight: 1 },
    };

    let totalWeight = 0;
    let completedWeight = 0;

    Object.values(fields).forEach(({ value, weight }) => {
      totalWeight += weight;
      if (value && value.trim() !== '' && value !== 'Moderate') {
        completedWeight += weight;
      } else if (value === 'Moderate') {
        // Pace has a default value, count as half completed
        completedWeight += weight * 0.5;
      }
    });

    return Math.min(Math.round((completedWeight / totalWeight) * 100), 100);
  }, [formData]);

  // Progress bar color based on completion
  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-slate-300';
    if (progress < 60) return 'bg-blue-400';
    if (progress < 90) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Section completion indicators
  const sectionCompletion = useMemo(() => ({
    basics: !!(formData.destination && formData.dates),
    style: !!(formData.budget || formData.pace !== 'Moderate'),
    prefs: !!(formData.interests || formData.mustDos || formData.constraints || formData.accommodation || formData.transportPref),
  }), [formData]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => { setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); };
  const handleNextMonth = () => { setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if ((startDate && endDate) || (startDate && clickedDate < startDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
    } else if (!startDate) {
      setStartDate(clickedDate);
    } else {
      setEndDate(clickedDate);
      setShowDatePicker(false);
    }
  };

  const isSelected = (day: number) => {
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return (startDate && current.getTime() === startDate.getTime()) || 
           (endDate && current.getTime() === endDate.getTime());
  };

  const isInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return current > startDate && current < endDate;
  };

  const renderWeekDays = () => {
    const days = [];
    // Jan 7, 2024 is a Sunday. We use this to generate locale-aware weekday names starting from Sunday.
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 7 + i); 
      days.push(
        <div key={i} className="text-center text-xs font-bold text-slate-400 py-2 uppercase tracking-wide">
          {d.toLocaleDateString(language, { weekday: 'short' })}
        </div>
      );
    }
    return days;
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const selected = isSelected(day);
      const inRange = isInRange(day);
      const isStart = startDate && new Date(year, month, day).getTime() === startDate.getTime();
      const isEnd = endDate && new Date(year, month, day).getTime() === endDate.getTime();

      let wrapperClass = "h-10 w-full flex items-center justify-center relative";
      let btnClass = "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors z-10 hover:bg-blue-100 hover:text-blue-600";
      
      if (inRange) { wrapperClass += " bg-blue-50"; btnClass = "h-10 w-10 flex items-center justify-center text-sm font-medium text-blue-700"; }
      if (isStart) { wrapperClass += endDate ? " bg-gradient-to-r from-transparent to-blue-50" : ""; btnClass = "h-10 w-10 rounded-full bg-blue-600 text-white shadow-md"; }
      if (isEnd) { wrapperClass += " bg-gradient-to-l from-transparent to-blue-50"; btnClass = "h-10 w-10 rounded-full bg-blue-600 text-white shadow-md"; }

      days.push(
        <div key={day} className={wrapperClass}>
           {inRange && <div className="absolute inset-0 bg-blue-50" />}
           {(isStart && endDate) && <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-blue-50" />}
           {(isEnd && startDate) && <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-blue-50" />}
          <button type="button" onClick={() => handleDateClick(day)} className={`${btnClass} relative`}>{day}</button>
        </div>
      );
    }
    return days;
  };

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return t.form.dates_select;
    return date.toLocaleDateString(language, { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const renderMultiSelect = (
    label: string, 
    field: keyof TripInput, 
    options: string[], 
    icon?: React.ReactNode, 
    exclusiveOption?: string
  ) => {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          {icon}
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const currentVals = (formData[field] as string).split(',').map(s => s.trim());
            const isActive = currentVals.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleMultiSelectToggle(field, opt, exclusiveOption)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${
                  isActive 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' 
                  : 'bg-white/50 text-slate-600 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSmartChips = (label: string, field: keyof TripInput, suggestions: string[], icon: React.ReactNode, colorClass: string, placeholder: string) => (
    <div className="space-y-3">
      <label htmlFor={`trip-${field}`} className="text-sm font-medium text-slate-700 flex items-center gap-2">
        {icon} {label}
      </label>
      <input
        id={`trip-${field}`}
        name={field}
        value={formData[field] as string}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:${colorClass} focus:border-transparent outline-none transition shadow-sm`}
      />
      <div className="flex flex-wrap gap-2 mt-2">
        {suggestions.map(s => {
          // Exact-match against the comma-split list; the old substring check made
          // "Food" and "Seafood" collide.
          const active = (formData[field] as string).split(',').map(x => x.trim()).includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => handleChipClick(field, s)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition border ${
                active
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 border-slate-200'
              }`}
            >
              {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {s}
            </button>
          );
        })}
      </div>
    </div>
  );

  // New Visual Pace Selector
  const renderPaceSelector = () => {
    const options = ['Slow', 'Moderate', 'Fast', 'Intense'];
    
    return (
        <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-orange-500" /> {t.form.pace}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {options.map((opt) => {
                    const isSelected = formData.pace === opt;
                    const desc = t.form.pace_options[opt as keyof typeof t.form.pace_options].split('(')[1]?.replace(')', '') || opt;
                    const label = t.form.pace_options[opt as keyof typeof t.form.pace_options].split('(')[0];
                    
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => handlePaceChange(opt)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                                isSelected 
                                ? 'border-slate-800 bg-white shadow-lg scale-105 z-10' 
                                : 'border-transparent bg-white/40 hover:bg-white/60 text-slate-500'
                            }`}
                        >
                            <span className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
                            <span className="text-[10px] opacity-70 mt-1 text-center leading-tight">{desc}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 bg-white/60 backdrop-blur-xl p-6 md:p-10 rounded-3xl shadow-2xl border border-white/40 relative">

      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none rounded-3xl"></div>

      {/* Form Progress Indicator */}
      <div className="relative z-10 -mt-2 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            {/* Step indicators */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sectionCompletion.basics
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {sectionCompletion.basics ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">1</span>
                )}
                <span className="hidden md:inline">{t.form.section_basics}</span>
              </div>

              <div className="w-8 h-0.5 bg-slate-200 hidden md:block" />

              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sectionCompletion.style
                  ? 'bg-green-100 text-green-700'
                  : sectionCompletion.basics
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
              }`}>
                {sectionCompletion.style ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${sectionCompletion.basics ? 'bg-emerald-500' : 'bg-slate-300'}`}>2</span>
                )}
                <span className="hidden md:inline">{t.form.section_style}</span>
              </div>

              <div className="w-8 h-0.5 bg-slate-200 hidden md:block" />

              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sectionCompletion.prefs
                  ? 'bg-green-100 text-green-700'
                  : sectionCompletion.style
                    ? 'bg-pink-100 text-pink-700'
                    : 'bg-slate-100 text-slate-400'
              }`}>
                {sectionCompletion.prefs ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${sectionCompletion.style ? 'bg-pink-500' : 'bg-slate-300'}`}>3</span>
                )}
                <span className="hidden md:inline">{t.form.section_prefs}</span>
              </div>
            </div>
          </div>

          {/* Completion percentage */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold transition-colors ${formProgress >= 90 ? 'text-green-600' : 'text-slate-600'}`}>
              {formProgress}%
            </span>
            {formProgress >= 90 && (
              <span className="text-xs text-green-600 hidden md:inline animate-in fade-in">✓</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressColor(formProgress)}`}
            style={{ width: `${formProgress}%` }}
          />
        </div>
      </div>

      {/* Section 1: The Basics - High Z-Index for DatePicker */}
      <div className="space-y-6 relative z-30">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Plane className="w-5 h-5 text-blue-600" /> {t.form.section_basics}
          {sectionCompletion.basics && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label htmlFor="trip-destination" className="text-sm font-medium text-slate-700">{t.form.destination}</label>
            <input
              required
              id="trip-destination"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder={t.form.destination_placeholder}
              aria-invalid={validationError?.field === 'destination' || undefined}
              aria-describedby={validationError?.field === 'destination' ? 'trip-destination-error' : undefined}
              className={`w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm ${validationError?.field === 'destination' ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200/60'}`}
            />
            {validationError?.field === 'destination' && (
              <p id="trip-destination-error" role="alert" className="text-sm text-red-600 font-medium">{validationError.msg}</p>
            )}
          </div>

          <div className="space-y-3">
            <label htmlFor="trip-travelers" className="text-sm font-medium text-slate-700">{t.form.travelers}</label>
            <div className="relative">
              <Users className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <input
                id="trip-travelers"
                name="travelers"
                value={formData.travelers}
                onChange={handleChange}
                placeholder={t.form.travelers_placeholder}
                className="w-full pl-12 p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-3 relative md:col-span-2" ref={datePickerRef}>
            <label className="text-sm font-medium text-slate-700">{t.form.dates}</label>
            {/* Keyboard-accessible trigger: was an onClick div invisible to keyboards/screen readers */}
            <button
              type="button"
              onClick={() => setShowDatePicker(v => !v)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowDatePicker(false); }}
              aria-expanded={showDatePicker}
              aria-haspopup="dialog"
              aria-invalid={validationError?.field === 'dates' || undefined}
              className={`w-full flex bg-white/70 backdrop-blur-sm border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition group text-left ${validationError?.field === 'dates' ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200/60'}`}
            >
              <div className={`flex-1 p-4 border-r border-slate-200/60 group-hover:bg-white/50 transition ${!startDate ? 'text-slate-400' : 'text-slate-900'}`}>
                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">{t.form.dates_start}</div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-lg">{formatDateDisplay(startDate)}</span>
                </div>
              </div>
              <div className={`flex-1 p-4 group-hover:bg-white/50 transition ${!endDate ? 'text-slate-400' : 'text-slate-900'}`}>
                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">{t.form.dates_end}</div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-lg">{formatDateDisplay(endDate)}</span>
                </div>
              </div>
            </button>
            {validationError?.field === 'dates' && (
              <p role="alert" className="text-sm text-red-600 font-medium">{validationError.msg}</p>
            )}
            {showDatePicker && (
              <div
                role="dialog"
                aria-label={t.form.dates}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowDatePicker(false); }}
                className="absolute top-full left-0 mt-4 bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 z-50 w-full md:w-[360px] animate-in fade-in zoom-in-95 duration-200 ring-4 ring-slate-100/50"
              >
                <div className="flex items-center justify-between mb-6">
                  <button type="button" aria-label={`${viewDate.getFullYear()} / ${viewDate.getMonth()}`} onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-bold text-slate-800 text-lg" aria-live="polite">{viewDate.getFullYear()} / {viewDate.getMonth() + 1}</span>
                  <button type="button" aria-label={`${viewDate.getFullYear()} / ${viewDate.getMonth() + 2}`} onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition"><ChevronRight className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-7 mb-2 border-b border-slate-100 pb-2">
                    {renderWeekDays()}
                </div>
                <div className="grid grid-cols-7 gap-y-2">{renderCalendar()}</div>

                <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-4">
                   <div className="text-xs text-slate-500 font-mono" aria-live="polite">
                      {startDate && endDate ?
                        `${Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t.form.dates_days.toUpperCase()} ✓`
                        : "→ → →"}
                   </div>
                   <button type="button" onClick={() => setShowDatePicker(false)} className="text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 px-5 py-2 rounded-lg transition shadow-lg shadow-slate-200">✓ OK</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <label htmlFor="trip-arrivalDetail" className="text-sm font-medium text-slate-700 flex items-center gap-2">
               <PlaneLanding className="w-4 h-4 text-slate-500" /> {t.form.arrival}
            </label>
            <input id="trip-arrivalDetail" name="arrivalDetail" value={formData.arrivalDetail} onChange={handleChange} placeholder={t.form.arrival_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"/>
          </div>

          <div className="space-y-3">
            <label htmlFor="trip-departureDetail" className="text-sm font-medium text-slate-700 flex items-center gap-2">
               <PlaneTakeoff className="w-4 h-4 text-slate-500" /> {t.form.departure}
            </label>
            <input id="trip-departureDetail" name="departureDetail" value={formData.departureDetail} onChange={handleChange} placeholder={t.form.departure_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"/>
          </div>
        </div>
      </div>

      {/* Section 2: Constraints & Style - Lower Z-Index */}
      <div className="space-y-6 relative z-20">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Activity className="w-5 h-5 text-emerald-600" /> {t.form.section_style}
          {sectionCompletion.style && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-3">
            <label htmlFor="trip-budget" className="text-sm font-medium text-slate-700">{t.form.budget}</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <input id="trip-budget" name="budget" value={formData.budget} onChange={handleChange} placeholder={t.form.budget_placeholder} className="w-full pl-12 p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition shadow-sm"/>
            </div>
          </div>
           {renderPaceSelector()}
        </div>
      </div>

      {/* Section 3: Preferences - Lowest Z-Index */}
      <div className="space-y-6 relative z-10">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Heart className="w-5 h-5 text-pink-600" /> {t.form.section_prefs}
          {sectionCompletion.prefs && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
        </h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {renderSmartChips(t.form.interests, "interests", t.chips.interests, <Zap className="w-4 h-4 text-pink-500" />, "ring-pink-500", t.form.interests_placeholder)}
             
             <div className="space-y-3">
              <label htmlFor="trip-mustDos" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" /> {t.form.mustDos}
              </label>
              <input id="trip-mustDos" name="mustDos" value={formData.mustDos} onChange={handleChange} placeholder={t.form.mustDos_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition shadow-sm"/>
            </div>
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderSmartChips(t.form.constraints, "constraints", t.chips.constraints, <AlertTriangle className="w-4 h-4 text-amber-500" />, "ring-amber-500", t.form.constraints_placeholder)}

            {renderMultiSelect(t.form.accommodation, "accommodation", t.chips.accommodation, <Bed className="w-4 h-4 text-blue-600" />)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {renderMultiSelect(t.form.transport, "transportPref", t.chips.transport, <Plane className="w-4 h-4 text-slate-600" />)}
             {renderMultiSelect(t.form.diet, "diet", t.chips.diet, <Utensils className="w-4 h-4 text-emerald-600" />, t.chips.diet[0])}
             
             <div className="space-y-3">
              <label htmlFor="trip-work" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-slate-600" /> {t.form.work}
              </label>
              <input id="trip-work" name="work" value={formData.work} onChange={handleChange} placeholder={t.form.work_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition shadow-sm"/>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Prompt Preview */}
      <RawPromptPreview formData={formData} language={language} t={t} />

      <div className="pt-6">
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-5 px-6 rounded-2xl font-bold text-lg text-white shadow-xl transition-all transform hover:-translate-y-1 hover:shadow-2xl
            ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}
        >
          {isLoading ? (
             <span className="flex items-center justify-center gap-3">
               <span className="animate-pulse">{t.actions.submit}…</span>
             </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
               {t.actions.submit} <ChevronRight className="w-5 h-5" />
            </span>
          )}
        </button>
      </div>
    </form>
  );
};

export default InputForm;
