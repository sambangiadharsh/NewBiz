const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface ValidatedPromotion {
  promotionId: string;
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  discountAmount: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
}

export interface PromotionValidateResponse {
  valid: boolean;
  promotion: ValidatedPromotion;
  message: string;
}

export const promotionsApi = {
  async validate(code: string, subtotal: number): Promise<PromotionValidateResponse> {
    const res = await fetch(`${API_BASE}/customer/promotions/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Type': 'customer',
      },
      credentials: 'include',
      body: JSON.stringify({ code, subtotal }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || json.message || 'Invalid or expired coupon code');
    }

    return json.data;
  },
};
