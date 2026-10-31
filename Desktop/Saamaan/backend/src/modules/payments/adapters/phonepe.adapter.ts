import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import {
  IPaymentGateway,
  InitiatePaymentRequest,
  InitiatePaymentResult,
  VerifyPaymentResult,
  WebhookVerificationResult,
  PaymentStatus,
} from '../interfaces/paymentGateway.interface.js';

interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp in ms
}

export class PhonePeGatewayAdapter implements IPaymentGateway {
  readonly providerName = 'PHONEPE';

  private cachedToken: CachedToken | null = null;

  /**
   * Cleans base URL to strip any trailing endpoint paths accidentally pasted in .env
   */
  private getCleanBaseUrl(): string {
    const raw = config.PHONEPE_BASE_URL?.trim() || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    return raw.replace(/\/checkout\/v2\/pay\/?$/, '').replace(/\/+$/, '');
  }

  /**
   * Constructs the PhonePe-hosted Mercury checkout page URL.
   * PhonePe Mercury requires the OAuth access token as a query param for authentication.
   *
   * UAT  → https://mercury-uat.phonepe.com/transact/{orderId}?token={accessToken}
   * PROD → https://mercury.phonepe.com/transact/{orderId}?token={accessToken}
   */
  private getCheckoutPageUrl(phonepeOrderId: string, accessToken: string): string {
    const env = (config.PHONEPE_ENV || 'UAT').toUpperCase();
    const base = env === 'PRODUCTION'
      ? 'https://mercury.phonepe.com/transact'
      : 'https://mercury-uat.phonepe.com/transact';
    return `${base}/${phonepeOrderId}?token=${encodeURIComponent(accessToken)}`;
  }

  /**
   * Generates or retrieves a valid OAuth 2.0 Bearer Token using Client ID & Secret
   */
  private async getAccessToken(): Promise<CachedToken> {
    const clientId = config.PHONEPE_CLIENT_ID?.trim();
    const clientSecret = config.PHONEPE_CLIENT_SECRET?.trim();
    const baseUrl = this.getCleanBaseUrl();

    if (!clientId || !clientSecret) {
      throw new Error(
        'PhonePe Client ID or Client Secret is missing. Please set PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET in backend/.env'
      );
    }

    // Return cached token if valid for at least another 60 seconds
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken;
    }

