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

## NestJS Integration

First, create a payment module:

```typescript
// payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
```

Create a payment service:

```typescript
// payment.service.ts
import { Injectable } from '@nestjs/common';
import { PaymeProvider, ClickProvider } from 'uzpayments-integration';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly paymeProvider: PaymeProvider;
  private readonly clickProvider: ClickProvider;

  constructor(private configService: ConfigService) {
    this.paymeProvider = new PaymeProvider({
      merchant_id: this.configService.get('PAYME_MERCHANT_ID'),
      secret_key: this.configService.get('PAYME_KEY'),
      test_mode: this.configService.get('NODE_ENV') !== 'production',
    });

    this.clickProvider = new ClickProvider({
      merchant_id: this.configService.get('CLICK_MERCHANT_ID'),
      service_id: this.configService.get('CLICK_SERVICE_ID'),
      secret_key: this.configService.get('CLICK_SECRET'),
      test_mode: this.configService.get('NODE_ENV') !== 'production',
    });
  }

  async createPaymePayment(orderId: string, amount: number) {
    return this.paymeProvider.createPayment({
      id: orderId,
      amount: { amount },
      return_url: 'https://your-site.com/success',
      cancel_url: 'https://your-site.com/cancel',
    });
  }

  async createClickPayment(orderId: string, amount: number) {
    return this.clickProvider.createPayment({
      id: orderId,
      amount: { amount },
      return_url: 'https://your-site.com/success',
    });
  }

  async verifyPayment(provider: 'payme' | 'click', transactionId: string) {
    if (provider === 'payme') {
      return this.paymeProvider.verifyPayment(transactionId);
    }
    return this.clickProvider.verifyPayment(transactionId);
  }
}
```

Create a payment controller:

```typescript
// payment.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payme/create')
  async createPaymePayment(@Body() data: { orderId: string; amount: number }) {
    const result = await this.paymentService.createPaymePayment(
      data.orderId,
      data.amount
    );
    return result;
  }

  @Post('click/create')
  async createClickPayment(@Body() data: { orderId: string; amount: number }) {
    const result = await this.paymentService.createClickPayment(
      data.orderId,
      data.amount
    );
    return result;
  }

  @Get(':provider/verify/:transactionId')
  async verifyPayment(
    @Param('provider') provider: 'payme' | 'click',
    @Param('transactionId') transactionId: string
  ) {
    return this.paymentService.verifyPayment(provider, transactionId);
  }

  // Webhook endpoints
  @Post('payme/webhook')
  async handlePaymeWebhook(@Body() payload: any) {
    // Handle Payme notification
    const { transaction_id, state } = payload;
    
    // Verify payment status
    const result = await this.paymentService.verifyPayment('payme', transaction_id);
    if (result.success) {
      // Update your order status in database
      // Send confirmation to customer
    }
    
    return { success: true };
  }

  @Post('click/webhook')
  async handleClickWebhook(@Body() payload: any) {
    // Handle Click notification
    const { transaction_id } = payload;
    
    // Verify payment status
    const result = await this.paymentService.verifyPayment('click', transaction_id);
    if (result.success) {
      // Update your order status in database
      // Send confirmation to customer
    }
    
    return { success: true };
  }
}
```

Usage in your application:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PaymentModule,
  ],
})
export class AppModule {}
```

Now you can use the payment service in your application:

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment/payment.service';

@Injectable()
export class OrderService {
  constructor(private readonly paymentService: PaymentService) {}

  async createOrder(userId: string, amount: number) {
    // Create order in database
    const orderId = 'ORDER_' + Date.now();

    // Create payment
    const paymentResult = await this.paymentService.createPaymePayment(
      orderId,
      amount
    );

    if (paymentResult.success) {
      // Redirect user to payment page
      return { redirectUrl: paymentResult.payment_url };
    }

    throw new Error('Payment creation failed');
  }
}
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
