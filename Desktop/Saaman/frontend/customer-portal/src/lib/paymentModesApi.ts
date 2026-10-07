const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface PaymentModeItem {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  status: string;
}

export const paymentModesApi = {
  async getPaymentModes(): Promise<PaymentModeItem[]> {
    const res = await fetch(`${API_BASE}/payment-modes`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to load payment methods');
    }

    const json = await res.json().catch(() => ({}));
    return json.data || [];
  },
};
