export interface PaymentConfig {
  merchant_id: string;
  service_id?: string;
  secret_key: string;
  test_mode?: boolean;
  timeout?: number;  // Request timeout in milliseconds
  retries?: number;  // Number of retries for failed requests
  retry_delay?: number;  // Delay between retries in milliseconds
}

export interface PaymentAmount {
  amount: number;
  currency?: string;
}

export interface PaymentOrder {
  id: string;
  amount: PaymentAmount;
  description?: string;
  return_url?: string;
  cancel_url?: string;
  extra_params?: Record<string, string>; 
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  payment_url?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaymentVerifyResult extends PaymentResult {
  status?: 'pending' | 'completed' | 'cancelled' | 'failed';
  paid_amount?: number;
  paid_time?: Date;
}

export interface PaymentProvider {
  createPayment(order: PaymentOrder): Promise<PaymentResult>;
  verifyPayment(transaction_id: string): Promise<PaymentVerifyResult>;
  cancelPayment(transaction_id: string): Promise<PaymentResult>;
  generatePaymentUrl(order: PaymentOrder): string; 
}
