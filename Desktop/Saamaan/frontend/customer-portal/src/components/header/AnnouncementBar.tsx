import React, { useState } from 'react';
import { RotateCcw, ShieldCheck, X } from 'lucide-react';

interface AnnouncementBarProps {
  onTrackOrder?: () => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Store Announcement"
      className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white text-[11px] sm:text-xs py-2 px-3 sm:px-6 border-b border-slate-800/90 relative z-40 transition-all select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Spacer for symmetry on desktop */}
        <div className="hidden md:block w-7" aria-hidden="true" />

        {/* Announcement Content */}
        <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-center font-medium">
          
          {/* Free Shipping Offer */}
          <div className="inline-flex items-center space-x-1.5 text-slate-200">
            <span className="text-sm select-none" aria-hidden="true">🚚</span>
            <span className="font-semibold text-white tracking-wide">
              Free Shipping on Orders Above <span className="text-amber-400 font-bold">₹499</span>
            </span>
          </div>

          {/* Separator */}
          <span className="hidden sm:inline text-slate-600 font-bold" aria-hidden="true">•</span>

          {/* Easy Returns & Secure Payments */}
          <div className="inline-flex items-center space-x-2 text-slate-300">
            <span className="inline-flex items-center space-x-1">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Easy Returns</span>
            </span>
            <span className="text-slate-600" aria-hidden="true">•</span>
            <span className="inline-flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" />
              <span>Secure Payments</span>
            </span>
          </div>

        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors ml-2 -mr-1 focus:outline-none focus:ring-1 focus:ring-white/20"
          aria-label="Dismiss announcement bar"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

      </div>
    </aside>
  );
};
