export interface PaymeTransactionResponse {
  success: boolean;
  transaction_id: string;
  state: number;  // -1: cancelled, 1: pending, 2: completed
  amount: number;
  paid_time?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaymeCancelResponse {
  success: boolean;
  transaction_id: string;
  error?: {
    code: string;
    message: string;
  };
}
