import { useReducer, useCallback, useEffect } from 'react';
import {
  CreateProductFormState,
  VariantEntry,
  SpecEntry,
  ResolvedAttributes,
} from '../types/product.js';

export const DRAFT_STORAGE_KEY = 'admin_create_product_draft';
export const STEP_STORAGE_KEY = 'admin_create_product_step';

export const initialProductFormState: CreateProductFormState = {
  brandId: '',
  leafCategoryId: '',
  productName: '',
  description: '',
  highlights: [],
  baseModelCode: '',
  hsnCode: '',
  gstRate: '',
  resolvedAttributes: null,
  specifications: [],
  variants: [],
  initialStatus: 'ACTIVE',
};

type Action =
  | { type: 'SET_FIELD'; field: keyof CreateProductFormState; value: any }
  | {
      type: 'SET_RESOLVED_ATTRIBUTES';
      payload: ResolvedAttributes;
      initialSpecs: SpecEntry[];
    }
  | { type: 'UPDATE_SPEC'; attributeId: string; partial: Partial<SpecEntry> }
  | { type: 'SET_VARIANTS'; variants: VariantEntry[] }
  | { type: 'ADD_VARIANT'; variant: VariantEntry }
  | { type: 'UPDATE_VARIANT'; id: string; partial: Partial<VariantEntry> }
  | { type: 'REMOVE_VARIANT'; id: string }
  | { type: 'DUPLICATE_VARIANT'; id: string }
  | { type: 'LOAD_DRAFT'; payload: CreateProductFormState }
  | { type: 'RESET' };

function productFormReducer(
  state: CreateProductFormState,
  action: Action
): CreateProductFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'SET_RESOLVED_ATTRIBUTES':
      return {
        ...state,
        resolvedAttributes: action.payload,
        specifications: action.initialSpecs,
        // When category changes, reset variants if they depend on different variantDefining attributes
        variants: [],
      };

    case 'UPDATE_SPEC':
      return {
        ...state,
        specifications: state.specifications.map((s) =>
          s.attributeId === action.attributeId ? { ...s, ...action.partial } : s
        ),
      };

    case 'SET_VARIANTS':
      return {
        ...state,
        variants: action.variants,
      };

    case 'ADD_VARIANT':
      return {
        ...state,
        variants: [...state.variants, action.variant],
      };

    case 'UPDATE_VARIANT':
      return {
        ...state,
        variants: state.variants.map((v) =>
          v._id === action.id ? { ...v, ...action.partial } : v
        ),
      };

    case 'REMOVE_VARIANT':
      return {
        ...state,
        variants: state.variants.filter((v) => v._id !== action.id),
      };

    case 'DUPLICATE_VARIANT': {
      const source = state.variants.find((v) => v._id === action.id);
      if (!source) return state;

      const duplicated: VariantEntry = {
        ...source,
        _id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        gtin: '',
        variantModelCode: source.variantModelCode ? `${source.variantModelCode}-COPY` : '',
        assets: [],
        _label: `${source._label} (Copy)`,
        _completeness: 'incomplete',
      };

      return {
        ...state,
        variants: [...state.variants, duplicated],
      };
    }

    case 'LOAD_DRAFT':
      return {
        ...initialProductFormState,
        ...action.payload,
      };

    case 'RESET':
      return initialProductFormState;

    default:
      return state;
  }
}

export function useProductForm() {
  const [state, dispatch] = useReducer(productFormReducer, initialProductFormState);

  // Auto-sync form state to sessionStorage whenever meaningful data exists
  useEffect(() => {
    try {
      const hasMeaningfulData = Boolean(
        state.brandId ||
        state.leafCategoryId ||
        state.productName?.trim() ||
        state.variants.length > 0 ||
        state.specifications.some((s) => s.attributeValue?.trim() || s.attributeValueId)
      );

      if (hasMeaningfulData) {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      }
    } catch (err) {
      console.error('Failed to sync product draft to sessionStorage:', err);
    }
  }, [state]);

  const loadSavedDraft = useCallback((): boolean => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          dispatch({ type: 'LOAD_DRAFT', payload: parsed });
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to load product draft from sessionStorage:', err);
    }
    return false;
  }, []);

  const hasSavedDraft = useCallback((): boolean => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Boolean(
          parsed?.brandId ||
          parsed?.leafCategoryId ||
          parsed?.productName?.trim() ||
          parsed?.variants?.length > 0 ||
          (parsed?.specifications && parsed.specifications.some((s: any) => s.attributeValue?.trim() || s.attributeValueId))
        );
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  const setField = useCallback(
    <K extends keyof CreateProductFormState>(field: K, value: CreateProductFormState[K]) => {
      dispatch({ type: 'SET_FIELD', field, value });
    },
    []
  );

  const setResolvedAttributes = useCallback(
    (payload: ResolvedAttributes, initialSpecs: SpecEntry[]) => {
      dispatch({ type: 'SET_RESOLVED_ATTRIBUTES', payload, initialSpecs });
    },
    []
  );

  const updateSpec = useCallback((attributeId: string, partial: Partial<SpecEntry>) => {
    dispatch({ type: 'UPDATE_SPEC', attributeId, partial });
  }, []);

  const setVariants = useCallback((variants: VariantEntry[]) => {
    dispatch({ type: 'SET_VARIANTS', variants });
  }, []);

  const addVariant = useCallback((variant: VariantEntry) => {
    dispatch({ type: 'ADD_VARIANT', variant });
  }, []);

  const updateVariant = useCallback((id: string, partial: Partial<VariantEntry>) => {
    dispatch({ type: 'UPDATE_VARIANT', id, partial });
  }, []);

  const removeVariant = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_VARIANT', id });
  }, []);

  const duplicateVariant = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_VARIANT', id });
  }, []);

  const clearProductDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(STEP_STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: 'RESET' });
  }, []);

  const resetForm = useCallback(() => {
    clearProductDraft();
  }, [clearProductDraft]);

  return {
    state,
    dispatch,
    setField,
    setResolvedAttributes,
    updateSpec,
    setVariants,
    addVariant,
    updateVariant,
    removeVariant,
    duplicateVariant,
    resetForm,
    clearProductDraft,
    loadSavedDraft,
    hasSavedDraft,
  };
}
