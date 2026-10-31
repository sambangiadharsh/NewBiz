import { IPaymentGateway } from './interfaces/paymentGateway.interface.js';
import { PhonePeGatewayAdapter } from './adapters/phonepe.adapter.js';
import { config } from '../../config/index.js';

export class PaymentGatewayFactory {
  private static instances = new Map<string, IPaymentGateway>();

  /**
   * Resolves the gateway adapter instance based on provider name or default environment configuration.
   */
  public static getGateway(providerName?: string): IPaymentGateway {
    const target = (providerName || config.DEFAULT_PAYMENT_GATEWAY || 'PHONEPE').toUpperCase();

    if (this.instances.has(target)) {
      return this.instances.get(target)!;
    }

    let gateway: IPaymentGateway;

    switch (target) {
      case 'PHONEPE':
        gateway = new PhonePeGatewayAdapter();
        break;

      // Future Gateway additions plug in here cleanly:
      // case 'RAZORPAY':
      //   gateway = new RazorpayGatewayAdapter();
      //   break;
      // case 'CASHFREE':
      //   gateway = new CashfreeGatewayAdapter();
      //   break;

      default:
        throw new Error(`Unsupported payment gateway provider: [${target}]`);
    }

    this.instances.set(target, gateway);
    return gateway;
  }
}
