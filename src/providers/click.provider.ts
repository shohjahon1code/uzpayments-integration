import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import {
  PaymentConfig,
  PaymentOrder,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyResult,
} from '../interfaces/payment.interface';
import { ClickTransactionResponse, ClickCancelResponse } from '../interfaces/click.interface';
import { HttpClient } from '../utils/http.client';

export class ClickProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly merchantApiUrl: string;
  private readonly config: PaymentConfig;
  private readonly httpClient: HttpClient;

  constructor(config: PaymentConfig) {
    if (!config.merchant_id && !process.env.CLICK_MERCHANT_ID) {
      throw new Error('merchant_id is required. Provide it in config or set CLICK_MERCHANT_ID environment variable.');
    }
    if (!config.secret_key && !process.env.CLICK_SECRET) {
      throw new Error('secret_key is required. Provide it in config or set CLICK_SECRET environment variable.');
    }

    this.config = {
      merchant_id: config.merchant_id || process.env.CLICK_MERCHANT_ID!,
      service_id: config.service_id || process.env.CLICK_SERVICE_ID || '',
      secret_key: config.secret_key || process.env.CLICK_SECRET!,
      test_mode: config.test_mode ?? (process.env.NODE_ENV !== 'production'),
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retry_delay: config.retry_delay || 1000
    };

    this.baseUrl = 'https://my.click.uz/services/pay';
    this.merchantApiUrl = this.config.test_mode
      ? 'https://test.click.uz/api/v2/merchant'
      : 'https://click.uz/api/v2/merchant';
    
    this.httpClient = new HttpClient(
      this.config.timeout,
      this.config.retries,
      this.config.retry_delay
    );
  }

  private generateSignature(payload: Record<string, any>): string {
    const signString = Object.values(payload).join('');
    return createHash('md5')
      .update(signString + this.config.secret_key)
      .digest('hex');
  }

  generatePaymentUrl(order: PaymentOrder): string {
    const params = new URLSearchParams({
      service_id: this.config.service_id || '',
      merchant_id: this.config.merchant_id,
      amount: String(order.amount.amount),
      transaction_param: order.id,
      return_url: order.return_url || '',
      ...order.extra_params,
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  async createPayment(order: PaymentOrder): Promise<PaymentResult> {
    try {
      // For Click, we'll return the payment URL directly
      const paymentUrl = this.generatePaymentUrl(order);

      return {
        success: true,
        payment_url: paymentUrl,
        transaction_id: order.id,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async verifyPayment(transaction_id: string): Promise<PaymentVerifyResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp,
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.request<ClickTransactionResponse>({
        method: 'POST',
        url: `${this.merchantApiUrl}/check_transaction`,
        data: {
          ...payload,
          signature,
        }
      });

      const status = response.data.status === 1 ? 'completed' :
                    response.data.status === 0 ? 'pending' :
                    response.data.status === -1 ? 'cancelled' : 'failed';

      return {
        success: response.data.success,
        transaction_id: response.data.transaction_id,
        status,
        paid_amount: response.data.amount,
        paid_time: response.data.payment_time ? new Date(response.data.payment_time) : undefined,
        error: response.data.error,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('ECONNABORTED'));
      
      return {
        success: false,
        status: 'failed',
        error: {
          code: isTimeout ? 'PAYMENT_TIMEOUT' : 'PAYMENT_VERIFY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async cancelPayment(transaction_id: string): Promise<PaymentResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp,
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.request<ClickCancelResponse>({
        method: 'POST',
        url: `${this.merchantApiUrl}/cancel_transaction`,
        data: {
          ...payload,
          signature,
        }
      });

      return {
        success: response.data.success,
        transaction_id: response.data.transaction_id,
        error: response.data.error,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_CANCEL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
