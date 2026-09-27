import React from 'react';
import { CATEGORIES as FALLBACK_CATEGORIES } from '../../data/mockData';
import { Category } from '../../types';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CategoryPillsProps {
  categories?: Category[];
  selectedCategory: string;
  onSelectCategory: (catName: string) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories: propCategories,
  selectedCategory,
  onSelectCategory,
}) => {
  const categories = propCategories && propCategories.length > 0 ? propCategories : FALLBACK_CATEGORIES;
  const totalItemCount = categories.reduce((sum, c) => sum + (c.itemCount || 0), 0);

  return (
    <section className="py-12 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center space-x-1.5 text-primary-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Departments</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Curated Collections
            </h2>
          </div>
          <button
            onClick={() => onSelectCategory('All')}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center space-x-1 group cursor-pointer"
          >
            <span>View All ({totalItemCount} Items)</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategory(cat.name)}
                className={`group relative rounded-3xl p-5 cursor-pointer border transition-all duration-300 flex flex-col items-center text-center overflow-hidden ${
                  isSelected
                    ? 'border-primary-600 ring-2 ring-primary-500/20 bg-primary-50/40 shadow-card'
                    : 'border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-card-hover'
                }`}
              >
                {/* Category Thumbnail */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden mb-3.5 shadow-sm group-hover:scale-105 transition-transform duration-300 bg-slate-100">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  {cat.name}
                </h3>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {cat.subCategories?.length || 0} Categories • {cat.itemCount || 0}+ Items
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
