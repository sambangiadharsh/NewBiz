import React, { useState, useMemo } from 'react';
import { ArrowRight, Layers, Sparkles, Tag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product, Category } from '../../types';
import { ProductCard } from '../product/ProductCard';
import {
  Home, Coffee, Compass, Laptop, Shirt, Smartphone, Watch, Headphones,
  Camera, Tv, Utensils, Dumbbell, Heart, Baby, BookOpen, Package,
  ShoppingBag, Car, Flame, Gift,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  home: Home, coffee: Coffee, compass: Compass, laptop: Laptop, shirt: Shirt,
  smartphone: Smartphone, watch: Watch, headphones: Headphones, camera: Camera,
  tv: Tv, utensils: Utensils, dumbbell: Dumbbell, heart: Heart, baby: Baby,
  bookopen: BookOpen, package: Package, shoppingbag: ShoppingBag, car: Car,
  flame: Flame, gift: Gift, layers: Layers,
};

const CategoryIcon: React.FC<{ iconName?: string; className?: string }> = ({
  iconName,
  className = 'w-4 h-4',
}) => {
  if (!iconName) return <Layers className={className} />;
  const Comp = ICON_MAP[iconName.toLowerCase()] ?? Layers;
  return <Comp className={className} />;
};

interface CategoryProductRailProps {
  category: Category;
  products: Product[];
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  onExploreCategory: (categorySlug: string) => void;
  allRails?: { category: Category; products: Product[] }[];
}

export const CategoryProductRail: React.FC<CategoryProductRailProps> = ({
  category,
  products,
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  onExploreCategory,
  allRails,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  const rails = allRails ?? [{ category, products }];

  // Deduplicate rails by category ID
  const uniqueRails = useMemo(() => {
    const seen = new Set<string>();
    return rails.filter(({ category: c }) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [rails]);

  const activeRail = uniqueRails[activeTab] ?? uniqueRails[0];
  if (!activeRail) return null;

  // 100% Dynamic statistics calculated directly from active database products
  const { minPrice, maxDiscount, heroImage, subCategoryTags } = useMemo(() => {
    const prods = activeRail.products;
    if (prods.length === 0) {
      return {
        minPrice: 0,
        maxDiscount: 0,
        heroImage: activeRail.category.image || '',
        subCategoryTags: [],
      };
    }

    const prices = prods.map((p) => p.price);
    const minP = Math.min(...prices);

    const discounts = prods.map((p) => {
      if (p.originalPrice > p.price && p.originalPrice > 0) {
        return Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
      }
      return 0;
    });
    const maxD = Math.max(0, ...discounts);

    // Pick dynamic hero image: prefer first product's high-res thumbnail or category image
    const heroImg =
      prods[0]?.thumbnail ||
      (prods[0]?.images && prods[0].images[0]) ||
      activeRail.category.image ||
      '';

    // Extract dynamic subcategories from DB category hierarchy or distinct products
    const rawSubs: string[] = [];
    if (activeRail.category.subCategories && activeRail.category.subCategories.length > 0) {
      activeRail.category.subCategories.forEach((s) => {
        if (s.title) rawSubs.push(s.title);
      });
    }
    prods.forEach((p) => {
      if (p.subCategory && !rawSubs.includes(p.subCategory)) {
        rawSubs.push(p.subCategory);
      }
    });

    return {
      minPrice: minP,
      maxDiscount: maxD,
      heroImage: heroImg,
      subCategoryTags: rawSubs.slice(0, 4),
    };
  }, [activeRail]);

  // Display top 3 products on the right side of the showcase
  const displayProducts = activeRail.products.slice(0, 3);
  const remainingCount = Math.max(0, activeRail.products.length - 3);

  return (
    <section className="py-14 bg-gradient-to-b from-white via-slate-50/50 to-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── Section Header ───────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Curated Departments</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Explore Popular Collections
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl font-medium">
              Verified catalog items directly dispatched from regional fulfillment hubs across{' '}
              <span className="font-bold text-slate-700">{uniqueRails.length} departments</span>.
            </p>
          </div>

          <button
            onClick={() => onExploreCategory('all')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all group self-start md:self-auto cursor-pointer"
          >
            <span>View All Departments</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* ── Dynamic Department Selector Track ─────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {uniqueRails.map((rail, idx) => {
            const isSelected = activeTab === idx;
            return (
              <button
                key={rail.category.id}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-950 text-white shadow-md scale-[1.02]'
                    : 'bg-white border border-slate-200/80 text-slate-650 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <CategoryIcon
                  iconName={rail.category.icon}
                  className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}
                />
                <span>{rail.category.name}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {rail.products.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Dynamic Department Showcase Split-Deck ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Hero Spotlight Card (Editorial Anchor - 40% width) */}
          <div className="lg:col-span-5 relative rounded-3xl overflow-hidden shadow-subtle border border-slate-200/80 min-h-[380px] lg:min-h-[440px] flex flex-col justify-between p-6 sm:p-8 bg-slate-900 group">
            {/* Dynamic Background Image */}
            {heroImage && (
              <img
                src={heroImage}
                alt={activeRail.category.name}
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            )}
            
            {/* Gradient Overlays for readable text */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/30" />

            {/* Top Dynamic Anchors */}
            <div className="relative z-10 flex flex-wrap items-center gap-2">
              {minPrice > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-900 shadow-sm backdrop-blur-md">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  From {currency}{minPrice.toFixed(0)}
                </span>
              )}

              {maxDiscount > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-sm">
                  Up to {maxDiscount}% OFF
                </span>
              )}

              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 text-white/90 backdrop-blur-md">
                {activeRail.products.length} Items Live
              </span>
            </div>

            {/* Bottom Content & Direct Subcategory Discovery */}
            <div className="relative z-10 mt-auto pt-8">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">
                Featured Department
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-2">
                {activeRail.category.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-medium line-clamp-2 mb-4 leading-relaxed">
                Explore handpicked verified items with door-to-door insured logistics and genuine warranty.
              </p>

              {/* Dynamic Subcategory Chips */}
              {subCategoryTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {subCategoryTags.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => navigate(`/category/${activeRail.category.slug}?sub=${encodeURIComponent(sub)}`)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur-sm transition-all cursor-pointer border border-white/10"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => onExploreCategory(activeRail.category.slug)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-extrabold text-xs shadow-md transition-all group/btn cursor-pointer"
              >
                <span>Browse All {activeRail.category.name}</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Curated Products Grid (60% width) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 h-full">
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onToggleWishlist={onToggleWishlist}
                  onAddToCart={onAddToCart}
                />
              ))}

              {/* Dynamic "+N More" Teaser Card if catalog has more products */}
              {remainingCount > 0 && (
                <div
                  onClick={() => onExploreCategory(activeRail.category.slug)}
                  className="rounded-3xl border-2 border-dashed border-slate-300 hover:border-slate-800 bg-slate-50/70 hover:bg-white p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-300 min-h-[220px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-800 mb-3 group-hover:scale-110 group-hover:bg-slate-950 group-hover:text-white transition-all">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">
                    +{remainingCount} More Items
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    In {activeRail.category.name}
                  </p>
                  <span className="mt-3 text-xs font-bold text-emerald-700 underline group-hover:text-emerald-800">
                    View Entire Department
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
