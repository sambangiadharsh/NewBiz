const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface PlaceOrderItemPayload {
  productId: string;
  sellerProductId?: string;
  quantity: number;
  price?: number;
  originalPrice?: number;
}

export interface PlaceOrderPayload {
  shippingAddressId?: string;
  rawAddress?: {
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    addressLabel?: string;
    gstin?: string;
  };
  paymentModeCode: string;
  couponCode?: string;
  items: PlaceOrderItemPayload[];
}

export interface PlaceOrderResponse {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
}

export interface CustomerOrderItem {
  orderItemId: string;
  productId: string;
  productName: string;
  sellerSku?: string | null;
  variantModelCode?: string | null;
  attributes?: Record<string, any> | null;
  quantity: number;
  unitPrice: number;
  mrp: number;
  totalAmount: number;
  thumbnail: string | null;
}

export interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  deliveredAt?: string | null;
  estimatedDeliveryDate?: string | null;
  shipment?: {
    carrier: string;
    trackingNumber: string;
    status?: string;
  } | null;
  payment: {
    modeName: string;
    modeCode: string;
    status: string;
    amount: number;
  };
  shippingAddress: {
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    addressLabel?: string;
  };
  items: CustomerOrderItem[];
}

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

export const ordersApi = {
  /**
   * Submits a customer order to the backend API.
   */
  async placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
    const res = await fetch(`${API_BASE}/customer/orders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to place order. Please try again.');
    }
    return json.data;
  },

  /**
   * Retrieves order history for the logged-in customer.
   */
  async getMyOrders(): Promise<CustomerOrder[]> {
    const token = localStorage.getItem('saamaan_customer_token');
    if (!token) return [];

    const res = await fetch(`${API_BASE}/customer/orders`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 401) return [];
      throw new Error('Failed to load past orders');
    }
    const json = await res.json();
    return json.data || [];
  },

  /**
   * Downloads official GST Tax Invoice PDF for a delivered order.
   */
  async downloadInvoicePdf(orderId: string, orderNumber: string): Promise<void> {
    const token = localStorage.getItem('saamaan_customer_token');
    const headers: Record<string, string> = {
      'X-Portal-Type': 'customer',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/customer/orders/${orderId}/invoice/pdf`, {
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to download invoice PDF.');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

