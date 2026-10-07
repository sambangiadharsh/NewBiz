import React, { useEffect, useState } from 'react';
import {
  X, Trash2, ShoppingCart, Heart, Sparkles, Check,
  ArrowRight,
} from 'lucide-react';
import { Product } from '../../types';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: Product[];
  onRemoveWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onMoveAllToCart: () => void;
  currency: string;
}

const CURR = '₹';

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveWishlist,
  onAddToCart,
  onMoveAllToCart,
}) => {
  const [removing, setRemoving]     = useState<string | null>(null);
  const [movedIds, setMovedIds]     = useState<Set<string>>(new Set());

  // ── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Lock body scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleRemove = (id: string) => {
    setRemoving(id);
    setTimeout(() => {
      onRemoveWishlist(id);
      setRemoving(null);
    }, 280);
  };

  const handleMoveToCart = (product: Product) => {
    onAddToCart(product);
    setMovedIds((prev) => new Set([...prev, product.id]));
    setTimeout(() => {
      onRemoveWishlist(product.id);
    }, 900);
  };

  if (!isOpen) return null;

  const wishlistTotal = items.reduce((s, p) => s + p.price, 0);
  const savedTotal    = items.reduce((s, p) => s + Math.max(0, p.originalPrice - p.price), 0);

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Drawer Panel ──────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saved wishlist"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[420px] bg-white shadow-2xl"
        style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 fill-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                Your Wishlist
              </h2>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                {items.length === 0 ? 'No saved items' : `${items.length} saved item${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close wishlist"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Savings Banner ───────────────────────────────────────────────── */}
        {items.length > 0 && savedTotal > 0 && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100">
            <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              You're saving{' '}
              <span className="text-emerald-800">{CURR}{savedTotal.toFixed(0)}</span>
              {' '}on wishlist items today
            </p>
          </div>
        )}

        {/* ── Item List ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {items.length === 0 ? (
            /* ── Empty State ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center">
                  <Heart className="w-9 h-9 text-rose-200" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">No saved items yet</h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">
                  Tap the ♡ heart on any product to save it here for later.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Discover Products
              </button>
            </div>
          ) : (
            items.map((prod) => {
              const isRemoving = removing === prod.id;
              const isMoved    = movedIds.has(prod.id);
              const discount   = prod.originalPrice > prod.price
                ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
                : 0;

              return (
                <div
                  key={prod.id}
                  className={`py-4 flex gap-3.5 border-b border-slate-100/80 last:border-0 transition-all duration-300 ${
                    isRemoving ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={prod.thumbnail}
                      alt={prod.name}
                      className="w-[76px] h-[76px] object-cover rounded-2xl border border-slate-100"
                      loading="lazy"
                    />
                    {discount > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide truncate">
                          {prod.category}
                        </p>
                        <h4 className="text-xs font-bold text-slate-900 truncate leading-snug mt-0.5">
                          {prod.name}
                        </h4>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-sm font-extrabold text-slate-950">
                            {CURR}{prod.price.toFixed(2)}
                          </span>
                          {prod.originalPrice > prod.price && (
                            <span className="text-[11px] text-slate-400 line-through">
                              {CURR}{prod.originalPrice.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(prod.id)}
                        aria-label="Remove from wishlist"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Move to cart */}
                    <button
                      onClick={() => handleMoveToCart(prod)}
                      disabled={isMoved}
                      aria-label="Move to cart"
                      className={`mt-2.5 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        isMoved
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white border border-primary-100 hover:border-transparent'
                      }`}
                    >
                      {isMoved ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Added to Bag
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Move to Bag
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/80 p-5 space-y-3">
            {/* Wishlist total */}
            <div className="flex items-center justify-between text-xs text-slate-600 pb-1">
              <span>Wishlist value ({items.length} items)</span>
              <div className="text-right">
                <span className="font-extrabold text-slate-950 text-sm">
                  {CURR}{wishlistTotal.toFixed(2)}
                </span>
                {savedTotal > 0 && (
                  <span className="block text-[10px] text-emerald-600 font-bold">
                    {CURR}{savedTotal.toFixed(0)} savings applied
                  </span>
                )}
              </div>
            </div>

            {/* Move All CTA */}
            <button
              onClick={onMoveAllToCart}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Move All to Bag
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Slide-in animation (shared with CartDrawer, safe to redeclare) */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};
