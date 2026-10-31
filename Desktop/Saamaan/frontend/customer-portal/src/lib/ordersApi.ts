import { fetchWithAuth } from './fetchWithAuth';

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
  checkoutUrl?: string;
  merchantTransactionId?: string;
  gateway?: string;
  paymentError?: string;
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

export const ordersApi = {
  /**
   * Submits a customer order to the backend API.
   */
  async placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
    const res = await fetchWithAuth(`${API_BASE}/customer/orders`, {
      method: 'POST',
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
    const res = await fetchWithAuth(`${API_BASE}/customer/orders`);

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
    const res = await fetchWithAuth(`${API_BASE}/customer/orders/${orderId}/invoice/pdf`);

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

export interface PaymentVerificationResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  orderId: string;
  orderNumber?: string;
  message?: string;
  failureReason?: string;
}

export const paymentsApi = {
  async verifyPayment(orderId: string, txnId?: string): Promise<PaymentVerificationResult> {
    const query = txnId ? `?txnId=${encodeURIComponent(txnId)}` : '';
    const res = await fetchWithAuth(`${API_BASE}/payments/verify/${orderId}${query}`, {
      method: 'GET',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Payment verification failed');
    }
    return json.data;
  },

  async retryPayment(orderId: string): Promise<{ checkoutUrl: string; merchantTransactionId: string }> {
    const res = await fetchWithAuth(`${API_BASE}/payments/initiate`, {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to initiate payment retry');
    }
    return json.data;
  },
};
