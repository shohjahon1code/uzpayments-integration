import { AxiosError } from 'axios';
import { createHash } from 'crypto';
import {
  PaymentConfig,
  PaymentOrder,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyResult,
} from '../interfaces/payment.interface';
import { PaymeTransactionResponse, PaymeCancelResponse } from '../interfaces/payme.interface';
import { HttpClient } from '../utils/http.client';

export class PaymeProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly checkoutUrl: string;
  private readonly config: PaymentConfig;
  private readonly httpClient: HttpClient;

  constructor(config: PaymentConfig) {
    if (!config.merchant_id && !process.env.PAYME_MERCHANT_ID) {
      throw new Error('merchant_id is required. Provide it in config or set PAYME_MERCHANT_ID environment variable.');
    }
    if (!config.secret_key && !process.env.PAYME_KEY) {
      throw new Error('secret_key is required. Provide it in config or set PAYME_KEY environment variable.');
    }

    this.config = {
      merchant_id: config.merchant_id || process.env.PAYME_MERCHANT_ID!,
      secret_key: config.secret_key || process.env.PAYME_KEY!,
      test_mode: config.test_mode ?? (process.env.NODE_ENV !== 'production'),
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retry_delay: config.retry_delay || 1000
    };

    this.baseUrl = this.config.test_mode
      ? 'https://test.paycom.uz/api'
      : 'https://paycom.uz/api';
    this.checkoutUrl = this.config.test_mode
      ? 'https://test.checkout.paycom.uz'
      : 'https://checkout.paycom.uz';
    
    this.httpClient = new HttpClient(
      this.config.timeout,
      this.config.retries,
      this.config.retry_delay
    );
  }

  private generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private generateSignature(payload: string): string {
    return createHash('sha256')
      .update(this.config.secret_key + payload)
      .digest('hex');
  }

  private encodeParams(params: Record<string, any>): string {
    const base64 = Buffer.from(JSON.stringify(params)).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  generatePaymentUrl(order: PaymentOrder): string {
    const params = {
      m: this.config.merchant_id,
      ac: {
        order_id: order.id,
        ...order.extra_params
      },
      a: order.amount.amount,
      l: order.return_url || '',
      c: order.cancel_url || '',
    };

    return `${this.checkoutUrl}/${this.encodeParams(params)}`;
  }

  async createPayment(order: PaymentOrder): Promise<PaymentResult> {
    try {
      // For Payme, we'll return the checkout URL directly
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
      const timestamp = this.generateTimestamp();
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp,
      };

      const signature = this.generateSignature(JSON.stringify(payload));

      const response = await this.httpClient.request<PaymeTransactionResponse>({
        method: 'POST',
        url: `${this.baseUrl}/merchants/check_transaction`,
        data: {
          ...payload,
          signature,
        }
      });

      const status = response.data.state === 2 ? 'completed' :
                    response.data.state === 1 ? 'pending' :
                    response.data.state === -1 ? 'cancelled' : 'failed';

      return {
        success: response.data.success,
        transaction_id: response.data.transaction_id,
        status,
        paid_amount: response.data.amount,
        paid_time: response.data.paid_time ? new Date(response.data.paid_time) : undefined,
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
      const timestamp = this.generateTimestamp();
      const payload = {
        merchant_id: this.config.merchant_id,
        transaction_id,
        timestamp,
      };

      const signature = this.generateSignature(JSON.stringify(payload));

      const response = await this.httpClient.request<PaymeCancelResponse>({
        method: 'POST',
        url: `${this.baseUrl}/merchants/cancel_transaction`,
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
