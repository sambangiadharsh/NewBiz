import React, { useState } from 'react';
import { X, ShoppingCart, Heart, ShieldCheck, Truck, RefreshCw, Check, Sparkles, CheckCircle2 } from 'lucide-react';
import { Product } from '../../types';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  currency: string;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number, color?: string, size?: string) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  currency,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
}) => {
  if (!product) return null;

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.name);
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0]);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const currSymbol = '₹';

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedColor, selectedSize);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-modal border border-slate-200/90 overflow-hidden max-h-[92vh] flex flex-col md:flex-row animate-slide-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 shadow-md backdrop-blur-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Gallery */}
        <div className="w-full md:w-1/2 p-6 bg-slate-50 flex flex-col justify-between">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-slate-200/70">
            <img
              src={product.images[selectedImageIdx] || product.thumbnail}
              alt={product.name}
              className="w-full h-full object-cover transition-all duration-300"
            />
            {discountPercent > 0 && (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                Save {discountPercent}%
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex space-x-3 mt-4 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-primary-600 ring-2 ring-primary-500/20'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info & Actions */}
        <div className="w-full md:w-1/2 p-8 overflow-y-auto space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">
                {product.category}
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {product.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{product.subtitle}</p>

            {/* Price */}
            <div className="flex items-baseline space-x-3 mt-4">
              <span className="text-2xl font-black text-slate-900">
                {currSymbol}{product.price.toFixed(2)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-sm text-slate-400 line-through">
                  {currSymbol}{product.originalPrice.toFixed(2)}
                </span>
              )}
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                In Stock ({product.stock} units available)
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-650 leading-relaxed">
            {product.description}
          </p>

          {/* Key Product Highlights */}
          {((product.highlights && product.highlights.length > 0) || (product.features && product.features.length > 0)) && (
            <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                Key Product Highlights
              </h4>
              <ul className="space-y-2">
                {(product.highlights && product.highlights.length > 0 ? product.highlights : product.features).slice(0, 6).map((item, idx) => (
                  <li key={idx} className="flex items-start text-xs text-slate-700 space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Color Picker */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Color: <span className="text-slate-500 font-normal">{selectedColor}</span>
              </label>
              <div className="flex items-center space-x-3">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedColor === c.name
                        ? 'border-primary-600 ring-2 ring-primary-500/30 scale-110'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.name && (
                      <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Picker */}
          {product.sizes && product.sizes.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Size: <span className="text-slate-500 font-normal">{selectedSize}</span>
              </label>
              <div className="flex items-center space-x-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedSize === s
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & CTA buttons */}
          <div className="flex items-center space-x-4 pt-4 border-t border-slate-100">
            <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold"
              >
                -
              </button>
              <span className="w-8 text-center text-xs font-bold text-slate-900">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAdd}
              className={`flex-1 py-3 px-6 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-glow ${
                justAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Bag!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Bag • {currSymbol}{(product.price * quantity).toFixed(2)}</span>
                </>
              )}
            </button>

            <button
              onClick={() => onToggleWishlist(product)}
              className={`p-3 rounded-2xl border transition-colors ${
                isWishlisted
                  ? 'border-rose-200 bg-rose-50 text-rose-500'
                  : 'border-slate-200 text-slate-500 hover:text-rose-500 hover:bg-slate-50'
              }`}
              title="Add to Wishlist"
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
            </button>
          </div>

          {/* Guarantees List */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <Truck className="w-4 h-4 text-primary-500 mb-1" />
              <span>Free Delivery</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <RefreshCw className="w-4 h-4 text-emerald-500 mb-1" />
              <span>30-Day Returns</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <ShieldCheck className="w-4 h-4 text-primary-500 mb-1" />
              <span>2-Year Warranty</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
