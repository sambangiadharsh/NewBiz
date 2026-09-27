import React, { useState, useEffect } from 'react';
import { Cookie, X, Settings2 } from 'lucide-react';
import { getStoredCookiePreferences, saveCookiePreferences } from './CookieConsentModal';

interface CookieBannerProps {
  onOpenSettings: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenSettings }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredCookiePreferences();
    if (!existing) {
      // Small timeout so it slides in smoothly after initial paint
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  const handleAcceptAll = () => {
    saveCookiePreferences({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
    setIsVisible(false);
  };

  const handleDeclineOptional = () => {
    saveCookiePreferences({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
    setIsVisible(false);
  };

  return (
    <aside
      aria-label="Cookie Consent Banner"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-40 animate-slide-up"
    >
      <div className="p-5 rounded-3xl bg-slate-950/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-400">
              <Cookie className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase">
              Cookie Choices
            </h3>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            aria-label="Dismiss cookie notice"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          We use cookies to maintain your shopping bag, preserve currency selections, and analyze site performance. You can customize your preferences at any time.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleAcceptAll}
            className="flex-1 py-2 px-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            Accept All
          </button>
          <button
            onClick={handleDeclineOptional}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl transition-all"
          >
            Decline
          </button>
          <button
            onClick={() => {
              onOpenSettings();
            }}
            className="py-2 px-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-xs rounded-xl transition-all flex items-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Customize</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
