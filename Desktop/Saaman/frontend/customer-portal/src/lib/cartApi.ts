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

export interface ApiCartItem {
  cartItemId: string;
  cartId: string;
  sellerProductId: string;
  productVariantId: string;
  productId: string;
  quantity: number;
  productName: string;
  parentSku: string;
  variantSku: string;
  brandName: string | null;
  thumbnail: string;
  price: number;
  originalPrice: number;
  lineTotal: number;
  availableStock: number;
  inStock: boolean;
}

export interface ApiCartSummary {
  cartId: string;
  itemCount: number;
  subtotal: number;
  items: ApiCartItem[];
}

export const cartApi = {
  async getCart(): Promise<ApiCartSummary | null> {
    const res = await fetch(`${API_BASE}/customer/cart`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 401) return null;
      throw new Error('Failed to fetch cart');
    }
    const json = await res.json();
    return json.data || null;
  },

  async addItem(params: {
    productId?: string;
    productVariantId?: string;
    sellerProductId?: string;
    quantity?: number;
  }): Promise<ApiCartSummary> {
    const res = await fetch(`${API_BASE}/customer/cart/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to add item to cart');
    }
    return json.data;
  },

  async updateQuantity(cartItemId: string, quantity: number): Promise<ApiCartSummary> {
    const res = await fetch(`${API_BASE}/customer/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ quantity }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to update item quantity');
    }
    return json.data;
  },

  async removeItem(cartItemId: string): Promise<ApiCartSummary> {
    const res = await fetch(`${API_BASE}/customer/cart/items/${cartItemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to remove item from cart');
    }
    return json.data;
  },

  async clearCart(): Promise<ApiCartSummary> {
    const res = await fetch(`${API_BASE}/customer/cart/clear`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to clear cart');
    }
    return json.data;
  },

  async mergeCart(
    items: Array<{
      productId?: string;
      productVariantId?: string;
      sellerProductId?: string;
      quantity: number;
    }>
  ): Promise<ApiCartSummary> {
    const res = await fetch(`${API_BASE}/customer/cart/merge`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ items }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to merge cart');
    }
    return json.data;
  },
};
