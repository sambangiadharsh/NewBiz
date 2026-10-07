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
  // Store collapsed states for each facet (default open for first 3)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!facets || facets.length === 0) return null;

  return (
    <div className="space-y-4">
      {facets.map((facet) => {
        const selectedValues = selectedFacets[facet.key] || [];
        const hasActive = selectedValues.length > 0;
        const isCollapsed = collapsedMap[facet.key] ?? false;

        return (
          <div key={facet.key} className="pt-4 border-t border-slate-100">
            {/* Header & Toggle */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                type="button"
                onClick={() => toggleCollapse(facet.key)}
                className="flex items-center gap-1.5 text-left group cursor-pointer"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                  {facet.label}
                </span>
                {hasActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {hasActive && (
                <button
                  type="button"
                  onClick={() => onClearFacet(facet.key)}
                  className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Facet Body */}
            {!isCollapsed && (
              <div className="mt-1">
                {/* 1. Color Swatch Facet */}
                {facet.type === 'color_swatch' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {facet.options.map((opt) => {
                      const isSelected = selectedValues.includes(opt.value);
                      const isLight = opt.hex?.toLowerCase() === '#ffffff' || opt.value.toLowerCase() === 'white';

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onToggleFacet(facet.key, opt.value)}
                          className={`relative group/color p-0.5 rounded-full transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-emerald-600 ring-offset-2 scale-110 shadow-xs'
                              : 'hover:scale-105'
                          }`}
                          title={`${opt.value} (${opt.count})`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full block border transition-transform ${
                              isLight ? 'border-slate-300' : 'border-black/10'
                            }`}
                            style={{ backgroundColor: opt.hex || '#64748B' }}
                          >
                            {isSelected && (
                              <Check
                                className={`w-3.5 h-3.5 mx-auto my-1 ${
                                  isLight ? 'text-slate-900' : 'text-white'
                                }`}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

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

                {/* 3. Checkbox Facet (Standard attributes) */}
                {facet.type === 'checkbox' && (
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
