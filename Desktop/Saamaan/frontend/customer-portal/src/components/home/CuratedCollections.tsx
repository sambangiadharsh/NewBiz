import React from 'react';
import { ArrowRight } from 'lucide-react';

interface CuratedCollectionsProps {
  onSelectCategory: (catName: string) => void;
}

export const CuratedCollections: React.FC<CuratedCollectionsProps> = ({ onSelectCategory }) => {
  return (
    <section className="py-12 bg-[#FAF9F6] border-b border-stone-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1 */}
          <div
            onClick={() => onSelectCategory('Electronics')}
            className="group relative rounded-3xl overflow-hidden min-h-[300px] flex flex-col justify-end p-8 cursor-pointer shadow-card hover:shadow-card-hover transition-all duration-300"
          >
            <img
              src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80"
              alt="Acoustic & Tech Workspace"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
            
            <div className="relative z-10 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary-400">
                Desk & Audio Gear
              </span>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">
                Architectural Workspaces
              </h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Precision aluminum keyboards, high-fidelity wireless headsets, and ergonomic essentials.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-xs font-bold text-white group-hover:text-primary-300 transition-colors">
                <span>Shop Desk Setup</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => onSelectCategory('Fashion & Apparel')}
            className="group relative rounded-3xl overflow-hidden min-h-[300px] flex flex-col justify-end p-8 cursor-pointer shadow-card hover:shadow-card-hover transition-all duration-300"
          >
            <img
              src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop&q=80"
              alt="Linen and Minimalist Apparel"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/50 to-transparent" />
            
            <div className="relative z-10 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                Linen & Leather
              </span>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">
                Modern Organic Wardrobe
              </h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Breathe easy with washed French linen overshirts and handcrafted Tuscan leather bags.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                <span>Explore Apparel</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
