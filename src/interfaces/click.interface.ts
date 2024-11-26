export interface ClickTransactionResponse {
  success: boolean;
  transaction_id: string;
  status: -1 | 0 | 1;  // -1: cancelled, 0: pending, 1: completed
  amount: number;
  payment_time?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface ClickCancelResponse {
  success: boolean;
  transaction_id: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface ClickWebhookRequest {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  amount: number;
  action: 0 | 1;  // 0: Prepare, 1: Complete
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
  merchant_prepare_id?: string;
}

export interface ClickWebhookResponse {
  click_trans_id: number;
  merchant_trans_id: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

export enum ClickErrorCodes {
  Success = 0,
  SignatureFailure = -1,
  InvalidAmount = -2,
  AlreadyPaid = -4,
  UserNotFound = -5,
  TransactionNotFound = -6,
  BadRequest = -8,
  TransactionCancelled = -9
}

export interface ClickConfig {
  merchant_id: string;
  service_id: string;
  secret_key: string;
  return_url?: string;
  test_mode?: boolean;
  timeout?: number;
  retries?: number;
  retry_delay?: number;
}