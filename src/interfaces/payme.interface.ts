export enum PaymeTransactionState {
  Created = 1,
  Completed = 2,
  Cancelled = -1,
  CancelledAfterComplete = -2
}

export enum PaymeErrorCodes {
  InvalidAmount = -31001,
  InvalidAccount = -31050,
  MethodNotFound = -32601,
  TransactionNotFound = -31003,
  CantPerformTransaction = -31008,
  CantCancelTransaction = -31007,
  TransactionAlreadyExists = -31051,
  AuthorizationFailure = -32504,
  InternalError = -32400
}

export interface PaymeAccount {
  order_id: string;
  [key: string]: any;
}

export interface PaymeTransactionResult {
  transaction: string;
  create_time: number;
  perform_time?: number;
  cancel_time?: number;
  state: PaymeTransactionState;
  reason?: number;
  receivers?: string[];
  amount: number;  // Amount in tiyin
}

export interface PaymeTransactionResponse {
  result: PaymeTransactionResult;
}

export interface PaymeCancelResponse {
  result: {
    transaction: string;
    cancel_time: number;
    state: PaymeTransactionState;
  };
}

export interface PaymeWebhookRequest {
  method: string;
  params: {
    id?: string;
    time?: number;
    amount?: number;
    account?: PaymeAccount;
    reason?: number;
    from?: number;
    to?: number;
    transaction?: string;
  };
  id: string;
  headers?: Record<string, string>;
}

export interface PaymeWebhookResponse {
  result?: {
    allow?: boolean;
    transaction?: string;
    create_time?: number;
    perform_time?: number;
    cancel_time?: number | null;
    state?: PaymeTransactionState;
    reason?: number | null;
    transactions?: PaymeTransactionResult[];
  };
  error?: {
    code: PaymeErrorCodes;
    message: string;
    data?: any;
  };
}

/**
 * Configuration for Payme provider
 * @property merchant_id - Merchant ID for payment URL generation
 * @property login - Merchant login (default: 'Paycom')
 * @property password - Merchant password (use test password for test mode)
 * @property test_mode - Enable test mode (default: true in development)
 * @property timeout - Request timeout in ms (default: 30000)
 * @property retries - Number of retries (default: 3)
 * @property retry_delay - Delay between retries in ms (default: 1000)
 */
export interface PaymeConfig {
  merchant_id?: string;
  login?: string;
  password?: string;
  test_mode?: boolean;
  timeout?: number;
  retries?: number;
  retry_delay?: number;
}

export interface PaymeOrder {
  id: string;
  amount: number;
  account: PaymeAccount;
  time: number;
}
