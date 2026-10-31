export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface InitiatePaymentRequest {
  orderId: bigint;
  orderNumber: string;
  amount: number; // in Rupees
  customerId: bigint;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  redirectUrl: string;
}

export interface InitiatePaymentResult {
  merchantTransactionId: string;
  checkoutUrl: string;
  gatewayName: string;
  rawResponse?: any;
}

export interface VerifyPaymentResult {
  merchantTransactionId: string;
  gatewayTransactionId?: string;
  status: PaymentStatus;
  amount?: number;
  paidAt?: Date;
  failureReason?: string;
  rawResponse?: any;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: VerifyPaymentResult;
  errorMessage?: string;
}

/**
 * Enterprise Payment Gateway Strategy Interface.
 * Any payment gateway (PhonePe v2, Razorpay, Cashfree, Stripe) must implement this contract.
 */
export interface IPaymentGateway {
  readonly providerName: string;

  /**
   * Initiates payment with the gateway and returns the checkout redirect URL.
   */
  initiatePayment(params: InitiatePaymentRequest): Promise<InitiatePaymentResult>;

  /**
   * Actively queries the gateway's status endpoint (Way 2 - Synchronous Return).
   */
  verifyPayment(merchantTransactionId: string): Promise<VerifyPaymentResult>;

  /**
   * Cryptographically verifies and parses an incoming server-to-server webhook (Way 1 - Asynchronous).
   */
  verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult>;
}
