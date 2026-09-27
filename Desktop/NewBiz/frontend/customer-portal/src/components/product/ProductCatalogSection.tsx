import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, ArrowUpDown, Sparkles, Check } from 'lucide-react';

interface ProductCatalogSectionProps {
  categoryNames?: string[];
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onQuickView: (p: Product) => void;
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
  onQuickView,
  onAddToCart,
  searchFilterQuery,
  onClearSearch,
}) => {
  const [activeTab, setActiveTab] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
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
        list = list.filter(
          (p) => p.category.toLowerCase() === effectiveCategory.toLowerCase()
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
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [products, effectiveCategory, searchFilterQuery, onlyInStock, sortBy]);

  const categories = categoryNames && categoryNames.length > 0 ? categoryNames : ['All', 'HOME', 'KITCHEN', 'TRAVEL'];

  return (
    <section id="catalog-section" className="py-14 bg-slate-50/70 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center space-x-1.5 text-primary-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full Catalog</span>
            </div>
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
                <option value="rating">Highest Rated</option>
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
                onQuickView={onQuickView}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-subtle">
            <SlidersHorizontal className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No products match your criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your category selection, stock filter, or clearing the search term.
            </p>
            <button
              onClick={() => {
                setActiveTab('All');
                onSelectCategory('All');
                onClearSearch();
                setOnlyInStock(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
