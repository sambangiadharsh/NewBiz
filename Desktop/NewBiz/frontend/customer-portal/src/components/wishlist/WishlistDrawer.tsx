import React from 'react';
import { X, Trash2, ShoppingCart, Heart } from 'lucide-react';
import { Product } from '../../types';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: Product[];
  onRemoveWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  currency: string;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveWishlist,
  onAddToCart,
  currency,
}) => {
  if (!isOpen) return null;

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
  };
  const currSymbol = currencySymbols[currency] || '$';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-slide-up">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <h2 className="text-base font-extrabold text-slate-900">
                Your Saved Wishlist ({items.length})
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close wishlist"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center">
                  <Heart className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No saved items yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Tap the heart icon on any product to save it to your personal wishlist.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Discover Products
                </button>
              </div>
            ) : (
              items.map((prod) => (
                <div key={prod.id} className="py-4 flex space-x-4">
                  <img
                    src={prod.thumbnail}
                    alt={prod.name}
                    className="w-20 h-20 object-cover rounded-2xl border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate pr-2">
                          {prod.name}
                        </h4>
                        <button
                          onClick={() => onRemoveWishlist(prod.id)}
                          aria-label="Remove from wishlist"
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">{prod.category}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold text-slate-900">
                        {currSymbol}{prod.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          onAddToCart(prod);
                          onRemoveWishlist(prod.id);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors shadow-sm"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Move to Bag</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50 text-center">
              <button
                onClick={() => {
                  items.forEach((p) => onAddToCart(p));
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
              >
                Move All to Bag
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