    try {
      const tokenUrl = `${baseUrl}/v1/oauth/token`;
      logger.info(`Requesting PhonePe OAuth token from: ${tokenUrl}`, undefined, 'PhonePeAdapter');

      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_version', config.PHONEPE_CLIENT_VERSION?.trim() || '1');
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'client_credentials');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`PhonePe OAuth token request failed (${response.status}): ${errorText}`, undefined, 'PhonePeAdapter');
        throw new Error(`PhonePe authentication failed: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      const accessToken = data.access_token || data.token;
      const tokenType = data.token_type || 'O-Bearer';
      // Expires_in is typically in seconds, e.g. 3600
      const expiresInSec = Number(data.expires_in || data.expires_at) || 3600;
      const expiresAt = now + expiresInSec * 1000;

      this.cachedToken = { accessToken, tokenType, expiresAt };
      logger.info('PhonePe OAuth token generated and cached successfully', undefined, 'PhonePeAdapter');

      return this.cachedToken;
    } catch (err: any) {
      logger.error('Failed to obtain PhonePe access token:', err.message, 'PhonePeAdapter');
      throw err;
    }
  }

  /**
   * Initiates payment order on PhonePe Standard Checkout v2
   */
  async initiatePayment(params: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const tokenInfo = await this.getAccessToken();
    const baseUrl = this.getCleanBaseUrl();
    const payUrl = `${baseUrl}/checkout/v2/pay`;

    // Format: TXN + OrderNumericID + NumericEpoch (e.g. TXN1000231730034829123)
    const cleanOrderNum = params.orderNumber.replace(/\D/g, '') || String(params.orderId);
    const merchantTransactionId = `TXN${cleanOrderNum}${Date.now()}`;

    // Amount must be in paise (e.g. ₹100.50 -> 10050 paise)
    const amountInPaise = Math.round(params.amount * 100);

    const redirectUrl = `${params.redirectUrl}?orderId=${params.orderId}&txnId=${merchantTransactionId}`;
    const callbackUrl = config.PHONEPE_WEBHOOK_URL?.trim() || undefined;

    const requestBody: any = {
      merchantOrderId: merchantTransactionId,
      amount: amountInPaise,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: `Order #${params.orderNumber} Payment`,
        merchantUrls: {
          redirectUrl,
        },
      },
    };

    if (callbackUrl) {
      requestBody.callbackUrl = callbackUrl;
    }

    if (params.customerId || params.customerPhone || params.customerEmail) {
      requestBody.customerDetails = {
        id: String(params.customerId),
        mobileNumber: params.customerPhone ? params.customerPhone.replace(/\D/g, '').slice(-10) : undefined,
        email: params.customerEmail || undefined,
        name: params.customerName || undefined,
      };
    }

    const headers: Record<string, string> = {
      Authorization: `${tokenInfo.tokenType} ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    };

    logger.info(`Initiating PhonePe checkout for ${merchantTransactionId} (amount: ₹${params.amount})`, undefined, 'PhonePeAdapter');

    const res = await fetch(payUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseJson: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error('PhonePe checkout/v2/pay error:', responseJson, 'PhonePeAdapter');
      const errorMsg = responseJson.message || responseJson.description || `PhonePe payment initiation failed with HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    // PhonePe v2 returns the official hosted checkout URL in responseJson.redirectUrl:
    // e.g. https://mercury-uat.phonepe.com/transact/uat_v3?token=...&routingKey=W
    // This URL includes the transaction JWT session and routingKey required for real-time
    // synchronization between UPI QR scans (on mobile) and the desktop browser checkout session.
    let checkoutUrl = responseJson.redirectUrl;

    if (!checkoutUrl || !checkoutUrl.includes('phonepe.com')) {
      const phonepeOrderId = responseJson.orderId || responseJson.data?.orderId;
      if (!phonepeOrderId) {
        logger.error('PhonePe did not return a valid orderId in checkout response:', responseJson, 'PhonePeAdapter');
        throw new Error('PhonePe payment initiation failed: no orderId returned from gateway.');
      }
      checkoutUrl = this.getCheckoutPageUrl(phonepeOrderId, tokenInfo.accessToken);
    }

    logger.info(
      `PhonePe order created: ${responseJson.orderId || 'OK'} → Checkout URL: ${checkoutUrl}`,
      undefined,
      'PhonePeAdapter'
    );

    return {
      merchantTransactionId,
      checkoutUrl,
      gatewayName: this.providerName,
      rawResponse: responseJson,
    };
  }

  /**
   * Actively queries PhonePe's order status endpoint (Way 2 - Synchronous Return)
   */
  async verifyPayment(merchantTransactionId: string): Promise<VerifyPaymentResult> {
    const tokenInfo = await this.getAccessToken();
    const baseUrl = this.getCleanBaseUrl();
    const statusUrl = `${baseUrl}/checkout/v2/order/${encodeURIComponent(merchantTransactionId)}/status`;

    const headers: Record<string, string> = {
      Authorization: `${tokenInfo.tokenType} ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    };

    logger.info(`Querying PhonePe order status: ${statusUrl}`, undefined, 'PhonePeAdapter');

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers,
    });

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.warn(`PhonePe status inquiry returned HTTP ${res.status}:`, body, 'PhonePeAdapter');
      return {
        merchantTransactionId,
        status: 'PENDING',
        failureReason: body.message || `PhonePe inquiry HTTP ${res.status}`,
        rawResponse: body,
      };
    }

    // Extract state from PhonePe v2 response
    const rawState = (body.state || body.data?.state || body.status || '').toUpperCase();
    // Also treat known terminal error codes as FAILED even if state is missing
    const errorCode = (body.errorCode || body.detailedErrorCode || '').toUpperCase();
    const FAILED_STATES = ['FAILED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'TIMED_OUT'];
    const FAILED_ERROR_CODES = ['TXN_NOT_COMPLETED', 'ORDER_EXPIRED', 'PAYMENT_ERROR', 'AUTHORIZATION_FAILED', 'PAYMENT_DECLINED'];

    let status: PaymentStatus = 'PENDING';
    if (['COMPLETED', 'SUCCESS', 'PAID'].includes(rawState)) {
      status = 'SUCCESS';
    } else if (FAILED_STATES.includes(rawState) || FAILED_ERROR_CODES.includes(errorCode)) {
      status = 'FAILED';
    }

    // Gateway's own transaction/order reference
    const gatewayTransactionId =
      body.orderId ||
      body.data?.orderId ||
      body.transactionId ||
      body.data?.transactionId ||
      body.paymentDetails?.[0]?.transactionId;

    const amountInPaise = body.amount || body.data?.amount;
    const amount = typeof amountInPaise === 'number' ? amountInPaise / 100 : undefined;

    // Human-readable failure reason
    const detailedCode = body.detailedErrorCode || body.errorCode;
    const failureReason = status === 'FAILED'
      ? (detailedCode === 'ORDER_EXPIRED'
          ? 'Payment session expired. Please try again.'
          : detailedCode === 'TXN_NOT_COMPLETED'
          ? 'Payment was not completed. Please retry.'
          : body.message || body.data?.errorDescription || 'Payment declined or cancelled.')
      : undefined;

    logger.info(
      `PhonePe status for ${merchantTransactionId}: state=${rawState}, errorCode=${errorCode}, mapped=${status}`,
      undefined,
      'PhonePeAdapter'
    );

    return {
      merchantTransactionId,
      gatewayTransactionId,
      status,
      amount,
      paidAt: status === 'SUCCESS' ? new Date() : undefined,
      failureReason,
      rawResponse: body,
    };
  }

  /**
   * Cryptographically verifies and parses an incoming server-to-server webhook (Way 1 - Asynchronous)
   */
  async verifyWebhook(_headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult> {
    try {
      const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      const eventData = payload.data || payload;

      const merchantTransactionId = eventData.merchantOrderId || eventData.merchantTransactionId;

      if (!merchantTransactionId) {
        return {
          isValid: false,
          errorMessage: 'Missing merchantOrderId in PhonePe webhook payload',
        };
      }

      const rawState = (eventData.state || eventData.status || '').toUpperCase();
      let status: PaymentStatus = 'PENDING';

      if (['COMPLETED', 'SUCCESS', 'PAID'].includes(rawState)) {
        status = 'SUCCESS';
      } else if (['FAILED', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(rawState)) {
        status = 'FAILED';
      }

      const gatewayTransactionId = eventData.orderId || eventData.transactionId;
      const amountInPaise = eventData.amount;
      const amount = typeof amountInPaise === 'number' ? amountInPaise / 100 : undefined;

      return {
        isValid: true,
        event: {
          merchantTransactionId,
          gatewayTransactionId,
          status,
          amount,
          paidAt: status === 'SUCCESS' ? new Date() : undefined,
          failureReason: status === 'FAILED' ? (eventData.errorDescription || eventData.message || 'Payment failed') : undefined,
          rawResponse: payload,
        },
      };
    } catch (err: any) {
      return {
        isValid: false,
        errorMessage: `Failed to parse webhook payload: ${err.message}`,
      };
    }
  }
}
