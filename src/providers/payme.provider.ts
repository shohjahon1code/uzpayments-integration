import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import {
  PaymentOrder,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyResult,
} from '../interfaces/payment.interface';
import {
  PaymeTransactionState,
  PaymeErrorCodes,
  PaymeWebhookRequest,
  PaymeWebhookResponse,
  PaymeTransactionResponse,
  PaymeCancelResponse,
  PaymeConfig,
} from '../interfaces/payme.interface';
import { HttpClient } from '../utils/http.client';

/**
 * Payme Payment Provider Implementation
 * Supports both test and production environments
 * Handles payment creation, verification, cancellation and webhooks
 */
export class PaymeProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly merchantApiUrl: string;
  private readonly config: Required<PaymeConfig>;
  private readonly authorization: string;

  constructor(
    private readonly httpClient: HttpClient,
    config: PaymeConfig
  ) {
    // Validate required configuration
    if (!config.merchant_id && !process.env.PAYME_MERCHANT_ID) {
      throw new Error('merchant_id is required. Provide in config or set PAYME_MERCHANT_ID env variable');
    }
    if (!config.password && !process.env.PAYME_PASSWORD && !process.env.PAYME_PASSWORD_TEST) {
      throw new Error('password is required. Provide in config or set PAYME_PASSWORD/PAYME_PASSWORD_TEST env variable');
    }

    const isTestMode = config.test_mode ?? (process.env.NODE_ENV !== 'production');

    // Set configuration with defaults
    this.config = {
      merchant_id: config.merchant_id || process.env.PAYME_MERCHANT_ID!,
      login: config.login || process.env.PAYME_LOGIN || 'Paycom',
      password: config.password || (isTestMode ? process.env.PAYME_PASSWORD_TEST! : process.env.PAYME_PASSWORD!),
      test_mode: isTestMode,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retry_delay: config.retry_delay || 1000
    };

    // Generate Basic Auth token
    this.authorization = Buffer.from(`${this.config.login}:${this.config.password}`).toString('base64');

    // Set URLs based on environment
    this.baseUrl = this.config.test_mode 
      ? 'https://test.paycom.uz'
      : 'https://checkout.paycom.uz';
    
    this.merchantApiUrl = this.config.test_mode
      ? 'https://test.paycom.uz/api'
      : 'https://paycom.uz/api';
  }

  /**
   * Generate payment URL for Payme redirect
   */
  generatePaymentUrl(order: PaymentOrder): string {
    const params = new URLSearchParams({
      m: this.config.merchant_id,
      a: String(order.amount.amount * 100), // Convert to tiyin
      ac: JSON.stringify({
        order_id: order.id,
        ...order.extra_params
      }),
      l: order.return_url || '',
      c: order.description || ''
    });

    const encodedParams = Buffer.from(params.toString()).toString('base64');
    return `${this.baseUrl}/${encodedParams}`;
  }

  /**
   * Create a new payment
   */
  async createPayment(order: PaymentOrder): Promise<PaymentResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        method: 'CreateTransaction',
        params: {
          amount: order.amount.amount * 100, // Convert to tiyin
          account: {
            order_id: order.id,
            ...order.extra_params
          },
          time: timestamp
        }
      };

      const response = await this.httpClient.request<PaymeTransactionResponse>({
        method: 'POST',
        url: this.merchantApiUrl,
        headers: {
          'Authorization': `Basic ${this.authorization}`
        },
        data: payload
      });

      return {
        success: true,
        payment_url: this.generatePaymentUrl(order),
        transaction_id: response.data.result.transaction
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
        method: 'CheckTransaction',
        params: {
          transaction: transaction_id,
          time: timestamp
        }
      };

      const response = await this.httpClient.request<PaymeTransactionResponse>({
        method: 'POST',
        url: this.merchantApiUrl,
        headers: {
          'Authorization': `Basic ${this.authorization}`
        },
        data: payload
      });

      return {
        success: true,
        transaction_id: response.data.result.transaction,
        status: this.mapPaymeStatus(response.data.result.state),
        paid_amount: response.data.result.amount / 100, // Convert from tiyin
        paid_time: response.data.result.perform_time ? new Date(response.data.result.perform_time) : undefined
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
        method: 'CancelTransaction',
        params: {
          transaction: transaction_id,
          time: timestamp
        }
      };

      const response = await this.httpClient.request<PaymeCancelResponse>({
        method: 'POST',
        url: this.merchantApiUrl,
        headers: {
          'Authorization': `Basic ${this.authorization}`
        },
        data: payload
      });

      return {
        success: true,
        transaction_id: response.data.result.transaction
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
   * Handle Payme webhook requests
   */
  async handleWebhook(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    // Verify authorization
    if (!this.verifyWebhookAuthorization(request)) {
      return {
        error: {
          code: PaymeErrorCodes.AuthorizationFailure,
          message: 'Invalid authorization'
        }
      };
    }

    switch (request.method) {
      case 'CheckPerformTransaction':
        return this.handleCheckPerformTransaction(request);
      case 'CreateTransaction':
        return this.handleCreateTransaction(request);
      case 'PerformTransaction':
        return this.handlePerformTransaction(request);
      case 'CancelTransaction':
        return this.handleCancelTransaction(request);
      case 'CheckTransaction':
        return this.handleCheckTransaction(request);
      case 'GetStatement':
        return this.handleGetStatement(request);
      default:
        return {
          error: {
            code: PaymeErrorCodes.MethodNotFound,
            message: 'Method not found'
          }
        };
    }
  }

  /**
   * Verify Payme webhook authorization
   */
  private verifyWebhookAuthorization(request: PaymeWebhookRequest): boolean {
    const authHeader = request.headers?.['Authorization'];
    if (!authHeader?.startsWith('Basic ')) return false;

    const token = authHeader.slice(6); // Remove 'Basic ' prefix
    return token === this.authorization;
  }

  /**
   * Handle check perform transaction webhook
   */
  private async handleCheckPerformTransaction(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { amount, account } = request.params;
    
    // Implement your business logic here
    // For example, check if the order exists and the amount is correct
    
    return {
      result: {
        allow: true
      }
    };
  }

  /**
   * Handle create transaction webhook
   */
  private async handleCreateTransaction(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { id, time, amount, account } = request.params;
    
    // Implement your business logic here
    // For example, create a new transaction in your database
    
    return {
      result: {
        create_time: Date.now(),
        transaction: id,
        state: PaymeTransactionState.Created
      }
    };
  }

  /**
   * Handle perform transaction webhook
   */
  private async handlePerformTransaction(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { id } = request.params;
    
    // Implement your business logic here
    // For example, mark the transaction as completed in your database
    
    return {
      result: {
        transaction: id,
        perform_time: Date.now(),
        state: PaymeTransactionState.Completed
      }
    };
  }

  /**
   * Handle cancel transaction webhook
   */
  private async handleCancelTransaction(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { id, reason } = request.params;
    
    // Implement your business logic here
    // For example, mark the transaction as cancelled in your database
    
    return {
      result: {
        transaction: id,
        cancel_time: Date.now(),
        state: PaymeTransactionState.Cancelled
      }
    };
  }

  /**
   * Handle check transaction webhook
   */
  private async handleCheckTransaction(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { id } = request.params;
    
    // Implement your business logic here
    // For example, get transaction details from your database
    
    return {
      result: {
        create_time: Date.now(),
        perform_time: Date.now(),
        cancel_time: null,
        transaction: id,
        state: PaymeTransactionState.Created,
        reason: null
      }
    };
  }

  /**
   * Handle get statement webhook
   */
  private async handleGetStatement(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse> {
    const { from, to } = request.params;
    
    // Implement your business logic here
    // For example, get transactions within the date range from your database
    
    return {
      result: {
        transactions: []
      }
    };
  }

  /**
   * Map Payme status to PaymentVerifyResult status
   */
  private mapPaymeStatus(state: number): PaymentVerifyResult['status'] {
    switch (state) {
      case PaymeTransactionState.Completed:
        return 'completed';
      case PaymeTransactionState.Created:
        return 'pending';
      case PaymeTransactionState.Cancelled:
      case PaymeTransactionState.CancelledAfterComplete:
        return 'cancelled';
      default:
        return 'failed';
    }
  }

  /**
   * Check if transaction has expired
   */
  private checkTransactionExpiration(createdAt: Date): boolean {
    const timeoutDuration = 720; // 12 hours in minutes
    const timeoutThreshold = DateTime.now()
      .minus({ minutes: timeoutDuration })
      .toJSDate();

    return createdAt < timeoutThreshold;
  }
}
