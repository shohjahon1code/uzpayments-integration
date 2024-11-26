import { createHash } from 'crypto';
import {
  PaymentConfig,
  PaymentOrder,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyResult,
} from '../interfaces/payment.interface';
import { 
  ClickTransactionResponse, 
  ClickCancelResponse,
  ClickWebhookRequest,
  ClickWebhookResponse,
  ClickErrorCodes
} from '../interfaces/click.interface';
import { HttpClient } from '../utils/http.client';

/**
 * Click Payment Provider Implementation
 * Supports both test and production environments
 * Handles payment creation, verification, cancellation and webhooks
 */
export class ClickProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly merchantApiUrl: string;
  private readonly config: Required<PaymentConfig>;

  constructor(
    private readonly httpClient: HttpClient,
    config: PaymentConfig
  ) {
    // Validate required configuration
    if (!config.merchant_id && !process.env.CLICK_MERCHANT_ID) {
      throw new Error('merchant_id is required. Provide in config or set CLICK_MERCHANT_ID env variable');
    }
    if (!config.secret_key && !process.env.CLICK_SECRET) {
      throw new Error('secret_key is required. Provide in config or set CLICK_SECRET env variable');
    }

    // Set configuration with defaults
    this.config = {
      merchant_id: config.merchant_id || process.env.CLICK_MERCHANT_ID!,
      service_id: config.service_id || process.env.CLICK_SERVICE_ID || '',
      secret_key: config.secret_key || process.env.CLICK_SECRET!,
      test_mode: config.test_mode ?? (process.env.NODE_ENV !== 'production'),
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retry_delay: config.retry_delay || 1000
    };

    // Set URLs based on environment
    this.baseUrl = this.config.test_mode 
      ? 'https://test.click.uz/services/pay'
      : 'https://my.click.uz/services/pay';
    
    this.merchantApiUrl = this.config.test_mode
      ? 'https://test.click.uz/api/v2/merchant'
      : 'https://click.uz/api/v2/merchant';
  }

  /**
   * Generate signature for Click API requests
   */
  private generateSignature(data: Record<string, any>): string {
    const signString = Object.values(data).join('');
    return createHash('md5')
      .update(signString + this.config.secret_key)
      .digest('hex');
  }

  /**
   * Generate payment URL for Click redirect
   */
  generatePaymentUrl(order: PaymentOrder): string {
    const params = new URLSearchParams({
      service_id: this.config.service_id,
      merchant_id: this.config.merchant_id,
      amount: String(order.amount.amount),
      transaction_param: order.id,
      return_url: order.return_url || '',
      ...(order.extra_params || {})
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Create a new payment
   */
  async createPayment(order: PaymentOrder): Promise<PaymentResult> {
    try {
      const paymentUrl = this.generatePaymentUrl(order);
      
      return {
        success: true,
        payment_url: paymentUrl,
        transaction_id: order.id
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(transaction_id: string): Promise<PaymentVerifyResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.request<ClickTransactionResponse>({
        method: 'POST',
        url: `${this.merchantApiUrl}/check_transaction`,
        data: {
          ...payload,
          signature
        }
      });

      return {
        success: response.data.success,
        transaction_id: response.data.transaction_id,
        status: this.mapClickStatus(response.data.status),
        paid_amount: response.data.amount,
        paid_time: response.data.payment_time ? new Date(response.data.payment_time) : undefined,
        error: response.data.error
      };
    } catch (error) {
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('ECONNABORTED'));

      return {
        success: false,
        status: 'failed',
        error: {
          code: isTimeout ? 'PAYMENT_TIMEOUT' : 'PAYMENT_VERIFY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(transaction_id: string): Promise<PaymentResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.request<ClickCancelResponse>({
        method: 'POST',
        url: `${this.merchantApiUrl}/cancel_transaction`,
        data: {
          ...payload,
          signature
        }
      });

      return {
        success: response.data.success,
        transaction_id: response.data.transaction_id,
        error: response.data.error
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CANCEL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Handle Click webhook requests
   */
  async handleWebhook(request: ClickWebhookRequest): Promise<ClickWebhookResponse> {
    // Verify signature
    if (!this.verifyWebhookSignature(request)) {
      return {
        click_trans_id: +request.click_trans_id,
        merchant_trans_id: request.merchant_trans_id,
        error: ClickErrorCodes.SignatureFailure,
        error_note: 'Invalid signature'
      };
    }

    // Handle prepare request (action = 0)
    if (request.action === 0) {
      return this.handlePreparePay(request);
    }

    // Handle complete request (action = 1)
    if (request.action === 1) {
      return this.handleCompletePay(request);
    }

    return {
      click_trans_id: +request.click_trans_id,
      merchant_trans_id: request.merchant_trans_id,
      error: ClickErrorCodes.BadRequest,
      error_note: 'Invalid action'
    };
  }

  /**
   * Verify Click webhook signature
   */
  private verifyWebhookSignature(request: ClickWebhookRequest): boolean {
    const signParams = {
      click_trans_id: request.click_trans_id,
      service_id: request.service_id,
      click_paydoc_id: request.click_paydoc_id,
      merchant_trans_id: request.merchant_trans_id,
      amount: request.amount,
      action: request.action,
      sign_time: request.sign_time
    };

    const signature = this.generateSignature(signParams);
    return signature === request.sign_string;
  }

  /**
   * Handle prepare payment webhook
   */
  private async handlePreparePay(request: ClickWebhookRequest): Promise<ClickWebhookResponse> {
    const prepare_id = Date.now();
    
    return {
      click_trans_id: +request.click_trans_id,
      merchant_trans_id: request.merchant_trans_id,
      merchant_prepare_id: prepare_id,
      error: ClickErrorCodes.Success,
      error_note: 'Success'
    };
  }

  /**
   * Handle complete payment webhook
   */
  private async handleCompletePay(request: ClickWebhookRequest): Promise<ClickWebhookResponse> {
    if (request.error < 0) {
      return {
        click_trans_id: +request.click_trans_id,
        merchant_trans_id: request.merchant_trans_id,
        error: request.error,
        error_note: request.error_note
      };
    }

    const confirm_id = Date.now();

    return {
      click_trans_id: +request.click_trans_id,
      merchant_trans_id: request.merchant_trans_id,
      merchant_confirm_id: confirm_id,
      error: ClickErrorCodes.Success,
      error_note: 'Success'
    };
  }

  /**
   * Map Click status to PaymentVerifyResult status
   */
  private mapClickStatus(status: number): PaymentVerifyResult['status'] {
    switch (status) {
      case 1:
        return 'completed';
      case 0:
        return 'pending';
      case -1:
        return 'cancelled';
      default:
        return 'failed';
    }
  }
}
