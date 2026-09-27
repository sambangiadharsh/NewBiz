import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Cookie, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

export const COOKIE_STORAGE_KEY = 'hesa_cookie_consent_preferences';

export function getStoredCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCookiePreferences(prefs: Omit<CookiePreferences, 'timestamp'>): CookiePreferences {
  const payload: CookiePreferences = {
    ...prefs,
    necessary: true,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save cookie preferences', err);
  }
  return payload;
}

interface CookieConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (prefs: CookiePreferences) => void;
}

export const CookieConsentModal: React.FC<CookieConsentModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [preferences, setPreferences] = useState<Omit<CookiePreferences, 'timestamp'>>({
    necessary: true,
    functional: true,
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    const saved = getStoredCookiePreferences();
    if (saved) {
      setPreferences({
        necessary: true,
        functional: saved.functional,
        analytics: saved.analytics,
        marketing: saved.marketing,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = saveCookiePreferences(preferences);
    onSave?.(updated);
    onClose();
  };

  const handleAcceptAll = () => {
    const all = { necessary: true, functional: true, analytics: true, marketing: true };
    const updated = saveCookiePreferences(all);
    setPreferences(all);
    onSave?.(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-primary-600">
              <Cookie className="w-5 h-5 text-[#635BFF]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cookie & Privacy Settings</h2>
              <p className="text-xs text-slate-500">Control how data is utilized to enhance your experience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Categories */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            We employ cookies and browser telemetry to ensure store security, remember your selected currency, and optimize platform speed. For full legal disclosures, review our{' '}
            <Link to="/pages/cookie-policy" onClick={onClose} className="text-primary-600 hover:underline font-semibold inline-flex items-center gap-0.5">
              Cookie Policy <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
            </Link>.
          </p>

          {/* 1. Necessary */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Strictly Necessary Cookies</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  Required
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Fundamental for authenticated sessions, secure cart checkout, and fraud detection. Cannot be disabled.
              </p>
            </div>
            <div className="flex items-center h-6">
              <div className="w-9 h-5 rounded-full bg-slate-300 flex items-center px-0.5 cursor-not-allowed opacity-80">
                <div className="w-4 h-4 rounded-full bg-white shadow-sm transform translate-x-4 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-slate-600" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Functional */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-colors flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900">Functional & Preferences</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Remembers your chosen international currency, localized catalog filters, and active saved wishlist.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreferences((p) => ({ ...p, functional: !p.functional }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                preferences.functional ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.functional ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Analytics */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-colors flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900">Performance & Analytics</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Provides aggregated telemetry on page response rates and browser journeys to continually refine store responsiveness.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreferences((p) => ({ ...p, analytics: !p.analytics }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                preferences.analytics ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.analytics ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. Marketing */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-colors flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900">Marketing & Tailored Curation</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Allows our recommendation engine to present limited edition drops and seasonal promotions aligned with your style.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreferences((p) => ({ ...p, marketing: !p.marketing }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                preferences.marketing ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.marketing ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center text-[11px] text-slate-400 gap-1.5 order-2 sm:order-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>GDPR & CCPA Compliant</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              Save Preferences
            </button>
            <button
              onClick={handleAcceptAll}
              className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-white bg-slate-950 hover:bg-primary-600 rounded-xl transition-all shadow-sm"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
