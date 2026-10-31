import React, { useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { DynamicFacet, SelectedFacets } from '../../types/facets';

interface DynamicFacetSectionProps {
  facets: DynamicFacet[];
  selectedFacets: SelectedFacets;
  onToggleFacet: (facetKey: string, value: string) => void;
  onClearFacet: (facetKey: string) => void;
}

export const DynamicFacetSection: React.FC<DynamicFacetSectionProps> = ({
  facets,
  selectedFacets,
  onToggleFacet,
  onClearFacet,
}) => {
  // Store collapsed states for each facet (default collapsed)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsedMap((prev) => {
      const current = prev[key] ?? true;
      return { ...prev, [key]: !current };
    });
  };

  if (!facets || facets.length === 0) return null;

  return (
    <div className="space-y-4">
      {facets.map((facet) => {
        const selectedValues = selectedFacets[facet.key] || [];
        const hasActive = selectedValues.length > 0;
        const isCollapsed = collapsedMap[facet.key] ?? !hasActive;

        return (
          <div key={facet.key} className="pt-4 border-t border-slate-100">
            {/* Header & Toggle */}
            <div className="flex items-center justify-between mb-2.5 group">
              <button
                type="button"
                onClick={() => toggleCollapse(facet.key)}
                className="w-full flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors truncate">
                    {facet.label}
                  </span>
                  {hasActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasActive && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearFacet(facet.key);
                      }}
                      className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Facet Body */}
            {!isCollapsed && (
              <div className="mt-1">

                {/* 2. Button Chip Facet (Sizes, Capacities, Wattage) */}
                {facet.type === 'button_chip' && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {facet.options.map((opt) => {
                      const isSelected = selectedValues.includes(opt.value);

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onToggleFacet(facet.key, opt.value)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-2xs scale-102'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{opt.value}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              isSelected ? 'text-white/70' : 'text-slate-400'
                            }`}
                          >
                            ({opt.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Checkbox Facet (Colors, Brands, Standard attributes) */}
                {(facet.type === 'checkbox' || facet.type === 'color_swatch') && (
                  <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin pt-1">
                    {facet.options.map((opt) => {
                      const isSelected = selectedValues.includes(opt.value);

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onToggleFacet(facet.key, opt.value)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 font-bold'
                              : 'text-slate-650 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <span className="truncate">{opt.value}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">
                            ({opt.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
