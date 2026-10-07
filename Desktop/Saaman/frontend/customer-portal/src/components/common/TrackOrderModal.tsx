import React, { useState } from 'react';
import { X, Search, PackageCheck, Truck, CheckCircle2 } from 'lucide-react';

interface TrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({ isOpen, onClose }) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber) return;
    setIsSearched(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-modal border border-slate-200/90 p-8 overflow-hidden animate-slide-up">
        <button
          onClick={onClose}
          aria-label="Close track order modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Track Your Package</h3>
            <p className="text-xs text-slate-500">Live real-time courier milestone updates</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Order Number or Tracking ID
            </label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. AUR-89241"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Billing Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-primary-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" />
            <span>Search Package Status</span>
          </button>
        </form>

        {isSearched && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">Order #{orderNumber || 'AUR-89241'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Out For Delivery
              </span>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center space-x-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Estimated Arrival: Today before 7:00 PM</span>
              </div>
              <div className="text-[11px] text-slate-500 pl-6">
                Carrier: FedEx Carbon-Neutral Express • Last Scanned: Local Sorting Facility
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
