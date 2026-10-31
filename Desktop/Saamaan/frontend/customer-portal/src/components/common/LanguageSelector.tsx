import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getActiveLanguage, setLanguage, LanguageOption } from '../../lib/googleTranslate';

interface LanguageSelectorProps {
  variant?: 'compact' | 'header' | 'mobile-grid';
  className?: string;
  onLanguageChange?: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
  onLanguageChange,
}) => {
  const [activeCode, setActiveCode] = useState<string>('en');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize active language
  useEffect(() => {
    setActiveCode(getActiveLanguage());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectLanguage = (lang: LanguageOption) => {
    setActiveCode(lang.code);
    setIsOpen(false);
    onLanguageChange?.(lang.code);
    setLanguage(lang.code);
  };

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === activeCode) || SUPPORTED_LANGUAGES[0];

  // ─── 1. MOBILE GRID VARIANT (For Mobile Navigation Drawer) ────────────────
  if (variant === 'mobile-grid') {
    return (
      <div className={`notranslate ${className}`} translate="no">
        <div className="flex items-center space-x-2 mb-3">
          <Globe className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-bold text-slate-800">
            Choose Preferred Language / भाषा चुनें
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === activeCode;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50/80 text-primary-900 font-bold shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <span className="block text-sm font-bold leading-tight">
                    {lang.nativeLabel}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {lang.label}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── 2. HEADER VARIANT (For Main Storefront Header) ───────────────────────
  if (variant === 'header') {
    return (
      <div className={`relative notranslate ${className}`} ref={containerRef} translate="no">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-xl transition-all duration-200 text-slate-700 select-none cursor-pointer ${
            isOpen
              ? 'bg-primary-50/80 text-primary-700 ring-2 ring-primary-500/20'
              : 'hover:bg-slate-100'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="true"
          title="Change language / भाषा चुनें"
        >
          <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/80 shrink-0">
            <Globe className="w-3 h-3 text-primary-600" />
          </div>
          <div className="text-left hidden xl:block">
            <span className="block text-xs font-bold text-slate-900 leading-tight">
              {currentLang.nativeLabel}
            </span>
          </div>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary-600' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 p-2 ring-1 ring-black/5">
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Regional Languages / भाषाएं
              </span>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Browse Saamaan in your mother tongue
              </p>
            </div>
            <div className="space-y-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === activeCode;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                      isSelected
                        ? 'bg-primary-50 text-primary-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xs font-mono font-bold text-slate-400 w-5">
                        {lang.badge}
                      </span>
                      <div>
                        <span className="text-xs font-bold block leading-tight">
                          {lang.nativeLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {lang.label}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── 3. COMPACT VARIANT (For Top Announcement Bar) ────────────────────────
  return (
    <div className={`relative notranslate ${className}`} ref={containerRef} translate="no">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors border border-white/15 cursor-pointer shrink-0"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change language / भाषा चुनें"
      >
        <Globe className="w-2.5 h-2.5 text-amber-400 shrink-0" />
        <span className="font-semibold tracking-tight">{currentLang.nativeLabel}</span>
        <ChevronDown className={`w-2.5 h-2.5 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden animate-in fade-in duration-150 p-1.5 text-left">
          <div className="px-2.5 py-1 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Select Language
          </div>
          <div className="mt-1 space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === activeCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-amber-400/20 text-amber-300 font-bold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-slate-400">{lang.badge}</span>
                    <span>{lang.nativeLabel}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
