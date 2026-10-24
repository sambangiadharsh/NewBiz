import React, { useState, useEffect } from 'react';
import { Flame, Clock, ArrowRight } from 'lucide-react';
import { Product } from '../../types';
import { ProductCard, ProductCardSkeleton } from '../product/ProductCard';

interface FlashDealsProps {
  products: Product[];
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  isLoading?: boolean;
}

export const FlashDealsCountdown: React.FC<FlashDealsProps> = ({
  products,
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  isLoading = false,
}) => {
  // Live countdown timer for deal end (e.g. 14 hours 28 mins)
  const [timeLeft, setTimeLeft] = useState({
    hours: 14,
    minutes: 36,
    seconds: 45,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // While catalog is fetching, render high-fidelity shimmer skeleton
  if (isLoading) {
    return (
      <section className="py-14 bg-[#FAF9F6] border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="space-y-2">
              <div className="h-4 w-32 rounded-md animate-shimmer" />
              <div className="h-8 w-60 rounded-lg animate-shimmer" />
              <div className="h-3.5 w-72 rounded-md animate-shimmer" />
            </div>
            <div className="h-12 w-48 rounded-2xl animate-shimmer self-start md:self-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Filter top 4 deal products
  const dealProducts = products.slice(0, 4);

  // If loading has completed and there are no deal/catalog products, cleanly collapse
  if (dealProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-14 bg-[#FAF9F6] border-b border-stone-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with Countdown */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-2 text-rose-600 text-xs font-extrabold uppercase tracking-wider mb-1">
              <Flame className="w-4 h-4 fill-rose-500 animate-pulse" />
              <span>Limited-Time Offer</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Today's Flash Deals
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Hand-picked bestsellers at special seasonal promotional rates.
            </p>
          </div>

          {/* Countdown Clock Box */}
          <div className="flex items-center space-x-3 bg-white border border-slate-200 shadow-card px-5 py-3 rounded-2xl self-start md:self-auto">
            <Clock className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-slate-700">Ends In:</span>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-extrabold text-slate-900">
              <span className="bg-slate-900 text-white px-2 py-1 rounded-lg">
                {String(timeLeft.hours).padStart(2, '0')}h
              </span>
              <span>:</span>
              <span className="bg-slate-900 text-white px-2 py-1 rounded-lg">
                {String(timeLeft.minutes).padStart(2, '0')}m
              </span>
              <span>:</span>
              <span className="bg-rose-600 text-white px-2 py-1 rounded-lg animate-pulse">
                {String(timeLeft.seconds).padStart(2, '0')}s
              </span>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dealProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              currency={currency}
              isWishlisted={wishlistIds.includes(prod.id)}
              onToggleWishlist={onToggleWishlist}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>

      </div>
    </section>
  );
};
