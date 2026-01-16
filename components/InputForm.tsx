
import React, { useState, useEffect, useRef } from 'react';
import { TripInput, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { Plane, Users, DollarSign, Activity, Heart, AlertTriangle, Coffee, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bed, Utensils, PlaneLanding, PlaneTakeoff, Plus, Gauge, Zap } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: TripInput) => void;
  isLoading: boolean;
  initialValues?: TripInput;
  language: Language;
}

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString(language, { month: 'long', day: 'numeric' });
      const endStr = endDate.toLocaleDateString(language, { month: 'long', day: 'numeric' });
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      setFormData(prev => ({
        ...prev,
        dates: `${startStr} - ${endStr} (${diffDays} ${t.form.dates_days})`
      }));
    } else if (startDate) {
      const startStr = startDate.toLocaleDateString(language, { month: 'long', day: 'numeric' });
      setFormData(prev => ({
        ...prev,
        dates: `${startStr}`
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
    const currentVal = formData[field] as string;
    if (!currentVal) {
      setFormData(prev => ({ ...prev, [field]: value }));
      return;
    }
    if (currentVal.includes(value)) return; 
    setFormData(prev => ({ ...prev, [field]: `${currentVal}, ${value}` }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

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
      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
        {icon} {label}
      </label>
      <input 
        name={field}
        value={formData[field] as string}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:${colorClass} focus:border-transparent outline-none transition shadow-sm`}
      />
      <div className="flex flex-wrap gap-2 mt-2">
        {suggestions.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => handleChipClick(field, s)}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100/80 text-slate-600 text-xs hover:bg-slate-200 transition border border-slate-200"
          >
            <Plus className="w-3 h-3" /> {s}
          </button>
        ))}
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

      {/* Section 1: The Basics - High Z-Index for DatePicker */}
      <div className="space-y-6 relative z-30">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Plane className="w-5 h-5 text-blue-600" /> {t.form.section_basics}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">{t.form.destination}</label>
            <input 
              required
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder={t.form.destination_placeholder}
              className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">{t.form.travelers}</label>
            <div className="relative">
              <Users className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <input 
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
            <div 
              className="flex bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition group"
              onClick={() => setShowDatePicker(true)}
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
            </div>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-4 bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 z-50 w-full md:w-[360px] animate-in fade-in zoom-in-95 duration-200 ring-4 ring-slate-100/50">
                <div className="flex items-center justify-between mb-6">
                  <button type="button" onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-bold text-slate-800 text-lg">{viewDate.getFullYear()} / {viewDate.getMonth() + 1}</span>
                  <button type="button" onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition"><ChevronRight className="w-5 h-5" /></button>
                </div>
                
                <div className="grid grid-cols-7 mb-2 border-b border-slate-100 pb-2">
                    {renderWeekDays()}
                </div>
                <div className="grid grid-cols-7 gap-y-2">{renderCalendar()}</div>
                
                <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-4">
                   <div className="text-xs text-slate-500 font-mono">
                      {startDate && endDate ? 
                        `${Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} DAYS SELECTED` 
                        : "PLEASE SELECT RANGE"}
                   </div>
                   <button type="button" onClick={() => setShowDatePicker(false)} className="text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 px-5 py-2 rounded-lg transition shadow-lg shadow-slate-200">OK</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
               <PlaneLanding className="w-4 h-4 text-slate-500" /> {t.form.arrival}
            </label>
            <input name="arrivalDetail" value={formData.arrivalDetail} onChange={handleChange} placeholder={t.form.arrival_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"/>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
               <PlaneTakeoff className="w-4 h-4 text-slate-500" /> {t.form.departure}
            </label>
            <input name="departureDetail" value={formData.departureDetail} onChange={handleChange} placeholder={t.form.departure_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"/>
          </div>
        </div>
      </div>

      {/* Section 2: Constraints & Style - Lower Z-Index */}
      <div className="space-y-6 relative z-20">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Activity className="w-5 h-5 text-emerald-600" /> {t.form.section_style}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">{t.form.budget}</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <input name="budget" value={formData.budget} onChange={handleChange} placeholder={t.form.budget_placeholder} className="w-full pl-12 p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition shadow-sm"/>
            </div>
          </div>
           {renderPaceSelector()}
        </div>
      </div>

      {/* Section 3: Preferences - Lowest Z-Index */}
      <div className="space-y-6 relative z-10">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200/50">
          <Heart className="w-5 h-5 text-pink-600" /> {t.form.section_prefs}
        </h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {renderSmartChips(t.form.interests, "interests", t.chips.interests, <Zap className="w-4 h-4 text-pink-500" />, "ring-pink-500", t.form.interests_placeholder)}
             
             <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" /> {t.form.mustDos}
              </label>
              <input name="mustDos" value={formData.mustDos} onChange={handleChange} placeholder={t.form.mustDos_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition shadow-sm"/>
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
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-slate-600" /> {t.form.work}
              </label>
              <input name="work" value={formData.work} onChange={handleChange} placeholder={t.form.work_placeholder} className="w-full p-4 bg-white/70 backdrop-blur-sm text-slate-900 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition shadow-sm"/>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <button 
          type="submit" 
          disabled={isLoading}
          className={`w-full py-5 px-6 rounded-2xl font-bold text-lg text-white shadow-xl transition-all transform hover:-translate-y-1 hover:shadow-2xl
            ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}
        >
          {isLoading ? (
             <span className="flex items-center justify-center gap-3 font-mono">
               <span className="animate-pulse">PROCESSING_REQUEST...</span>
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
