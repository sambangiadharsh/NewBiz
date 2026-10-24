import React from 'react';
import { Category } from '../../types';

interface MegaMenuDropdownProps {
  category: Category;
  onSelectSubcategory: (catName: string, subName: string) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const MegaMenuDropdown: React.FC<MegaMenuDropdownProps> = ({
  category,
  onSelectSubcategory,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave || onClose}
      className="absolute top-full left-0 right-0 w-full bg-[#FAF9F6] border-b border-stone-200/80 shadow-2xl py-8 z-50 animate-slide-down select-none"
    >
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Full width single-row grid: all columns displayed in 1 row */}
        <div className="grid grid-flow-col auto-cols-fr gap-4 xl:gap-6 items-start">
          {category.subCategories.map((group, idx) => (
            <div key={idx} className="space-y-3 min-w-0">
              
              {/* Subcategory Header */}
              <div className="border-b border-slate-100 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSubcategory(category.name, group.title);
                    onClose();
                  }}
                  className="text-xs lg:text-sm font-bold text-slate-900 hover:text-primary-600 tracking-tight text-left block w-full truncate transition-colors cursor-pointer"
                  title={group.title}
                >
                  {group.title}
                </button>
              </div>

              {/* Leaf Category Items */}
              <ul className="space-y-2">
                {group.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSubcategory(category.name, item);
                        onClose();
                      }}
                      className="text-xs text-slate-600 hover:text-primary-600 hover:translate-x-1 transition-all duration-150 flex items-center group text-left w-full cursor-pointer py-0.5 min-w-0"
                      title={item}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-primary-500 mr-2 transition-colors flex-shrink-0" />
                      <span className="truncate">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
