import React, { useState, useEffect, useRef } from 'react';
import {
  X, Trash2, Plus, Minus, ArrowRight, ShoppingBag,
  Tag, Check, Truck, Sparkles, AlertCircle,
} from 'lucide-react';
import { CartItem } from '../../types';
import { promotionsApi, ValidatedPromotion } from '../../lib/promotionsApi.js';
import { getImageUrl } from '../../lib/productsApi';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  currency: string;
}

const SHIPPING_FEE     = 49;
const CURR             = '₹';

// Live stock resolver helper for cart items
export const resolveCartItemStock = (item: CartItem): number => {
  if (item.product?.variants && item.product.variants.length > 0) {
    const matchedV = item.product.variants.find((v) =>
      (!item.selectedColor || (v.attributes || []).some((a) => a.value?.toLowerCase() === item.selectedColor?.toLowerCase())) &&
      (!item.selectedSize || (v.attributes || []).some((a) => a.value?.toLowerCase() === item.selectedSize?.toLowerCase()))
    );
    if (matchedV && typeof matchedV.stock === 'number') {
      return matchedV.stock;
    }
  }
  return typeof item.product?.stock === 'number' ? item.product.stock : 99;
};

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const [couponCode, setCouponCode]       = useState('');
  const [appliedPromo, setAppliedPromo]   = useState<ValidatedPromotion | null>(() => {
    try {
      const saved = sessionStorage.getItem('saamaan_applied_coupon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError]     = useState('');
  const [removing, setRemoving]           = useState<string | null>(null);

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Lock body scroll while open ──────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Derived values ────────────────────────────────────────────────────────
  const subtotalRaw    = items.reduce((s, i) => s + (Number(i.product?.price) || 0) * (Number(i.quantity) || 1), 0);
  const discountAmt    = appliedPromo
    ? appliedPromo.discountType === 'PERCENTAGE'
      ? Math.min((subtotalRaw * appliedPromo.discountValue) / 100, appliedPromo.maxDiscountAmount || Infinity)
      : Math.min(appliedPromo.discountValue, subtotalRaw)
    : 0;
  const subtotalNet    = Math.max(0, subtotalRaw - discountAmt);
  const shippingAmt    = items.length === 0 ? 0 : SHIPPING_FEE;
  const orderTotal     = subtotalNet + shippingAmt;
  const totalUnits     = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  const itemCount      = items.length;
  const totalItems     = items.length;

  // ── Live inventory gatekeeping calculations ──────────────────────────────
  const hasOutOfStockItems = items.some((item) => resolveCartItemStock(item) <= 0);
  const hasInsufficientStockItems = items.some((item) => {
    const s = resolveCartItemStock(item);
    return s > 0 && item.quantity > s;
  });
  const canProceedToCheckout = !hasOutOfStockItems && !hasInsufficientStockItems;

  // ── Coupon ────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = couponCode.trim();
    if (!key) return;

    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await promotionsApi.validate(key, subtotalRaw);
      setAppliedPromo(res.promotion);
      try {
        sessionStorage.setItem('saamaan_applied_coupon', JSON.stringify(res.promotion));
      } catch {}
      setCouponError('');
    } catch (err: any) {
      setCouponError(err.message || 'Invalid or expired coupon code');
      setAppliedPromo(null);
      try {
        sessionStorage.removeItem('saamaan_applied_coupon');
      } catch {}
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedPromo(null);
    setCouponCode('');
    setCouponError('');
    try {
      sessionStorage.removeItem('saamaan_applied_coupon');
    } catch {}
  };

  // ── Animated remove ───────────────────────────────────────────────────────
  const handleRemove = (id: string) => {
    setRemoving(id);
    setTimeout(() => {
      onRemoveItem(id);
      setRemoving(null);
    }, 280);
  };

  if (!isOpen) return null;

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
        aria-label="Shopping bag"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[420px] bg-[#FAF9F6] shadow-2xl border-l border-stone-200/80"
        style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/70 bg-[#FAF9F6]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                Shopping Bag
              </h2>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                {itemCount === 0
                  ? 'Empty'
                  : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}${
                      totalUnits > itemCount ? ` (${totalUnits} units)` : ''
                    }`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Item List ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {items.length === 0 ? (
            /* ── Empty State ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                  <ShoppingBag className="w-9 h-9 text-slate-300" />
                </div>
             
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Your bag is empty</h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">
                  Browse our curated collection and find something you love.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-colors shadow-md"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            items.map((item) => {
              const isRemoving = removing === item.product.id;
              const linePrice  = item.product.price * item.quantity;
              const saved      = item.product.originalPrice > item.product.price
                ? (item.product.originalPrice - item.product.price) * item.quantity
                : 0;

              const stock = resolveCartItemStock(item);
              const isOutOfStock = stock <= 0;
              const hasInsufficientStock = stock > 0 && item.quantity > stock;

              return (
                <div
                  key={item.product.id}
                  className={`py-4 flex gap-3.5 border-b border-slate-100/80 last:border-0 transition-all duration-300 ${
                    isRemoving ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100'
                  }`}
                >
                  {/* Thumbnail - only shown if primary image exists, with out-of-stock badge */}
                  {item.product?.thumbnail ? (
                    <div className="relative flex-shrink-0">
                      <img
                        src={getImageUrl(item.product.thumbnail)}
                        alt={item.product.name}
                        className={`w-[76px] h-[76px] object-cover rounded-2xl border ${
                          isOutOfStock ? 'border-rose-200 opacity-60 grayscale' : 'border-slate-100'
                        }`}
                        loading="lazy"
                        onError={(e) => {
                          const container = (e.currentTarget.parentElement as HTMLElement);
                          if (container) container.style.display = 'none';
                        }}
                      />
                      {isOutOfStock ? (
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                          SOLD OUT
                        </span>
                      ) : saved > 0 ? (
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          SALE
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide truncate">
                          {item.product.category}
                        </p>
                        <h4 className="text-xs font-bold text-slate-900 truncate leading-snug mt-0.5">
                          {item.product.name}
                        </h4>
                        {(item.selectedColor || item.selectedSize) && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.selectedColor && `Color: ${item.selectedColor}`}
                            {item.selectedColor && item.selectedSize && ' · '}
                            {item.selectedSize && `Size: ${item.selectedSize}`}
                          </p>
                        )}

                        {/* Live Inventory Status Alerts */}
                        {isOutOfStock && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          </div>
                        )}
                        {!isOutOfStock && hasInsufficientStock && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Only {stock} available in stock
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(item.product.id)}
                        aria-label="Remove item"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0 cursor-pointer"
                        title="Remove from bag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Qty + Price row */}
                    <div className="flex items-center justify-between mt-2.5">
                      {/* Qty stepper */}
                      <div
                        className={`flex items-center gap-0 border rounded-xl overflow-hidden bg-slate-50 transition-opacity ${
                          isOutOfStock
                            ? 'border-slate-200 opacity-40 pointer-events-none'
                            : 'border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          disabled={isOutOfStock}
                          aria-label="Decrease quantity"
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-extrabold text-slate-900 w-8 text-center select-none">
                          {isOutOfStock ? 0 : item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          disabled={isOutOfStock || (stock > 0 && item.quantity >= stock)}
                          aria-label="Increase quantity"
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line price */}
                      <div className="text-right">
                        <p className={`text-sm font-extrabold ${isOutOfStock ? 'text-slate-400 line-through' : 'text-slate-950'}`}>
                          {CURR}{linePrice.toFixed(2)}
                        </p>
                        {saved > 0 && !isOutOfStock && (
                          <p className="text-[10px] text-emerald-600 font-semibold">
                            saves {CURR}{saved.toFixed(0)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="border-t border-stone-200/70 bg-[#FAF9F6] p-5 space-y-4">

            {/* Coupon */}
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <Check className="w-4 h-4 bg-emerald-500 text-white rounded-full p-0.5" />
                  {appliedPromo.code} - {appliedPromo.name || (appliedPromo.discountType === 'PERCENTAGE' ? `${appliedPromo.discountValue}% OFF` : `₹${appliedPromo.discountValue} OFF`)}
                  <span className="font-extrabold">(-{CURR}{discountAmt.toFixed(0)})</span>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-emerald-500 hover:text-rose-500 transition-colors"
                  aria-label="Remove coupon"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                    placeholder="Coupon code"
                    className="w-full pl-8 pr-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!couponCode.trim() || isValidatingCoupon}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {isValidatingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </form>
            )}
            {couponError && (
              <p className="text-[11px] text-rose-600 font-medium -mt-2">{couponError}</p>
            )}

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold text-slate-900">{CURR}{subtotalRaw.toFixed(2)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon discount ({appliedPromo.code})</span>
                  <span className="font-bold">−{CURR}{discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3 text-slate-400" />
                  Delivery
                </span>
                <span className={`font-semibold ${shippingAmt === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {shippingAmt === 0 ? 'FREE' : `${CURR}${shippingAmt.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-950">
                <span>Order Total</span>
                <span className="text-primary-600 text-base">{CURR}{orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Inventory Notice Banner if blocked */}
            {!canProceedToCheckout && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs shadow-2xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  {hasOutOfStockItems ? (
                    <span>
                      <strong className="font-bold">Items Sold Out:</strong> Some items in your bag have become unavailable. Please remove them to proceed.
                    </span>
                  ) : (
                    <span>
                      <strong className="font-bold">Limited Stock:</strong> Quantity selected for one or more items exceeds our remaining warehouse inventory.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={onCheckout}
              disabled={!canProceedToCheckout}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                canProceedToCheckout
                  ? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white shadow-lg shadow-primary-600/25 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <span>{hasOutOfStockItems ? 'Remove Sold Out Items to Checkout' : 'Proceed to Checkout'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Drawer slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};
