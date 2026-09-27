const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/v1';
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export interface StorefrontBrand {
  brandId: string;
  brandName: string;
  brandCode: string;
  manufacturer?: string | null;
  description?: string | null;
  status: string;
  imageUrl?: string | null;
  imageURL?: string | null;
  isFeatured: boolean;
  displayOrder: number;
  productsCount: number;
}

export const brandsApi = {
  /**
   * Fetch featured active brands for the storefront
   */
  async getFeaturedBrands(): Promise<StorefrontBrand[]> {
    try {
      const res = await fetch(`${API_BASE}/brands?isFeatured=true&status=ACTIVE`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as StorefrontBrand[];
    } catch (err) {
      console.warn('Failed to load featured storefront brands:', err);
      return [];
    }
  },

  /**
   * Fetch all active brands for the storefront
   */
  async getAllActiveBrands(): Promise<StorefrontBrand[]> {
    try {
      const res = await fetch(`${API_BASE}/brands?status=ACTIVE`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as StorefrontBrand[];
    } catch (err) {
      console.warn('Failed to load storefront brands:', err);
      return [];
    }
  },
};

export const getFullBrandImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};
