import { Category } from '../../types';
import {
  ArrowRight,
  Sparkles,
  Home,
  Coffee,
  Compass,
  Laptop,
  Shirt,
  Smartphone,
  Watch,
  Headphones,
  Camera,
  Tv,
  Utensils,
  Dumbbell,
  Heart,
  Baby,
  BookOpen,
  Package,
  ShoppingBag,
  Car,
  Flame,
  Gift,
  Layers,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  home: Home,
  coffee: Coffee,
  compass: Compass,
  laptop: Laptop,
  shirt: Shirt,
  smartphone: Smartphone,
  watch: Watch,
  headphones: Headphones,
  camera: Camera,
  tv: Tv,
  utensils: Utensils,
  dumbbell: Dumbbell,
  heart: Heart,
  baby: Baby,
  bookopen: BookOpen,
  package: Package,
  shoppingbag: ShoppingBag,
  car: Car,
  flame: Flame,
  gift: Gift,
  layers: Layers,
};

const RenderCategoryIcon: React.FC<{ iconName?: string; className?: string }> = ({
  iconName,
  className = 'w-3.5 h-3.5',
}) => {
  if (!iconName) return <Layers className={className} />;
  if (iconName.startsWith('http://') || iconName.startsWith('https://') || iconName.startsWith('/')) {
    const baseUrl = 'http://localhost:7000';
    const fullUrl = iconName.startsWith('/') ? `${baseUrl}${iconName}` : iconName;
    return <img src={fullUrl} alt="Category Icon" className={`${className} object-contain`} />;
  }
  const Comp = ICON_MAP[iconName.toLowerCase()] || Layers;
  return <Comp className={className} />;
};

interface CategoryPillsProps {
  categories?: Category[];
  selectedCategory: string;
  onSelectCategory: (catName: string) => void;
  isLoading?: boolean;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories: propCategories,
  selectedCategory,
  onSelectCategory,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <section className="py-12 bg-[#FAF9F6] border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div className="h-8 w-48 rounded-lg animate-shimmer" />
            <div className="h-4 w-28 rounded-md animate-shimmer" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 border border-stone-200/80 bg-white flex flex-col overflow-hidden"
              >
                <div className="w-full aspect-[4/3] rounded-xl sm:rounded-2xl animate-shimmer" />
                <div className="px-1.5 pt-3 pb-1 flex items-center justify-between">
                  <div className="h-4 w-24 rounded-md animate-shimmer" />
                  <div className="w-7 h-7 rounded-xl animate-shimmer shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const categories = propCategories && propCategories.length > 0 ? propCategories : [];
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-[#FAF9F6] border-b border-stone-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
           
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Shop by Category
            </h2>
          </div>
          <button
            onClick={() => onSelectCategory('All')}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center space-x-1 group cursor-pointer"
          >
            <span>View All Catalog</span>
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
                className={`group relative rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 cursor-pointer border transition-all duration-300 flex flex-col overflow-hidden ${
                  isSelected
                    ? 'border-primary-600 ring-2 ring-primary-500/20 bg-primary-50/40 shadow-card'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-card-hover hover:-translate-y-1'
                }`}
              >
                {/* Enlarged Full-Width Category Image with Minimal Padding */}
                <div className="w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 relative shadow-xs">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  {cat.icon && (
                    <div
                      className="absolute top-2.5 left-2.5 w-8 h-8 rounded-xl bg-white/90 backdrop-blur-md flex items-center justify-center text-primary-600 shadow-xs"
                      title={cat.name}
                    >
                      <RenderCategoryIcon iconName={cat.icon} className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Category Title & Sleek Action Arrow */}
                <div className="px-1.5 pt-3 pb-1 flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors tracking-tight truncate">
                    {cat.name}
                  </h3>
                  <div className="w-7 h-7 rounded-xl bg-slate-50 group-hover:bg-primary-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-all duration-200 shrink-0 ml-2 shadow-2xs">
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
