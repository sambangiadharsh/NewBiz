import React from 'react';
import { CheckCircle2, ShoppingBag, Heart, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'cart' | 'wishlist' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'cart', onClose }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 animate-slide-up">
      {type === 'cart' && <ShoppingBag className="w-4 h-4 text-emerald-400" />}
      {type === 'wishlist' && <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />}
      {type === 'info' && <CheckCircle2 className="w-4 h-4 text-primary-400" />}
      
      <span className="text-xs font-semibold">{message}</span>

      <button
        onClick={onClose}
        aria-label="Dismiss toast"
        className="text-slate-400 hover:text-white p-1 rounded-lg"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
