import React from 'react';
import {
  CreditCard,
  Clock,
} from 'lucide-react';

export const RefundsPage: React.FC = () => {

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <CreditCard className="w-6 h-6 text-primary-600" />
              Refunds Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              Coming Soon
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated payment gateway credit processing and financial ledger settlements
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 shadow-inner">
          <Clock className="w-8 h-8" />
        </div>

        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Automated Gateway Refunds — Coming Soon
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Direct automated bank / UPI gateway refund disbursements via webhook integration are currently under active development.
          </p>
        </div>

        

        
      </div>
    </div>
  );
};
