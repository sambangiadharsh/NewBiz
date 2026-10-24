import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { brandsApi, getFullBrandImageUrl, StorefrontBrand } from '../../lib/brandsApi';

interface FeaturedBrandsSectionProps {
  onSelectBrand?: (brandName: string) => void;
}

export const FeaturedBrandsSection: React.FC<FeaturedBrandsSectionProps> = ({ onSelectBrand }) => {
  const [brands, setBrands] = useState<StorefrontBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBrands() {
      try {
        const data = await brandsApi.getFeaturedBrands();
        if (isMounted) {
          if (data && data.length > 0) {
            setBrands(data);
          } else {
            const allActive = await brandsApi.getAllActiveBrands();
            if (isMounted) setBrands(allActive);
          }
        }
      } catch (err) {
        console.warn('Failed to load brands:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBrands();
    return () => { isMounted = false; };
  }, []);

  // Hide section if no brands
  if (!isLoading && brands.length === 0) return null;

  // Duplicate brands list to create seamless infinite scroll effect
  const marqueeBrands = [...brands, ...brands, ...brands];

  return (
    <section className="py-10 bg-[#FAF9F6] border-b border-stone-200/70 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-7">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                Trusted Brands
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Verified &amp; quality-checked sellers
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:block">
            {isLoading ? '...' : `${brands.length} verified brands`}
          </span>
        </div>
      </div>

      {/* ── Marquee Strip ──────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Loading skeleton row */
        <div className="flex items-center gap-6 px-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-32 h-14 rounded-2xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          {/* Scrolling track */}
          <div className="flex overflow-hidden">
            <div
              ref={trackRef}
              className="flex items-center gap-4 flex-shrink-0"
              style={{
                animation: isPaused
                  ? 'none'
                  : 'marquee 28s linear infinite',
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            >
              {marqueeBrands.map((brand, idx) => {
                const imgSrc = getFullBrandImageUrl(brand.imageUrl || brand.imageURL);
                return (
                  <button
                    key={`${brand.brandId}-${idx}`}
                    onClick={() => onSelectBrand?.(brand.brandName)}
                    title={brand.brandName}
                    className="flex-shrink-0 group flex items-center gap-3 bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-primary-300/60 hover:shadow-md rounded-2xl px-5 py-3 transition-all duration-200 cursor-pointer"
                  >
                    {/* Brand logo or monogram */}
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={brand.brandName}
                        className="h-8 max-w-[80px] object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center justify-center text-sm font-black">
                        {brand.brandName.charAt(0)}
                      </div>
                    )}

                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-primary-700 transition-colors whitespace-nowrap leading-tight">
                        {brand.brandName}
                      </p>
                      {brand.productsCount > 0 && (
                        <p className="text-[10px] text-slate-400 font-medium leading-tight">
                          {brand.productsCount} products
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Marquee CSS keyframe — injected inline to avoid a separate CSS file */}
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
};
