import { Product } from '../types';
import { DynamicFacet, FacetDisplayType, FacetOption, SelectedFacets } from '../types/facets';

// Common color fallback hex map
const COLOR_HEX_MAP: Record<string, string> = {
  white: '#FFFFFF',
  black: '#1E293B',
  gray: '#94A3B8',
  grey: '#94A3B8',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#F59E0B',
  amber: '#D97706',
  orange: '#F97316',
  purple: '#8B5CF6',
  pink: '#EC4899',
  rose: '#F43F5E',
  brown: '#78350F',
  silver: '#E2E8F0',
  gold: '#FBBF24',
  navy: '#0F172A',
  teal: '#14B8A6',
  beige: '#F5F5DC',
  charcoal: '#334155',
};

function resolveColorHex(colorName: string): string {
  const normalized = colorName.toLowerCase().trim();
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (normalized.includes(key)) return hex;
  }
  return '#64748B';
}

function resolveDisplayType(key: string): FacetDisplayType {
  const lower = key.toLowerCase();
  if (lower.includes('color') || lower.includes('colour')) {
    return 'color_swatch';
  }
  if (
    lower.includes('size') ||
    lower.includes('capacity') ||
    lower.includes('wattage') ||
    lower.includes('storage') ||
    lower.includes('ram') ||
    lower.includes('dimension')
  ) {
    return 'button_chip';
  }
  return 'checkbox';
}

/**
 * Mines dynamic, category-specific facets from a list of products.
 * Zero hardcoded facets: facets only exist if the products in the current view contain them.
 */
export function extractDynamicFacets(products: Product[]): DynamicFacet[] {
  if (!products || products.length === 0) return [];

  // Map of FacetKey -> Map of OptionValue -> count
  const facetMap = new Map<string, Map<string, { count: number; hex?: string }>>();

  const addOption = (facetKey: string, optionValue: string, hex?: string) => {
    const trimmedVal = optionValue.trim();
    if (!trimmedVal) return;

    if (!facetMap.has(facetKey)) {
      facetMap.set(facetKey, new Map());
    }
    const valMap = facetMap.get(facetKey)!;
    const existing = valMap.get(trimmedVal);
    if (existing) {
      existing.count += 1;
      if (hex && !existing.hex) existing.hex = hex;
    } else {
      valMap.set(trimmedVal, { count: 1, hex });
    }
  };

  products.forEach((product) => {
    // 1. Extract Colors
    if (product.colors && product.colors.length > 0) {
      product.colors.forEach((c) => {
        addOption('Color', c.name, c.hex || resolveColorHex(c.name));
      });
    }

    // 2. Extract Sizes
    if (product.sizes && product.sizes.length > 0) {
      product.sizes.forEach((s) => {
        addOption('Size', s);
      });
    }

    // 3. Extract Specifications (Material, Capacity, Wattage, Type, etc.)
    if (product.specifications && product.specifications.length > 0) {
      product.specifications.forEach(({ key, value }) => {
        if (!key || !value) return;
        const normalizedKey = key.trim();
        // Ignore overly long descriptive specs
        if (normalizedKey.length > 30 || value.length > 40) return;
        addOption(normalizedKey, value.trim());
      });
    }

    // 4. Extract Variant Attributes
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((v) => {
        if (v.attributes && Array.isArray(v.attributes)) {
          v.attributes.forEach((attr) => {
            if (attr.name && attr.value) {
              addOption(attr.name.trim(), attr.value.trim());
            }
          });
        }
      });
    }
  });

  // Convert facetMap to structured DynamicFacet[]
  const facets: DynamicFacet[] = [];

  facetMap.forEach((valMap, facetKey) => {
    // Only display facets that have at least 1 option
    if (valMap.size === 0) return;

    // Do not show high-entropy facets (e.g. if every single product has a completely distinct unique value)
    if (products.length > 4 && valMap.size === products.length && !['Color', 'Size'].includes(facetKey)) {
      return;
    }

    const type = resolveDisplayType(facetKey);
    const options: FacetOption[] = Array.from(valMap.entries()).map(([value, meta]) => ({
      value,
      count: meta.count,
      hex: meta.hex || (type === 'color_swatch' ? resolveColorHex(value) : undefined),
    }));

    // Sort options: highest count first
    options.sort((a, b) => b.count - a.count);

    facets.push({
      key: facetKey,
      label: facetKey,
      type,
      options,
    });
  });

  // Sort facets: 'Color' and 'Size' first, then alphabetical
  facets.sort((a, b) => {
    if (a.key === 'Color') return -1;
    if (b.key === 'Color') return 1;
    if (a.key === 'Size') return -1;
    if (b.key === 'Size') return 1;
    return a.label.localeCompare(b.label);
  });

  return facets;
}

/**
 * Filter products against selected dynamic facets using standard Lucene/Elasticsearch
 * faceted calculus: OR within a facet, AND across facets.
 */
export function filterProductsByFacets(
  products: Product[],
  selectedFacets: SelectedFacets
): Product[] {
  const activeKeys = Object.keys(selectedFacets).filter(
    (key) => selectedFacets[key] && selectedFacets[key].length > 0
  );

  if (activeKeys.length === 0) return products;

  return products.filter((product) => {
    // Product must satisfy EVERY active facet (AND)
    return activeKeys.every((facetKey) => {
      const selectedValues = selectedFacets[facetKey].map((v) => v.toLowerCase().trim());
      if (selectedValues.length === 0) return true;

      // Extract all values for this product under this facet key
      const productValues: string[] = [];

      if (facetKey.toLowerCase().includes('color')) {
        if (product.colors) {
          product.colors.forEach((c) => productValues.push(c.name.toLowerCase().trim()));
        }
      }

      if (facetKey.toLowerCase().includes('size')) {
        if (product.sizes) {
          product.sizes.forEach((s) => productValues.push(s.toLowerCase().trim()));
        }
      }

      if (product.specifications) {
        product.specifications.forEach((spec) => {
          if (spec.key.toLowerCase().trim() === facetKey.toLowerCase().trim()) {
            productValues.push(spec.value.toLowerCase().trim());
          }
        });
      }

      if (product.variants) {
        product.variants.forEach((v) => {
          if (v.attributes) {
            v.attributes.forEach((attr) => {
              if (attr.name.toLowerCase().trim() === facetKey.toLowerCase().trim()) {
                productValues.push(attr.value.toLowerCase().trim());
              }
            });
          }
        });
      }

      // Check if product has AT LEAST ONE of the selected values for this facet (OR)
      return productValues.some((pv) =>
        selectedValues.some((sv) => pv === sv || pv.includes(sv) || sv.includes(pv))
      );
    });
  });
}
