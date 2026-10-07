const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('saamaan_customer_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'customer',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export interface WishlistApiItem {
  wishlistItemId: string;
  wishlistId: string;
  productVariantId: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    parentSku: string;
    brandName: string | null;
    thumbnail: string;
    price: number;
    originalPrice: number;
    inStock: boolean;
    variantSku: string;
    sellerProductId?: string | null;
  };
}

export const wishlistApi = {
  async getWishlist(): Promise<WishlistApiItem[]> {
    const res = await fetch(`${API_BASE}/customer/wishlist`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 401) return [];
      throw new Error('Failed to fetch wishlist');
    }
    const json = await res.json();
    return json.data || [];
  },

  async addItem(productIdOrVariantId: string): Promise<WishlistApiItem[]> {
    const res = await fetch(`${API_BASE}/customer/wishlist/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ productId: productIdOrVariantId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to add item to wishlist');
    }
    return json.data || [];
  },

  async removeItem(id: string): Promise<WishlistApiItem[]> {
    const res = await fetch(`${API_BASE}/customer/wishlist/items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to remove item from wishlist');
    }
    return json.data || [];
  },
};
