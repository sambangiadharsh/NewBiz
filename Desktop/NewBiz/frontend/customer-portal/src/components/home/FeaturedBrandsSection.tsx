import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Tag, ExternalLink } from 'lucide-react';
import { brandsApi, getFullBrandImageUrl, StorefrontBrand } from '../../lib/brandsApi';

interface FeaturedBrandsSectionProps {
  onSelectBrand?: (brandName: string) => void;
}

export const FeaturedBrandsSection: React.FC<FeaturedBrandsSectionProps> = ({ onSelectBrand }) => {
  const [brands, setBrands] = useState<StorefrontBrand[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadBrands() {
      try {
        const data = await brandsApi.getFeaturedBrands();
        if (isMounted) {
          // If featured brands are returned, display them; otherwise fallback to active brands
          if (data && data.length > 0) {
            setBrands(data);
          } else {
            const allActive = await brandsApi.getAllActiveBrands();
            if (isMounted) {
              setBrands(allActive);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load storefront featured brands:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBrands();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleBrandClick = (brandName: string) => {
    if (onSelectBrand) {
      onSelectBrand(brandName);
    }
  };

  // If loading finished and no brands exist at all, omit section gracefully
  if (!isLoading && brands.length === 0) {
    return null;
  }

  return (
    <section className="py-14 bg-gradient-to-b from-slate-50/70 to-white border-t border-slate-200/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="space-y-2">
            
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Top Brands
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Shop genuine products directly from verified top brands.
            </p>
          </div>

          
        </div>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm animate-pulse space-y-4"
              >
                <div className="h-28 w-full bg-slate-100 rounded-2xl" />
                <div className="h-5 w-2/3 bg-slate-100 rounded-lg" />
                <div className="h-4 w-full bg-slate-100 rounded-lg" />
                <div className="h-8 w-full bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          /* Brands Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {brands.map((brand) => {
              const fullImg = getFullBrandImageUrl(brand.imageUrl || brand.imageURL);
              return (
                <div
                  key={brand.brandId}
                  onClick={() => handleBrandClick(brand.brandName)}
                  className="group relative bg-white rounded-3xl border border-slate-200/90 hover:border-primary-400/60 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none"
                >
                 

                  {/* Featured Badge */}
                  {brand.isFeatured && (
                    <div className="absolute top-4 right-4 z-10">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-[10px] font-bold tracking-wide uppercase shadow-xs">
                        <span>★</span>
                        <span>Featured</span>
                      </span>
                    </div>
                  )}

                  {/* Brand Display Graphic / Logo Container - Synchronized Pure White Background */}
                  <div className="w-full h-32 rounded-2xl bg-white border border-slate-100/90 group-hover:border-primary-200/60 transition-colors flex items-center justify-center p-4 relative overflow-hidden mb-5 shadow-xs">
                    {fullImg ? (
                      <img
                        src={fullImg}
                        alt={brand.brandName}
                        className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback to text monogram if image is broken
                          (e.target as HTMLElement).style.display = 'none';
                          const fallback = (e.target as HTMLElement).nextElementSibling;
                          if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                        }}
                      />
                    ) : null}

                    {/* Monogram Fallback */}
                    <div
                      className={`${
                        fullImg ? 'hidden' : 'flex'
                      } flex-col items-center justify-center text-center`}
                    >
                     
                    </div>
                  </div>

                  {/* Brand Meta Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                        {brand.brandName}
                      </h3>
                      
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {brand.description ||
                        (brand.manufacturer
                          ? `Manufactured by ${brand.manufacturer}`
                          : 'Official verified brand with premium product catalog.')}
                    </p>
                  </div>

                  {/* Card Bottom: Product Count & Action Link */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="inline-flex items-center space-x-1.5 text-slate-500 font-medium">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {brand.productsCount > 0
                          ? `${brand.productsCount} ${brand.productsCount === 1 ? 'Product' : 'Products'}`
                          : 'Curated Catalog'}
                      </span>
                    </div>

                    <div className="inline-flex items-center space-x-1 text-primary-600 font-bold group-hover:text-primary-700 transition-colors">
                      <span>Explore</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
