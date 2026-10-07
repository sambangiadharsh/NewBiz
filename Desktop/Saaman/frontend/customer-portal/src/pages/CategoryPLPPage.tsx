import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Package,
  Layers,
  ArrowUpDown,
  LayoutGrid,
  Grid,
  Search,
  Tag,
  Flame,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Product, Category } from '../types';
import { ProductCard } from '../components/product/ProductCard';
import { extractDynamicFacets, filterProductsByFacets } from '../lib/facetEngine';
import { DynamicFacetSection } from '../components/product/DynamicFacetSection';
import { SelectedFacets } from '../types/facets';

interface CategoryPLPPageProps {
  categories: Category[];
  allProducts: Product[];
  currency: string;
  wishlistIds: string[];
  onToggleWishlist: (p: Product) => void;
  onAddToCart: (p: Product, quantity?: number) => void;
}

export const CategoryPLPPage: React.FC<CategoryPLPPageProps> = ({
  categories,
  allProducts,
  currency,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
}) => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Desktop sidebar collapse toggle & mobile drawer open state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Grid density: 'compact' (4 cols) or 'spacious' (2/3 cols)
  const [viewDensity, setViewDensity] = useState<'compact' | 'spacious'>('compact');

  // Brand search input within filter facet
  const [brandSearchQuery, setBrandSearchQuery] = useState('');

  // Read URL query params (Zero static)
  const searchQuery = searchParams.get('q') || '';
  const selectedSub = searchParams.get('sub') || 'All';
  const selectedBrand = searchParams.get('brand') || 'All';
  const sortBy = searchParams.get('sort') || 'featured';
  const inStockOnly = searchParams.get('inStock') === 'true';
  const onSaleOnly = searchParams.get('onSale') === 'true';
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : null;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : null;

  // Resolve current active category from slug
  const currentCategory = useMemo(() => {
    if (!slug || slug === 'all' || slug === 'categories') return null;
    const normalized = slug.toLowerCase();
    return (
      categories.find(
        (c) =>
          c.slug.toLowerCase() === normalized ||
          c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalized
      ) || null
    );
  }, [categories, slug]);

  // Dynamic Page Title & Description
  const pageTitle = useMemo(() => {
    if (searchQuery) return `Search Results for "${searchQuery}"`;
    if (currentCategory) return currentCategory.name;
    if (slug && slug !== 'all' && slug !== 'categories') {
      return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    if (selectedBrand !== 'All') return `${selectedBrand} Collection`;
    return 'All Catalog Products';
  }, [searchQuery, currentCategory, slug, selectedBrand]);

  // Compute products matching the base category or search query
  const baseCategoryProducts = useMemo(() => {
    let list = [...allProducts];

    // Filter by Category if on a category route
    if (currentCategory) {
      const cName = currentCategory.name.toLowerCase();
      const cSlug = currentCategory.slug.toLowerCase();

      // Collect all child subcategory titles and leaf items
      const subItemNames = (currentCategory.subCategories || []).flatMap((s) => [
        s.title.toLowerCase(),
        ...(s.items || []).map((i) => i.toLowerCase()),
      ]);

      const matchedInTree = list.filter((p) => {
        const pCat = (p.category || '').toLowerCase();
        const pSlug = (p.categorySlug || '').toLowerCase();
        return (
          pCat.includes(cName) ||
          cName.includes(pCat) ||
          pCat.includes(cSlug) ||
          subItemNames.some(
            (sub) =>
              sub.includes(pCat) ||
              pCat.includes(sub) ||
              (pSlug && (sub.includes(pSlug) || pSlug.includes(sub)))
          )
        );
      });

      // If matched in hierarchy, use matched products
      if (matchedInTree.length > 0) {
        list = matchedInTree;
      }
    } else if (slug && slug !== 'all' && slug !== 'categories') {
      // If slug was not a root category, match directly against leaf categories or slugs
      const normalizedSlug = slug.toLowerCase();
      const directMatches = list.filter((p) => {
        const pCat = (p.category || '').toLowerCase();
        const pSlug = (p.categorySlug || '').toLowerCase();
        const pCatKebab = pCat.replace(/[^a-z0-9]+/g, '-');
        return (
          pCat === normalizedSlug ||
          pCatKebab === normalizedSlug ||
          pSlug === normalizedSlug ||
          pCat.includes(normalizedSlug) ||
          normalizedSlug.includes(pCatKebab)
        );
      });

      if (directMatches.length > 0) {
        list = directMatches;
      }
    }

    // Filter by Global Search query if present
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
          (p.brand?.brandName && p.brand.brandName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allProducts, currentCategory, slug, searchQuery]);

  // 100% Dynamic Price Bounds calculated strictly from matching products
  const { minCatalogPrice, maxCatalogPrice, smartPriceRanges } = useMemo(() => {
    if (baseCategoryProducts.length === 0) {
      return { minCatalogPrice: 0, maxCatalogPrice: 1000, smartPriceRanges: [] };
    }
    const prices = baseCategoryProducts.map((p) => p.price);
    const minP = Math.floor(Math.min(...prices));
    const maxP = Math.ceil(Math.max(...prices));

    // Calculate dynamic price brackets based on real catalog span
    if (maxP <= minP) {
      return { minCatalogPrice: minP, maxCatalogPrice: maxP, smartPriceRanges: [] };
    }

    const span = maxP - minP;
    const tier1 = Math.round(minP + span * 0.33);
    const tier2 = Math.round(minP + span * 0.66);

    const ranges = [
      {
        label: `Under ${currency}${tier1}`,
        min: null,
        max: tier1,
      },
      {
        label: `${currency}${tier1} - ${currency}${tier2}`,
        min: tier1,
        max: tier2,
      },
      {
        label: `Over ${currency}${tier2}`,
        min: tier2,
        max: null,
      },
    ];

    return { minCatalogPrice: minP, maxCatalogPrice: maxP, smartPriceRanges: ranges };
  }, [baseCategoryProducts, currency]);

  // 100% Dynamic Brand facet extracted from current base products
  const availableBrands = useMemo(() => {
    const brandMap = new Map<string, number>();
    baseCategoryProducts.forEach((p) => {
      const bName = p.brand?.brandName;
      if (bName) {
        brandMap.set(bName, (brandMap.get(bName) || 0) + 1);
      }
    });
    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [baseCategoryProducts]);

  // Filtered brands based on micro-search within the filter panel
  const filteredBrands = useMemo(() => {
    if (!brandSearchQuery.trim()) return availableBrands;
    const q = brandSearchQuery.toLowerCase();
    return availableBrands.filter((b) => b.name.toLowerCase().includes(q));
  }, [availableBrands, brandSearchQuery]);

  // 100% Dynamic Subcategories extracted from DB category hierarchy & products
  const availableSubcategories = useMemo(() => {
    const subs = new Set<string>();
    if (currentCategory?.subCategories) {
      currentCategory.subCategories.forEach((s) => {
        if (s.title) subs.add(s.title);
        if (s.items && s.items.length > 0) {
          s.items.forEach((item) => subs.add(item));
        }
      });
    }
    baseCategoryProducts.forEach((p) => {
      if (p.subCategory) subs.add(p.subCategory);
      if (p.category) subs.add(p.category);
    });
    return Array.from(subs);
  }, [currentCategory, baseCategoryProducts]);

  // 100% Dynamic Category-Specific Facet Mining
  const dynamicFacets = useMemo(() => {
    return extractDynamicFacets(baseCategoryProducts);
  }, [baseCategoryProducts]);

  // Read selected dynamic facets from URL query parameters (f_Key=Value1,Value2)
  const selectedFacets = useMemo<SelectedFacets>(() => {
    const facets: SelectedFacets = {};
    searchParams.forEach((val, key) => {
      if (key.startsWith('f_')) {
        const facetKey = key.replace('f_', '');
        facets[facetKey] = val.split(',').filter(Boolean);
      }
    });
    return facets;
  }, [searchParams]);

  const handleToggleFacet = (facetKey: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    const currentVals = selectedFacets[facetKey] || [];
    const isSelected = currentVals.includes(value);
    const updated = isSelected
      ? currentVals.filter((v) => v !== value)
      : [...currentVals, value];

    if (updated.length === 0) {
      next.delete(`f_${facetKey}`);
    } else {
      next.set(`f_${facetKey}`, updated.join(','));
    }
    setSearchParams(next);
  };

  const handleClearFacet = (facetKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete(`f_${facetKey}`);
    setSearchParams(next);
  };

  // Dynamic counts for quick filter chips
  const dynamicCounts = useMemo(() => {
    const inStock = baseCategoryProducts.filter((p) => p.stock > 0).length;
    const onSale = baseCategoryProducts.filter(
      (p) => p.originalPrice > p.price && p.originalPrice > 0
    ).length;
    return { inStock, onSale };
  }, [baseCategoryProducts]);

  // Apply Dynamic Filters & Sorting (Zero rating dependency)
  const filteredAndSortedProducts = useMemo(() => {
    let list = [...baseCategoryProducts];

    // Subcategory Filter
    if (selectedSub !== 'All') {
      const subLower = selectedSub.toLowerCase();
      list = list.filter((p) => {
        const pSub = (p.subCategory || '').toLowerCase();
        const pCat = (p.category || '').toLowerCase();
        const pSlug = (p.categorySlug || '').toLowerCase();
        const pTags = p.tags ? p.tags.map((t) => t.toLowerCase()) : [];
        const pName = p.name.toLowerCase();
        return (
          pSub.includes(subLower) ||
          pCat.includes(subLower) ||
          subLower.includes(pCat) ||
          (pSlug && (pSlug.includes(subLower) || subLower.includes(pSlug))) ||
          pTags.includes(subLower) ||
          pName.includes(subLower)
        );
      });
    }

    // Brand Filter
    if (selectedBrand !== 'All') {
      list = list.filter((p) => p.brand?.brandName?.toLowerCase() === selectedBrand.toLowerCase());
    }

    // Dynamic Facets (Category-Specific Attributes: Colors, Sizes, Materials, Capacities, Wattage)
    list = filterProductsByFacets(list, selectedFacets);

    // Dynamic Price Filter
    if (minPrice !== null) {
      list = list.filter((p) => p.price >= minPrice);
    }
    if (maxPrice !== null) {
      list = list.filter((p) => p.price <= maxPrice);
    }

    // In Stock Only Filter
    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }

    // On Sale Only Filter
    if (onSaleOnly) {
      list = list.filter((p) => p.originalPrice > p.price);
    }

    // Dynamic Sorting (Featured, Price asc/desc, Discount, Alphabetical)
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'discount') {
      list.sort((a, b) => {
        const discA = a.originalPrice > a.price ? (a.originalPrice - a.price) / a.originalPrice : 0;
        const discB = b.originalPrice > b.price ? (b.originalPrice - b.price) / b.originalPrice : 0;
        return discB - discA;
      });
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [
    baseCategoryProducts,
    selectedSub,
    selectedBrand,
    selectedFacets,
    minPrice,
    maxPrice,
    inStockOnly,
    onSaleOnly,
    sortBy,
  ]);

  // Helper to update URL query params
  const updateFilter = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '' || val === 'All') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    });
    setSearchParams(next);
  };

  const handleClearAllFilters = () => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('q', searchQuery);
    setSearchParams(next);
  };

  const hasActiveFacets = Object.values(selectedFacets).some((vals) => vals.length > 0);
  const hasActiveFilters =
    selectedSub !== 'All' ||
    selectedBrand !== 'All' ||
    minPrice !== null ||
    maxPrice !== null ||
    inStockOnly ||
    onSaleOnly ||
    sortBy !== 'featured' ||
    hasActiveFacets;

  // Scroll to top on slug or search query change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, searchQuery]);

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-20">
      
      {/* ── Breadcrumb Bar ────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-none">
            <Link to="/" className="hover:text-primary-700 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <Link to="/categories" className="hover:text-primary-700 transition-colors">
              Departments
            </Link>
            {currentCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-bold">{currentCategory.name}</span>
              </>
            )}
            {selectedSub !== 'All' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-emerald-700 font-bold">{selectedSub}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* ── Dynamic Category Header ───────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/80 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Catalog</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {pageTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-medium leading-relaxed">
                {currentCategory
                  ? `Showing genuine verified ${currentCategory.name.toLowerCase()} items available for instant dispatch with doorstep tracking.`
                  : 'Browse authentic products across all verified store departments with transparent pricing and live stock.'}
              </p>
            </div>

            {/* Mobile Filter Drawer Open Button */}
            <div className="flex items-center gap-3 lg:hidden self-start md:self-auto">
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm"
              >
                <Filter className="w-4 h-4 text-emerald-400" />
                <span>Filters {hasActiveFilters ? '• Active' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Catalog Workspace: Sidebar + Products ─────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Sticky 1-Click Quick Filter Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 scrollbar-none">
          {/* Quick In-Stock Filter */}
          <button
            onClick={() => updateFilter({ inStock: inStockOnly ? null : 'true' })}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-2xs ${
              inStockOnly
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>In Stock Only ({dynamicCounts.inStock})</span>
          </button>

          {/* Quick On-Sale Filter (only if on-sale items exist) */}
          {dynamicCounts.onSale > 0 && (
            <button
              onClick={() => updateFilter({ onSale: onSaleOnly ? null : 'true' })}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-2xs ${
                onSaleOnly
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200/80 text-rose-700 hover:bg-rose-50/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>On Sale ({dynamicCounts.onSale})</span>
            </button>
          )}

          {/* Top 3 Dynamic Brands Quick Pills */}
          {availableBrands.slice(0, 3).map(({ name, count }) => {
            const isSel = selectedBrand === name;
            return (
              <button
                key={name}
                onClick={() => updateFilter({ brand: isSel ? 'All' : name })}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-2xs ${
                  isSel
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{name}</span>
                <span className={`text-[10px] font-mono ${isSel ? 'text-white/70' : 'text-slate-400'}`}>
                  ({count})
                </span>
              </button>
            );
          })}

          {/* Reset All Quick Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all cursor-pointer whitespace-nowrap ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-7 items-start">
          
          {/* ── Left Sidebar (Desktop - Collapsible) ───────────────── */}
          {isSidebarOpen && (
            <aside className="w-full lg:w-64 shrink-0 hidden lg:block space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-6 sticky top-24">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Filters
                    </span>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearAllFilters}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>

                {/* Dynamic Departments Hierarchy */}
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
                    Departments
                  </h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => navigate('/categories')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                        !currentCategory
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : 'text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <span>All Departments</span>
                      <span className="text-[10px] text-slate-400 font-mono">{allProducts.length}</span>
                    </button>

                    {categories.map((c) => {
                      const isSelected = currentCategory?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => navigate(`/category/${c.slug}`)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 font-bold'
                              : 'text-slate-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Subcategories (if available) */}
                {availableSubcategories.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
                      Subcategories
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                      <button
                        onClick={() => updateFilter({ sub: 'All' })}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          selectedSub === 'All'
                            ? 'bg-emerald-50 text-emerald-800 font-bold'
                            : 'text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        All Subcategories
                      </button>
                      {availableSubcategories.map((subTitle) => {
                        const isSel = selectedSub === subTitle;
                        return (
                          <button
                            key={subTitle}
                            onClick={() => updateFilter({ sub: isSel ? 'All' : subTitle })}
                            className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                              isSel
                                ? 'bg-emerald-50 text-emerald-800 font-bold'
                                : 'text-slate-650 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{subTitle}</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 100% Dynamic Adaptive Price Filter (No hardcoded ₹500/₹1000) */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Price Range
                    </h4>
                    {(minPrice !== null || maxPrice !== null) && (
                      <button
                        onClick={() => updateFilter({ minPrice: null, maxPrice: null })}
                        className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Dynamic smart brackets calculated from actual catalog prices */}
                  {smartPriceRanges.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {smartPriceRanges.map((range, idx) => {
                        const isSelected = minPrice === range.min && maxPrice === range.max;
                        return (
                          <button
                            key={idx}
                            onClick={() =>
                              updateFilter({
                                minPrice: range.min !== null ? String(range.min) : null,
                                maxPrice: range.max !== null ? String(range.max) : null,
                              })
                            }
                            className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-800 font-bold'
                                : 'text-slate-650 hover:bg-slate-50'
                            }`}
                          >
                            <span>{range.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Custom Min / Max Direct Input Box */}
                  <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200/70">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Min (₹)</label>
                        <input
                          type="number"
                          placeholder={String(minCatalogPrice)}
                          value={minPrice ?? ''}
                          onChange={(e) =>
                            updateFilter({ minPrice: e.target.value ? e.target.value : null })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-slate-400 font-bold text-xs mt-3">-</span>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Max (₹)</label>
                        <input
                          type="number"
                          placeholder={String(maxCatalogPrice)}
                          value={maxPrice ?? ''}
                          onChange={(e) =>
                            updateFilter({ maxPrice: e.target.value ? e.target.value : null })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 100% Dynamic Brand Filter with Micro-Search */}
                {availableBrands.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Brands ({availableBrands.length})
                      </h4>
                      {selectedBrand !== 'All' && (
                        <button
                          onClick={() => updateFilter({ brand: 'All' })}
                          className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Micro-search inside brands if more than 4 brands */}
                    {availableBrands.length > 4 && (
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search brands..."
                          value={brandSearchQuery}
                          onChange={(e) => setBrandSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-8 pr-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    <div className="max-h-44 overflow-y-auto space-y-1 scrollbar-thin">
                      <button
                        onClick={() => updateFilter({ brand: 'All' })}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          selectedBrand === 'All'
                            ? 'bg-emerald-50 text-emerald-800 font-bold'
                            : 'text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        All Brands
                      </button>
                      {filteredBrands.map(({ name, count }) => {
                        const isSel = selectedBrand === name;
                        return (
                          <button
                            key={name}
                            onClick={() => updateFilter({ brand: isSel ? 'All' : name })}
                            className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                              isSel
                                ? 'bg-emerald-50 text-emerald-800 font-bold'
                                : 'text-slate-650 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 100% Dynamic Category-Specific Facets (Colors, Sizes, Specs) */}
                <DynamicFacetSection
                  facets={dynamicFacets}
                  selectedFacets={selectedFacets}
                  onToggleFacet={handleToggleFacet}
                  onClearFacet={handleClearFacet}
                />
              </div>
            </aside>
          )}

          {/* ── Right Content: Toolbar & Product Grid ──────────────── */}
          <main className="flex-1 min-w-0">
            
            {/* Modern Top Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              
              {/* Left Controls: Sidebar toggle & Sort */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                  title={isSidebarOpen ? 'Hide Filters Sidebar' : 'Show Filters Sidebar'}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isSidebarOpen ? 'Hide Filters' : 'Show Filters'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => updateFilter({ sort: e.target.value })}
                    aria-label="Sort products by"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="featured">Featured Picks</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="discount">Biggest Discount</option>
                    <option value="name_asc">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {/* Right Controls: View Density Switcher & Live Item Counter */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    onClick={() => setViewDensity('compact')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewDensity === 'compact'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Compact Grid (4 Columns)"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewDensity('spacious')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewDensity === 'spacious'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Spacious View (2 Columns)"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/70 px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                  Showing <strong className="text-slate-900">{filteredAndSortedProducts.length}</strong> of{' '}
                  <strong className="text-slate-900">{baseCategoryProducts.length}</strong>
                </span>
              </div>
            </div>

            {/* Active Filter Badges Bar */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Filters:
                </span>
                {selectedSub !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Segment: {selectedSub}
                    <button
                      onClick={() => updateFilter({ sub: 'All' })}
                      className="hover:text-emerald-950 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedBrand !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Brand: {selectedBrand}
                    <button
                      onClick={() => updateFilter({ brand: 'All' })}
                      className="hover:text-emerald-950 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(minPrice !== null || maxPrice !== null) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Price: {currency}{minPrice ?? minCatalogPrice} - {currency}{maxPrice ?? maxCatalogPrice}
                    <button
                      onClick={() => updateFilter({ minPrice: null, maxPrice: null })}
                      className="hover:text-emerald-950 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    In Stock Only
                    <button
                      onClick={() => updateFilter({ inStock: null })}
                      className="hover:text-emerald-950 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {onSaleOnly && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    On Sale Only
                    <button
                      onClick={() => updateFilter({ onSale: null })}
                      className="hover:text-rose-950 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {/* Active Dynamic Category Facets Badges */}
                {Object.entries(selectedFacets).map(([fKey, vals]) =>
                  vals.map((val) => (
                    <span
                      key={`${fKey}-${val}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-2xs"
                    >
                      <span>
                        {fKey}: {val}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleFacet(fKey, val)}
                        className="hover:text-rose-400 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}

                <button
                  onClick={handleClearAllFilters}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline ml-2 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Dynamic Product Grid or Empty State */}
            {filteredAndSortedProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 sm:p-16 text-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  No Matching Products Found
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
                  We couldn't find any products matching your specific combination of filters. Try
                  resetting filters to view available inventory.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleClearAllFilters}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs shadow-md hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                  <Link
                    to="/"
                    className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Return to Home
                  </Link>
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-4 sm:gap-6 ${
                  viewDensity === 'compact'
                    ? isSidebarOpen
                      ? 'grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                    : isSidebarOpen
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {filteredAndSortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={currency}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onToggleWishlist={onToggleWishlist}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile Filters Slide-over Drawer ───────────────────────── */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => setIsMobileFilterOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          />
          <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Filters & Refinements
                </h3>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Departments */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Departments</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      navigate('/categories');
                      setIsMobileFilterOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    All Departments ({allProducts.length})
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        navigate(`/category/${c.slug}`);
                        setIsMobileFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                        currentCategory?.id === c.id
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Subcategories */}
              {availableSubcategories.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Subcategories</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableSubcategories.map((subTitle) => (
                      <button
                        key={subTitle}
                        onClick={() => {
                          updateFilter({ sub: subTitle });
                          setIsMobileFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold ${
                          selectedSub === subTitle
                            ? 'bg-emerald-50 text-emerald-800 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        {subTitle}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mobile Price Inputs */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Price Range (₹)</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={`Min (${minCatalogPrice})`}
                    value={minPrice ?? ''}
                    onChange={(e) => updateFilter({ minPrice: e.target.value ? e.target.value : null })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder={`Max (${maxCatalogPrice})`}
                    value={maxPrice ?? ''}
                    onChange={(e) => updateFilter({ maxPrice: e.target.value ? e.target.value : null })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Facets (Mobile) */}
              <DynamicFacetSection
                facets={dynamicFacets}
                selectedFacets={selectedFacets}
                onToggleFacet={handleToggleFacet}
                onClearFacet={handleClearFacet}
              />
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  handleClearAllFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs"
              >
                Apply ({filteredAndSortedProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
