export interface ClickTransactionResponse {
  success: boolean;
  transaction_id: string;
  status: number;  // -1: cancelled, 0: pending, 1: completed
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
