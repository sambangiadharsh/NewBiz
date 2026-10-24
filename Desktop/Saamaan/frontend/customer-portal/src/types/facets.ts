export type FacetDisplayType = 'color_swatch' | 'button_chip' | 'checkbox';

export interface FacetOption {
  value: string;
  count: number;
  hex?: string;
}

export interface DynamicFacet {
  key: string;
  label: string;
  type: FacetDisplayType;
  options: FacetOption[];
}

export type SelectedFacets = Record<string, string[]>;
