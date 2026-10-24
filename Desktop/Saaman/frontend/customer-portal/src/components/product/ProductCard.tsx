import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Check } from 'lucide-react';
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
  const [isHovered, setIsHovered] = useState(false);
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
  const discountAmount = hasDiscount ? product.originalPrice - product.price : 0;
  const discountPercent =
    hasDiscount && product.originalPrice > 0
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] hover:border-slate-300 transition-all duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Image & Overlays */}
      <div
        onClick={handleNavigate}
        className="relative aspect-square w-full overflow-hidden bg-slate-50 cursor-pointer"
      >
        <img
          src={isHovered && product.images?.[1] ? product.images[1] : product.thumbnail}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {/* Wishlist Button on Top Right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product);
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className={`absolute top-2.5 right-2.5 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 z-10 cursor-pointer ${
            isWishlisted
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-white/90 backdrop-blur-md text-slate-600 hover:text-rose-500 hover:bg-white shadow-sm'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* Product Details Info */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          {/* Brand / Category */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-[11px] font-bold text-primary-600 tracking-wider uppercase truncate">
              {product.brand?.brandName || product.category}
            </span>
          </div>

          {/* Product Title */}
          <h3
            onClick={handleNavigate}
            className="text-sm font-bold text-slate-900 line-clamp-2 hover:text-primary-700 cursor-pointer transition-colors leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Subtitle (Rendered strictly if exists) */}
          {product.subtitle && (
            <p className="text-xs text-slate-500 line-clamp-1">
              {product.subtitle}
            </p>
          )}

          {/* Color Dots (Rendered strictly if available) */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center space-x-1 pt-0.5">
              {product.colors.map((c, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
              <span className="text-[10px] text-slate-400 font-medium ml-1">
                {product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'}
              </span>
            </div>
          )}

          {/* Low Stock Warning (Strictly dynamic) */}
          {product.stock !== undefined && product.stock > 0 && product.stock <= 5 && (
            <p className="text-[10px] font-semibold text-amber-600">
              Only {product.stock} left in stock
            </p>
          )}
        </div>

        {/* Pricing, Savings & Add to Bag */}
        <div className="pt-2.5 border-t border-slate-100 flex items-end justify-between gap-2">
          {/* Price & Dynamic Discount Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
              <span className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                {currSymbol}{formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-slate-400 line-through font-medium">
                  {currSymbol}{formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Dynamic Discount Savings & Percentage */}
            {hasDiscount && (
              <div className="mt-1 flex items-center flex-wrap gap-1">
                {discountAmount > 0 && (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                    Save {currSymbol}{formatPrice(discountAmount)}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="inline-flex items-center text-[10px] font-extrabold text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Add to Bag Button */}
          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-label={isOutOfStock ? 'Out of stock' : 'Add product to bag'}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-xs ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : justAdded
                ? 'bg-emerald-600 text-white shadow-emerald-200 scale-95'
                : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95 shadow-primary-200'
            }`}
          >
            {isOutOfStock ? (
              <span>Sold Out</span>
            ) : justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

