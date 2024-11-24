import { PaymeProvider } from '../payme.provider';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymeProvider', () => {
  const config = {
    merchant_id: 'test_merchant',
    secret_key: 'test_secret',
    test_mode: true
  };

  const provider = new PaymeProvider(config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const order = {
      id: 'test_order_1',
      amount: { amount: 1000 },
      return_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel'
    };

    it('should generate payment URL successfully', async () => {
      const result = await provider.createPayment(order);
      expect(result.success).toBe(true);
      expect(result.payment_url).toBeDefined();
    });
  });

  describe('verifyPayment', () => {
    it('should verify completed payment successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          transaction_id: 'test_tx_1',
          state: 2,
          amount: 1000,
          paid_time: new Date().toISOString()
        }
      });

      const result = await provider.verifyPayment('test_tx_1');
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should handle failed verification', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.verifyPayment('test_tx_1');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYMENT_VERIFY_ERROR');
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          transaction_id: 'test_tx_1'
        }
      });

      const result = await provider.cancelPayment('test_tx_1');
      expect(result.success).toBe(true);
    });

    it('should handle cancellation failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.cancelPayment('test_tx_1');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYMENT_CANCEL_ERROR');
    });
  });
});
