import { Product } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatProduct(p: any): Product {
  if (!p) return p;
  return {
    ...p,
    thumbnail: getImageUrl(p.thumbnail),
    images: Array.isArray(p.images) ? p.images.map(getImageUrl) : [],
    variants: Array.isArray(p.variants) ? p.variants.map((v: any) => ({
      ...v,
      assets: Array.isArray(v.assets) ? v.assets.map(getImageUrl) : []
    })) : undefined
  };
}

export const productsApi = {
  /**
   * Fetches active catalog products from the database.
   */
  async getActiveProducts(params?: {
    category?: string;
    q?: string;
    brandId?: string;
    limit?: number;
  }): Promise<Product[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.category && params.category !== 'All') {
        searchParams.set('category', params.category);
      }
      if (params?.q) {
        searchParams.set('q', params.q);
      }
      if (params?.brandId) {
        searchParams.set('brandId', params.brandId);
      }
      if (params?.limit) {
        searchParams.set('limit', String(params.limit));
      }

      const qs = searchParams.toString();
      const url = `${API_BASE}/products${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const rawProducts = json.data || [];
      return rawProducts.map(formatProduct) as Product[];
    } catch (err) {
      console.warn('Failed to load active products from backend API:', err);
      return [];
    }
  },

  /**
   * Fetches detailed product specifications and variant matrix by product ID.
   */
  async getProductById(id: string): Promise<Product | null> {
    try {
      const res = await fetch(`${API_BASE}/products/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ? formatProduct(json.data) : null;
    } catch (err) {
      console.warn(`Failed to fetch product detail for ID ${id}:`, err);
      return null;
    }
  },
};
