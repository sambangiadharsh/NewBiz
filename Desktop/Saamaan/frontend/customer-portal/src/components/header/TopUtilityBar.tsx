import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';

const STORE_MESSAGES = [
  '📦 Free express courier delivery on orders above ₹999',
  '🌿 Authentic quality products verified directly from certified sellers',
  '🛡️ 100% Secure Checkout with UPI, Cards, and NetBanking',
];

interface TopUtilityBarProps {
  currency: string;
  onCurrencyChange: (curr: string) => void;
  onOpenTrackOrder?: () => void;
  onOpenHelp?: () => void;
}

export const TopUtilityBar: React.FC<TopUtilityBarProps> = ({
  currency,
  onCurrencyChange,
  onOpenTrackOrder,
  onOpenHelp,
}) => {
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnnouncementIdx((prev) => (prev + 1) % STORE_MESSAGES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const handleCopyPromo = () => {
    navigator.clipboard.writeText('FLASH20');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };



  const languages = ['English', 'Español', 'Français', 'Deutsch'];

  return (
    <div className="bg-slate-900 text-slate-300 text-xs font-medium border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
        
        {/* Spacer to keep announcement centered on larger displays */}
        <div className="hidden md:block w-28" />

        {/* Center: Announcement Ticker */}
        <div className="flex-1 flex items-center justify-center space-x-2 px-2">
          <button
            onClick={() => setAnnouncementIdx((prev) => (prev - 1 + STORE_MESSAGES.length) % STORE_MESSAGES.length)}
            aria-label="Previous announcement"
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="overflow-hidden h-4 flex items-center text-center">
            <span className="transition-all duration-300 transform inline-block text-slate-200">
              {STORE_MESSAGES[announcementIdx]}
            </span>
          </div>

          <button
            onClick={() => setAnnouncementIdx((prev) => (prev + 1) % STORE_MESSAGES.length)}
            aria-label="Next announcement"
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyPromo}
            className="hidden sm:inline-flex items-center space-x-1 ml-2 px-2 py-0.5 rounded bg-primary-950/80 border border-primary-500/30 text-[11px] text-primary-300 hover:bg-primary-900/90 transition-all font-mono"
            title="Click to copy coupon code"
          >
            {copiedCode ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>CODE: FLASH20</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Currency & Language Selectors */}
        <div className="flex items-center space-x-4">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setIsLanguageOpen(!isLanguageOpen);
                setIsCurrencyOpen(false);
              }}
              className="flex items-center space-x-1 hover:text-white transition-colors duration-150 py-1"
            >
              <span>{language.slice(0, 3).toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isLanguageOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsLanguageOpen(false)} />
                <div className="absolute right-0 mt-1 w-28 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-40 animate-fade-in">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setIsLanguageOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors ${
                        language === lang ? 'text-primary-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="text-slate-700">|</span>

          {/* Currency Display */}
          <div className="flex items-center space-x-1.5 py-1 text-slate-200 font-bold text-xs">
            <span className="text-slate-400 font-normal">Currency:</span>
            <span>INR (₹)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
