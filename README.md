# @uzpayments/payment-integration

A flexible and robust payment integration package for Uzbekistan payment systems (Payme and Click).

## Features

- 🔒 Secure payment processing
- ⚡ TypeScript support
- 🔄 Automatic retries for failed requests
- ⏱️ Configurable timeouts
- 🛠️ Customizable error handling
- 🧪 Comprehensive test coverage

## Installation

```bash
npm install @uzpayments/payment-integration
```

## Usage

### Payme Integration

```typescript
import { PaymeProvider } from '@uzpayments/payment-integration';

// Initialize the provider
const paymeProvider = new PaymeProvider({
  merchant_id: 'your_merchant_id',
  secret_key: 'your_secret_key',
  test_mode: true, // false for production
  timeout: 30000,  // Optional: request timeout in ms (default: 30000)
  retries: 3,      // Optional: number of retries (default: 3)
  retry_delay: 1000 // Optional: delay between retries in ms (default: 1000)
});

// Create a payment
const createPayment = async () => {
  const result = await paymeProvider.createPayment({
    id: 'order_123',
    amount: { amount: 100000 }, // amount in UZS
    return_url: 'https://your-site.com/success',
    cancel_url: 'https://your-site.com/cancel'
  });

  if (result.success) {
    // Redirect user to payment page
    window.location.href = result.payment_url;
  }
};

// Verify payment status
const verifyPayment = async (transaction_id: string) => {
  const result = await paymeProvider.verifyPayment(transaction_id);
  
  if (result.success) {
    console.log('Payment status:', result.status);
    console.log('Paid amount:', result.paid_amount);
    console.log('Paid time:', result.paid_time);
  }
};

// Cancel payment
const cancelPayment = async (transaction_id: string) => {
  const result = await paymeProvider.cancelPayment(transaction_id);
  
  if (result.success) {
    console.log('Payment cancelled successfully');
  }
};
```

### Click Integration

```typescript
import { ClickProvider } from '@uzpayments/payment-integration';

// Initialize the provider
const clickProvider = new ClickProvider({
  merchant_id: 'your_merchant_id',
  service_id: 'your_service_id',
  secret_key: 'your_secret_key',
  test_mode: true, // false for production
  timeout: 30000,  // Optional: request timeout in ms
  retries: 3       // Optional: number of retries
});

// Create a payment
const createPayment = async () => {
  const result = await clickProvider.createPayment({
    id: 'order_123',
    amount: { amount: 100000 }, // amount in UZS
    return_url: 'https://your-site.com/success'
  });

  if (result.success) {
    window.location.href = result.payment_url;
  }
};
```

## Error Handling

The package includes comprehensive error handling:

```typescript
try {
  const result = await paymeProvider.verifyPayment('transaction_id');
  if (!result.success) {
    console.error('Error:', result.error?.code, result.error?.message);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

Error codes:
- `PAYMENT_CREATE_ERROR`: Error creating payment
- `PAYMENT_VERIFY_ERROR`: Error verifying payment
- `PAYMENT_CANCEL_ERROR`: Error cancelling payment
- `PAYMENT_TIMEOUT`: Request timeout

## Environment Variables

You can use environment variables for configuration:

```env
PAYME_MERCHANT_ID=your_merchant_id
PAYME_KEY=your_secret_key
CLICK_MERCHANT_ID=your_merchant_id
CLICK_SERVICE_ID=your_service_id
CLICK_SECRET=your_secret_key
NODE_ENV=development
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Format code
npm run format

# Lint code
npm run lint
```

## API Reference

### PaymeProvider

#### Methods

| Method | Description |
|--------|-------------|
| `createPayment(options)` | Creates a new payment transaction |
| `verifyPayment(transaction_id)` | Verifies the status of a payment |
| `cancelPayment(transaction_id)` | Cancels a pending payment |

#### Options

```typescript
interface PaymeOptions {
  merchant_id: string;
  secret_key: string;
  test_mode?: boolean;
  timeout?: number;
  retries?: number;
  retry_delay?: number;
}

interface CreatePaymentOptions {
  id: string;
  amount: { amount: number };
  return_url: string;
  cancel_url: string;
}
```

### ClickProvider

#### Methods

| Method | Description |
|--------|-------------|
| `createPayment(options)` | Creates a new payment transaction |
| `verifyPayment(transaction_id)` | Verifies the status of a payment |

#### Options

```typescript
interface ClickOptions {
  merchant_id: string;
  service_id: string;
  secret_key: string;
  test_mode?: boolean;
  timeout?: number;
  retries?: number;
}

interface CreatePaymentOptions {
  id: string;
  amount: { amount: number };
  return_url: string;
}
```

## Webhook Integration

To handle payment notifications, set up webhook endpoints in your NestJS application:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { PaymeProvider, ClickProvider } from '@uzpayments/payment-integration';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
  ) {}

  @Post('payme')
  async handlePaymeWebhook(@Body() payload: any) {
    // Verify webhook signature
    if (this.paymeProvider.verifyWebhook(payload)) {
      // Handle payment notification
      const { transaction_id, status } = payload;
      // Update your database
    }
  }

  @Post('click')
  async handleClickWebhook(@Body() payload: any) {
    // Verify webhook signature
    if (this.clickProvider.verifyWebhook(payload)) {
      // Handle payment notification
      const { transaction_id, status } = payload;
      // Update your database
    }
  }
}
```

## Common Issues and Solutions

### CORS Issues
If you're experiencing CORS issues, ensure your NestJS application has the proper CORS configuration:

```typescript
// main.ts
app.enableCors({
  origin: ['https://your-frontend-domain.com'],
  methods: ['GET', 'POST'],
  credentials: true,
});
```

### SSL Certificate Issues
When using test mode, you might encounter SSL certificate issues. Make sure to:
1. Use `https` in production
2. Set proper SSL certificates
3. Handle test mode certificates appropriately

### Rate Limiting
Both Payme and Click have rate limits. The package handles retries automatically, but you can configure:
```typescript
const provider = new PaymeProvider({
  // ... other options
  retries: 5,        // Increase retries
  retry_delay: 2000  // Increase delay between retries
});
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, please:
1. Check the [GitHub Issues](https://github.com/uzpayments/uzpayments-nest/issues)
2. Join our [Discord Community](https://discord.gg/uzpayments)
3. Email us at support@uzpayments.uz

## License

MIT
