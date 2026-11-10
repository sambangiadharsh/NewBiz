import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, ArrowUpDown, Sparkles, Check, Home, RotateCcw } from 'lucide-react';
import noProductsIllustration from '../../assets/No_products_found.png';

interface ProductCatalogSectionProps {
  categoryNames?: string[];
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  searchFilterQuery: string;
  onClearSearch: () => void;
}

export const ProductCatalogSection: React.FC<ProductCatalogSectionProps> = ({
  categoryNames,
  products,
  selectedCategory,
  onSelectCategory,
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  searchFilterQuery,
  onClearSearch,
}) => {
  const [activeTab, setActiveTab] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Sync tab with external selectedCategory if needed
  const effectiveCategory = selectedCategory !== 'All' ? selectedCategory : activeTab;

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    if (effectiveCategory !== 'All') {
      if (effectiveCategory === 'Deals') {
        list = list.filter((p) => p.originalPrice > p.price);
      } else if (effectiveCategory === 'Trending') {
        list = list.filter((p) => p.isTrending || p.isBestSeller);
      } else {
        const eff = effectiveCategory.toLowerCase();
        list = list.filter(
          (p) =>
            p.category.toLowerCase().includes(eff) ||
            eff.includes(p.category.toLowerCase()) ||
            p.tags?.some((t) => t.toLowerCase().includes(eff)) ||
            p.name.toLowerCase().includes(eff)
        );
      }
    }

    // Search query filter
    if (searchFilterQuery.trim()) {
      const q = searchFilterQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // In-stock toggle
    if (onlyInStock) {
      list = list.filter((p) => p.stock > 0);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [products, effectiveCategory, searchFilterQuery, onlyInStock, sortBy]);

  const categories = categoryNames && categoryNames.length > 0 
    ? categoryNames 
    : ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  return (
    <section id="catalog-section" className="py-14 bg-slate-50/70 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Featured Products & Essentials
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Displaying {filteredProducts.length} items curated for quality, longevity, and design.
            </p>
          </div>

          {/* Filters & Sorting Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* In-Stock Toggle */}
            <button
              onClick={() => setOnlyInStock(!onlyInStock)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                onlyInStock
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                  onlyInStock ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                }`}
              >
                {onlyInStock && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span>In Stock Only</span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-4"
              >
                <option value="featured">Sort: Featured First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = effectiveCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveTab(cat);
                  onSelectCategory(cat);
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 shadow-sm ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Active Search Banner */}
        {searchFilterQuery && (
          <div className="mb-6 p-4 rounded-2xl bg-primary-50 border border-primary-200/70 flex items-center justify-between">
            <p className="text-xs text-primary-900">
              Showing search results for: <strong className="font-bold">"{searchFilterQuery}"</strong>
            </p>
            <button
              onClick={onClearSearch}
              className="text-xs font-bold text-primary-700 hover:text-primary-900 underline"
            >
              Clear Search Filter
            </button>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((prod) => (
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
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 text-center shadow-xs">
            <div className="relative inline-block mx-auto mb-6 group">
              <div className="absolute -inset-4 bg-emerald-100/30 rounded-full blur-2xl -z-10" />
              <img
                src={noProductsIllustration}
                alt="No Products Found"
                className="w-full max-w-[320px] sm:max-w-[380px] max-h-[300px] h-auto object-contain mx-auto select-none pointer-events-none drop-shadow-sm"
                loading="eager"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('All');
                  onSelectCategory('All');
                  onClearSearch();
                  setOnlyInStock(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs sm:text-sm shadow-md hover:bg-slate-800 transition-all cursor-pointer hover:-translate-y-0.5"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All Filters
              </button>
              <Link
                to="/"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-200 transition-all cursor-pointer hover:-translate-y-0.5 border border-slate-200"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Link>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
