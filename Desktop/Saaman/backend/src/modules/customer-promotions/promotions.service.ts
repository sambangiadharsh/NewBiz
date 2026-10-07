import { customerPromotionsRepository } from './promotions.repository.js';
import { BadRequestError } from '../../utils/errors.js';

export interface ValidatePromotionInput {
  code: string;
  subtotal: number;
}

export interface ValidatedPromotionResult {
  valid: boolean;
  promotion: {
    promotionId: string;
    code: string;
    name: string;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    discountAmount: number;
    minOrderValue: number;
    maxDiscountAmount: number | null;
  };
  message: string;
}

export class CustomerPromotionsService {
  async validatePromotion(input: ValidatePromotionInput): Promise<ValidatedPromotionResult> {
    if (!input.code || !input.code.trim()) {
      throw new BadRequestError('Please enter a coupon code');
    }

    const subtotal = Math.max(0, Number(input.subtotal) || 0);
    const promo = await customerPromotionsRepository.findByCode(input.code);

    if (!promo) {
      throw new BadRequestError('Invalid or expired coupon code. Please check and try again.');
    }

    const minOrder = Number(promo.MinOrderValue || 0);
    if (minOrder > 0 && subtotal < minOrder) {
      throw new BadRequestError(
        `Coupon "${promo.PromotionCode || input.code.toUpperCase()}" requires a minimum order value of ₹${minOrder}. (Current subtotal: ₹${subtotal})`
      );
    }

    const discountVal = Number(promo.DiscountValue);
    const discountType = (promo.DiscountType?.toUpperCase() === 'FLAT' ? 'FLAT' : 'PERCENTAGE') as 'PERCENTAGE' | 'FLAT';
    let discountAmount = 0;

    if (discountType === 'PERCENTAGE') {
      discountAmount = Math.round(((subtotal * discountVal) / 100) * 100) / 100;
      if (promo.MaxDiscountAmount && Number(promo.MaxDiscountAmount) > 0) {
        discountAmount = Math.min(discountAmount, Number(promo.MaxDiscountAmount));
      }
    } else {
      discountAmount = Math.min(discountVal, subtotal);
    }

    const codeName = promo.PromotionCode || promo.PromotionName || input.code.toUpperCase();

    return {
      valid: true,
      promotion: {
        promotionId: String(promo.PromotionID),
        code: codeName,
        name: promo.PromotionName,
        discountType,
        discountValue: discountVal,
        discountAmount,
        minOrderValue: minOrder,
        maxDiscountAmount: promo.MaxDiscountAmount ? Number(promo.MaxDiscountAmount) : null,
      },
      message: `Coupon "${codeName}" applied! You saved ₹${discountAmount}.`,
    };
  }
}

export const customerPromotionsService = new CustomerPromotionsService();
