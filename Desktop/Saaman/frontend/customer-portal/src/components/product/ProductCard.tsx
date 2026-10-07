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

  const currSymbol = '₹';

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-3xl border border-slate-200/80 shadow-subtle hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Image & Overlays */}
      <div 
        onClick={handleNavigate}
        className="relative aspect-square w-full overflow-hidden bg-slate-50 cursor-pointer"
      >
        <img
          src={isHovered && product.images[1] ? product.images[1] : product.thumbnail}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Wishlist Button on Top Right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product);
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className={`absolute top-3.5 right-3.5 w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-200 z-10 ${
            isWishlisted
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-white/90 backdrop-blur-md text-slate-600 hover:text-rose-500 hover:bg-white shadow-sm'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* Product Details Info */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Category */}
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[11px] font-semibold text-primary-600 tracking-wide uppercase">
              {product.category}
            </span>
          </div>

          {/* Product Title */}
          <h3
            onClick={handleNavigate}
            className="text-sm font-bold text-slate-900 line-clamp-1 hover:text-primary-600 cursor-pointer transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>

          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {product.subtitle}
          </p>

          {/* Color Dots (if available) */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center space-x-1.5 mt-2.5">
              {product.colors.map((c, i) => (
                <span
                  key={i}
                  className="w-3 h-3 rounded-full border border-slate-300 shadow-inner"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
              <span className="text-[10px] text-slate-400 font-medium ml-1">
                {product.colors.length} colors
              </span>
            </div>
          )}
        </div>

        {/* Price & Add to Bag */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
          <div className="min-w-0">
            <div className="flex items-baseline space-x-1">
              <span className="text-sm sm:text-base font-extrabold text-slate-950">
                {currSymbol}{product.price.toFixed(2)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-[11px] text-slate-400 line-through font-medium">
                  {currSymbol}{product.originalPrice.toFixed(0)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pr-0.5">
            {discountPercent > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-extrabold tracking-tight shrink-0">
                {discountPercent}% OFF
              </span>
            )}

            <button
              onClick={handleAdd}
              aria-label="Add product to bag"
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all duration-200 ${
                justAdded
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white shadow-sm'
              }`}
            >
              {justAdded ? (
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
    </div>
  );
};
