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

export interface ItemReturnPolicy {
  policyCode: string;
  policyName: string;
  isReturnable: boolean;
  isReplaceable: boolean;
  returnWindowDays: number;
  replacementWindowDays: number;
  requiresTechnicianCheck: boolean;
  conditionsSummary?: string | null;
}

export interface ItemReturnRequest {
  returnRequestId: string;
  requestNumber: string;
  requestType: 'RETURN' | 'REPLACEMENT';
  status: string;
  reasonCategory: string;
  reasonDescription?: string;
  resolutionType: string;
  refundMethod?: string;
  createdAt: string;
}

export interface CustomerOrderItem {
  orderItemId: string;
  productId: string;
  productName: string;
  sellerSku?: string | null;
  variantSku?: string | null;
  variantModelCode?: string | null;
  attributes?: Record<string, any> | null;
  quantity: number;
  unitPrice: number;
  mrp: number;
  totalAmount: number;
  thumbnail: string | null;
  returnPolicy?: ItemReturnPolicy | null;
  returnRequest?: ItemReturnRequest | null;
}

export interface SubmitReturnPayload {
  orderItemId: string;
  requestType: 'RETURN' | 'REPLACEMENT';
  reasonCategory: string;
  reasonDescription?: string;
  quantity?: number;
  resolutionType?: 'REFUND' | 'REPLACEMENT';
  refundMethod?: 'ORIGINAL_PAYMENT' | 'UPI' | 'BANK_ACCOUNT';
  refundDetails?: {
    upiId?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  pickupAddress?: {
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  images?: string[];
}

export interface ReturnRequestRecord {
  returnRequestId: string;
  requestNumber: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  productName: string;
  requestType: 'RETURN' | 'REPLACEMENT';
  reasonCategory: string;
  reasonDescription?: string;
  quantity: number;
  resolutionType: string;
  refundMethod?: string;
  status: string;
  adminComments?: string;
  pickupAddress?: any;
  trackingNumber?: string;
  createdAt: string;
  updatedAt?: string;
  assets?: string[];
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

  /**
   * Submits a return or replacement request for an order item.
   */
  async submitReturnRequest(payload: SubmitReturnPayload): Promise<{ returnRequestId: string; requestNumber: string; status: string; createdAt: string }> {
    const res = await fetchWithAuth(`${API_BASE}/customer/orders/returns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to submit return request');
    }
    return json.data;
  },

  /**
   * Uploads proof photo/attachment files for return/replacement requests.
   */
  async uploadReturnProof(files: File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('proofs', file);
    });

    const res = await fetchWithAuth(`${API_BASE}/customer/orders/returns/upload-proof`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || json.error?.message || 'Failed to upload proof images');
    }
    return json.data?.urls || [];
  },

  /**
   * Retrieves all return requests for logged-in customer.
   */
  async getMyReturnRequests(): Promise<ReturnRequestRecord[]> {
    const res = await fetchWithAuth(`${API_BASE}/customer/orders/returns`);
    if (!res.ok) {
      if (res.status === 401) return [];
      throw new Error('Failed to load return requests');
    }
    const json = await res.json();
    return json.data || [];
  },

  /**
   * Cancels a pending return request.
   */
  async cancelReturnRequest(returnRequestId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/customer/orders/returns/${returnRequestId}/cancel`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to cancel return request');
    }
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
  async verifyPayment(orderId: string, txnId?: string, customerId?: string): Promise<PaymentVerificationResult> {
    const params = new URLSearchParams();
    if (txnId) params.append('txnId', txnId);
    if (customerId) params.append('customerId', customerId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchWithAuth(`${API_BASE}/payments/verify/${orderId}${queryString}`, {
      method: 'GET',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || json.message || 'Payment verification failed');
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
      throw new Error(json.error?.message || json.message || 'Failed to initiate payment retry');
    }
    return json.data;
  },
};
