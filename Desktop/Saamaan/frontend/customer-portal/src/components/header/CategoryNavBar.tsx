import React, { useState, useEffect, useRef } from 'react';
import { Category } from '../../types';
import { MegaMenuDropdown } from './MegaMenuDropdown';
import { categoriesApi } from '../../lib/categoriesApi';
import {
  Menu,
  Flame,
  Award,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';

interface CategoryNavBarProps {
  categories?: Category[];
  selectedCategory: string;
  onSelectCategory: (catName: string) => void;
  onSelectSubcategory: (catName: string, subName: string) => void;
}

export const CategoryNavBar: React.FC<CategoryNavBarProps> = ({
  categories: propCategories,
  selectedCategory,
  onSelectCategory,
  onSelectSubcategory,
}) => {
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);
  const [activeHoverCategory, setActiveHoverCategory] = useState<Category | null>(null);
  const [isAllCategoriesOpen, setIsAllCategoriesOpen] = useState(false);

  const navContainerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCategoryMouseEnter = (cat: Category) => {
    clearCloseTimer();
    setActiveHoverCategory(cat);
  };

  const handleCategoryMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActiveHoverCategory(null);
    }, 180);
  };

  const handleDropdownMouseEnter = () => {
    clearCloseTimer();
  };

  const handleDropdownMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActiveHoverCategory(null);
    }, 180);
  };

  // Close megamenu when user clicks outside the navigation container
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        clearCloseTimer();
        setActiveHoverCategory(null);
        setIsAllCategoriesOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleDocumentClick);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
      clearCloseTimer();
    };
  }, []);

  // If propCategories not supplied, load dynamic categories directly
  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setInternalCategories(propCategories);
      return;
    }

    let isMounted = true;
    async function loadDynamic() {
      try {
        const tree = await categoriesApi.getCategoryTree();
        if (isMounted && tree.length > 0) {
          setInternalCategories(tree);
        }
      } catch (err) {
        console.warn('Failed to fetch navbar dynamic categories:', err);
      }
    }
    loadDynamic();
    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

  return (
    <div
      ref={navContainerRef}
      className="relative bg-[#FAF9F6] border-b border-stone-200/70 z-20 select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          
          {/* Left: "All Categories" button with dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsAllCategoriesOpen(!isAllCategoriesOpen)}
              className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-[#3F5B45] text-white text-xs font-semibold hover:bg-[#334A38] transition-colors shadow-sm"
              aria-label="Toggle All Categories menu"
              aria-expanded={isAllCategoriesOpen}
            >
              <Menu className="w-4 h-4 text-white/95" />
              <span>All Categories</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 text-white/80 ${isAllCategoriesOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Quick dropdown for All Categories */}
            {isAllCategoriesOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsAllCategoriesOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 z-40 animate-slide-down">
                  <div className="px-4 pb-2 mb-2 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Browse Departments
                    </span>
                  </div>

                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onSelectCategory(cat.name);
                        setIsAllCategoriesOpen(false);
                      }}
                      className="w-full flex items-center px-4 py-2.5 text-xs text-slate-750 hover:bg-primary-50/60 hover:text-primary-600 transition-colors group cursor-pointer"
                    >
                      <span className="font-semibold text-slate-900 group-hover:text-primary-600 group-hover:translate-x-1 transition-transform">
                        {cat.name}
                      </span>
                    </button>
                  ))}

                  <div className="mt-2 pt-2 border-t border-slate-100 px-4">
                    <button
                      onClick={() => {
                        onSelectCategory('All');
                        setIsAllCategoriesOpen(false);
                      }}
                      className="w-full text-center text-xs font-semibold text-primary-600 hover:text-primary-700 py-1 cursor-pointer"
                    >
                      View Complete Catalog
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Center: Main Navigation Categories with Mega Menu Hover */}
          <nav
            className="hidden lg:flex items-center space-x-1"
            onMouseLeave={handleCategoryMouseLeave}
          >
            <button
              onClick={() => onSelectCategory('All')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedCategory === 'All'
                  ? 'text-primary-600 bg-primary-50/70'
                  : 'text-slate-650 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Catalog
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              const isHovered = activeHoverCategory?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  className="relative group py-2"
                  onMouseEnter={() => handleCategoryMouseEnter(cat)}
                  onMouseLeave={handleCategoryMouseLeave}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearCloseTimer();
                      // Toggle megamenu without redirecting to any page
                      setActiveHoverCategory((prev) => (prev?.id === cat.id ? null : cat));
                    }}
                    className={`relative flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
                      isSelected || isHovered
                        ? 'text-primary-600 bg-primary-50/80 font-bold shadow-xs'
                        : 'text-slate-700 hover:text-primary-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="tracking-tight">{cat.name}</span>

                    {/* Sleek Animated Gradient Anchor Line */}
                    <span
                      className={`absolute -bottom-2 left-2 right-2 h-[2.5px] rounded-full transition-all duration-300 pointer-events-none ${
                        isSelected || isHovered
                          ? 'bg-gradient-to-r from-primary-700 to-primary-600 opacity-100 scale-x-100 shadow-xs'
                          : 'bg-primary-500 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Right: Quick Highlights (Flash Deals, Best Sellers, Official Warranty - Kept Static) */}
          <div className="hidden sm:flex items-center space-x-3 text-xs">
            <button
              onClick={() => onSelectCategory('Deals')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-rose-600 font-bold hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
              <span>Flash Deals</span>
            </button>

            <button
              onClick={() => onSelectCategory('Trending')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-amber-700 font-medium hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Best Sellers</span>
            </button>

            <div className="hidden xl:flex items-center space-x-1.5 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official Warranty</span>
            </div>
          </div>

        </div>
      </div>

      {/* Mega Menu Dropdown when hovering/clicking on a root category */}
      {activeHoverCategory && (
        <MegaMenuDropdown
          category={activeHoverCategory}
          onSelectSubcategory={(catName, subName) => {
            clearCloseTimer();
            setActiveHoverCategory(null);
            onSelectSubcategory(catName, subName);
          }}
          onMouseEnter={handleDropdownMouseEnter}
          onMouseLeave={handleDropdownMouseLeave}
          onClose={() => {
            clearCloseTimer();
            setActiveHoverCategory(null);
          }}
        />
      )}
    </div>
  );
};
