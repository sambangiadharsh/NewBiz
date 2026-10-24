import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Check } from 'lucide-react';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  currency: string;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
}) => {
  const [justAdded, setJustAdded] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/product/${product.id}`);
  };

  const currSymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹';

  const formatPrice = (val: number) => {
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  const hasDiscount = Boolean(
    product.originalPrice && product.originalPrice > product.price
  );
  const discountPercent =
    hasDiscount && product.originalPrice > 0
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  const isOutOfStock =
    (product.stock !== undefined && product.stock <= 0) ||
    (Boolean(product.variants && product.variants.length > 0) &&
      product.variants!.every((v) => (v.stock ?? 0) <= 0));

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  const totalVariants = product.variants?.length || product.colors?.length || 0;
  const extraVariants = totalVariants > 1 ? totalVariants - 1 : 0;

  return (
    <div
      className="group relative bg-white rounded-2xl border border-stone-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] hover:border-stone-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* ── Top Image & Wishlist Overlay ─────────────────────────────────── */}
      <div
        onClick={handleNavigate}
        className="relative aspect-square w-full overflow-hidden bg-[#FAF9F6] cursor-pointer"
      >
        <img
          src={product.thumbnail || product.images?.[0]}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {/* Out of Stock Floating Badge */}
        {isOutOfStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-stone-900/80 text-white backdrop-blur-xs shadow-xs">
              Out of Stock
            </span>
          </div>
        )}

        {/* Floating Glassmorphic Wishlist Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product);
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className={`absolute top-2.5 right-2.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10 cursor-pointer ${
            isWishlisted
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-white/85 backdrop-blur-md text-stone-600 hover:text-rose-500 hover:bg-white border border-stone-200/60 shadow-2xs'
          }`}
        >
          <Heart className={`w-4 h-4 transition-transform active:scale-75 ${isWishlisted ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* ── Product Info & Actions ─────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          {/* Brand / Category Micro-Header */}
          <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            <span className="truncate">{product.brand?.brandName || product.category}</span>
          </div>

          {/* Product Title (Consistent 2-line box for flawless grid alignment) */}
          <h3
            onClick={handleNavigate}
            className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2 h-[2.25rem] sm:h-[2.5rem] hover:text-primary-700 cursor-pointer transition-colors leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Variants Count Micro-Pill */}
          {extraVariants > 0 && (
            <div className="pt-0.5">
              <span className="inline-flex items-center text-[10px] font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200/70 border border-stone-200/80 px-2 py-0.5 rounded-md transition-colors">
                +{extraVariants} more {extraVariants === 1 ? 'variant' : 'variants'}
              </span>
            </div>
          )}
        </div>

        {/* ── Price Block & Action Button ──────────────────────────────────── */}
        <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
          {/* Two-tier Clean Pricing Hierarchy */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-none">
                {currSymbol}{formatPrice(product.price)}
              </span>
            </div>

            {/* Strikethrough MRP and Discount Pill underneath */}
            {hasDiscount && (
              <div className="mt-1 flex items-center flex-wrap gap-1.5">
                <span className="text-xs text-stone-400 line-through font-medium leading-none">
                  {currSymbol}{formatPrice(product.originalPrice)}
                </span>
                {discountPercent > 0 && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded leading-tight">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Add to Bag Action Button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-label={isOutOfStock ? 'Out of stock' : 'Add product to bag'}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 shadow-xs ${
              isOutOfStock
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200/80'
                : justAdded
                ? 'bg-emerald-600 text-white shadow-emerald-200 cursor-pointer active:scale-95'
                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200 cursor-pointer active:scale-95'
            }`}
          >
            {isOutOfStock ? (
              <span>Out of Stock</span>
            ) : justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ── ProductCardSkeleton ────────────────────────────────────────────────────────
 * Exact 1:1 pixel anatomy placeholder that eliminates Cumulative Layout Shift (CLS)
 * when product listings are in loading state.
 */
export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
      {/* Image Frame Placeholder */}
      <div className="relative aspect-square w-full animate-shimmer">
        {/* Wishlist Pill Placeholder */}
        <div className="absolute top-2.5 right-2.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/70 shadow-2xs" />
      </div>

      {/* Info Body Placeholder */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          {/* Brand Line */}
          <div className="h-3 w-16 rounded-md animate-shimmer" />

          {/* 2-line Title Box */}
          <div className="space-y-1.5 h-[2.25rem] sm:h-[2.5rem]">
            <div className="h-3.5 w-full rounded-md animate-shimmer" />
            <div className="h-3.5 w-2/3 rounded-md animate-shimmer" />
          </div>

          {/* Variant Pill Placeholder */}
          <div className="h-4 w-20 rounded-md animate-shimmer" />
        </div>

        {/* Pricing & Button Bottom Bar */}
        <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
          <div className="space-y-1 flex-1">
            <div className="h-5 w-20 rounded-md animate-shimmer" />
            <div className="h-3 w-14 rounded-md animate-shimmer" />
          </div>
          <div className="h-8 w-16 rounded-xl animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
