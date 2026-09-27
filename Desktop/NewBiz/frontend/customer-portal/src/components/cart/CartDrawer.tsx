import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Tag, Check } from 'lucide-react';
import { CartItem } from '../../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  currency: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  currency,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number | null>(null);
  const [couponError, setCouponError] = useState('');

  if (!isOpen) return null;

  const rawSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = appliedDiscount ? (rawSubtotal * appliedDiscount) / 100 : 0;
  const subtotal = rawSubtotal - discountAmount;
  const freeShippingThreshold = 50.0;
  const isFreeShipping = rawSubtotal >= freeShippingThreshold;
  const shippingAmount = rawSubtotal === 0 ? 0 : isFreeShipping ? 0 : 9.99;
  const orderTotal = subtotal + shippingAmount;

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
  };
  const currSymbol = currencySymbols[currency] || '$';

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === 'FLASH20') {
      setAppliedDiscount(20);
      setCouponError('');
    } else {
      setCouponError('Invalid coupon code. Try FLASH20 for 20% off.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0B1E1F]/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-slide-up">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <ShoppingBag className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Your Shopping Bag ({items.reduce((s, i) => s + i.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close cart"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Banner */}
          {items.length > 0 && (
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                {isFreeShipping ? (
                  <span className="text-emerald-700 flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Unlocked Free Express Delivery!
                  </span>
                ) : (
                  <span className="text-slate-650">
                    Add {currSymbol}{(freeShippingThreshold - rawSubtotal).toFixed(2)} more for{' '}
                    <strong className="text-primary-600">FREE SHIPPING</strong>
                  </span>
                )}
                <span className="text-slate-400 text-[11px]">
                  {Math.min(100, Math.round((rawSubtotal / freeShippingThreshold) * 100))}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isFreeShipping ? 'bg-emerald-500' : 'bg-primary-600'
                  }`}
                  style={{ width: `${Math.min(100, (rawSubtotal / freeShippingThreshold) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Your bag is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Explore our curated catalog of minimalist audio, fashion, and living essentials.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors shadow-glow"
                >
                  Explore Collection
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.product.id} className="py-4 flex space-x-4 group">
                  <img
                    src={item.product.thumbnail}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-2xl border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate pr-2">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          aria-label="Remove item"
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">{item.product.category}</p>
                      {item.selectedColor && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Color: {item.selectedColor}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 px-1.5">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total Line Price */}
                      <span className="text-xs font-extrabold text-slate-900">
                        {currSymbol}{(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout Summary */}
          {items.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/60 space-y-4">
              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="flex space-x-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon code (e.g. FLASH20)"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Apply
                </button>
              </form>

              {appliedDiscount && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center justify-between font-semibold">
                  <span>Coupon FLASH20 applied (20% Off)</span>
                  <span>-{currSymbol}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {couponError && (
                <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>
              )}

              {/* Price breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">{currSymbol}{rawSubtotal.toFixed(2)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount (20%)</span>
                    <span>-{currSymbol}{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-semibold text-slate-900">
                    {shippingAmount === 0 ? (
                      <span className="text-emerald-600 uppercase font-bold">Free</span>
                    ) : (
                      `${currSymbol}${shippingAmount.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-950 pt-2 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="text-base text-primary-600">{currSymbol}{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={onCheckout}
                className="w-full py-3.5 px-4 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-glow hover:scale-[1.01]"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Encrypted 256-Bit SSL Checkout & Guaranteed Returns</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
