const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/v1';
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export interface StorefrontBanner {
  bannerId: string;
  title?: string | null;
  description?: string | null;
  imageUrl: string;
  imageURL?: string;
  placement: string;
  displayOrder: number;
}

export const bannersApi = {
  async getBannersByPlacement(placement: string = 'HERO_CAROUSEL'): Promise<StorefrontBanner[]> {
    try {
      const res = await fetch(`${API_BASE}/banners?placement=${encodeURIComponent(placement)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as StorefrontBanner[];
    } catch (err) {
      console.warn('Failed to load storefront banners:', err);
      return [];
    }
  },
};

export const getFullBannerImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};
