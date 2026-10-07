import { paymentModesRepository } from './paymentModes.repository.js';

export interface FormattedPaymentMode {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  status: string;
}

export class PaymentModesService {
  async getActivePaymentModes(): Promise<FormattedPaymentMode[]> {
    const raw = await paymentModesRepository.listActive();
    return raw.map((pm) => ({
      id: String(pm.PaymentModeID),
      code: pm.PaymentModeCode.toUpperCase(),
      name: pm.PaymentModeName,
      type: pm.PaymentModeType,
      description: this.getModeDescription(pm.PaymentModeCode),
      status: pm.Status,
    }));
  }

  private getModeDescription(code: string): string {
    switch (code.toUpperCase()) {
      case 'UPI':
        return 'GPay, PhonePe, Paytm, BHIM or any UPI App';
      case 'CARD':
        return 'Credit & Debit Cards (Visa, Mastercard, RuPay)';
      case 'NETBANKING':
        return 'All Major Indian Banks Net Banking';
      case 'COD':
        return 'Pay with cash upon delivery at your doorstep';
      default:
        return 'Secure payment';
    }
  }
}

export const paymentModesService = new PaymentModesService();
