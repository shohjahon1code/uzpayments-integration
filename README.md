# UzPayments Integration

A comprehensive payment integration package for Uzbekistan payment providers (Payme and Click) built for NestJS/Express applications.

[![npm version](https://badge.fury.io/js/uzpayments.svg)](https://badge.fury.io/js/uzpayments)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🏦 Support for major Uzbekistan payment providers:
  - Payme
  - Click
- ⚡ Easy to integrate with NestJS/Express
- 🔒 Secure payment processing with signature verification
- 🧪 Test mode support
- 📝 TypeScript support with comprehensive types
- 🛠️ Comprehensive error handling
- 🔄 Webhook support with prepare/complete flow

## Installation

```bash
npm install uzpayments
# or
yarn add uzpayments
```

## Environment Variables

```env
# Click Configuration
CLICK_MERCHANT_ID=your_merchant_id
CLICK_SERVICE_ID=your_service_id
CLICK_SECRET=your_secret_key

# Payme Configuration
PAYME_MERCHANT_ID=your_merchant_id
PAYME_LOGIN=Paycom
PAYME_PASSWORD=your_production_password
PAYME_PASSWORD_TEST=your_test_password

# Common
NODE_ENV=development|production
```

## Basic Usage

```typescript
import { PaymeProvider, ClickProvider } from 'uzpayments';
import { HttpClient } from 'uzpayments/utils';

// Initialize providers
const httpClient = new HttpClient();

const clickProvider = new ClickProvider(httpClient, {
  merchant_id: process.env.CLICK_MERCHANT_ID,
  service_id: process.env.CLICK_SERVICE_ID,
  secret_key: process.env.CLICK_SECRET,
  test_mode: true // Use test environment
});

const paymeProvider = new PaymeProvider(httpClient, {
  merchant_id: process.env.PAYME_MERCHANT_ID,
  password: process.env.PAYME_PASSWORD,
  test_mode: true
});

// Create payment order
const order = {
  id: 'order_123',
  amount: {
    amount: 100000, // Amount in UZS
    currency: 'UZS'
  },
  description: 'Payment for Order #123',
  return_url: 'https://your-site.com/payment/success',
  extra_params: {
    user_id: 'user_123'
  }
};

// Generate payment URLs
const clickUrl = clickProvider.generatePaymentUrl(order);
const paymeUrl = paymeProvider.generatePaymentUrl(order);

// Verify payments
const clickResult = await clickProvider.verifyPayment('transaction_id');
const paymeResult = await paymeProvider.verifyPayment('transaction_id');
```

## Webhook Integration

### Click Webhooks

Click uses a prepare/complete flow for payment processing:

```typescript
app.post('/webhooks/click', async (req, res) => {
  const result = await clickProvider.handleWebhook(req.body);
  
  // Webhook will receive two types of requests:
  // 1. Prepare (action = 0): Initial payment validation
  // 2. Complete (action = 1): Payment completion
  
  // Result includes:
  // - click_trans_id: Click transaction ID
  // - merchant_trans_id: Your order ID
  // - merchant_prepare_id: Prepare request ID (for action = 0)
  // - merchant_confirm_id: Confirm request ID (for action = 1)
  // - error: Error code (0 for success)
  // - error_note: Error message
  
  res.json(result);
});
```

Click webhook request format:
```typescript
interface ClickWebhookRequest {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  amount: string;
  action: number;  // 0: prepare, 1: complete
  sign_time: string;
  sign_string: string;
  error?: number;
  error_note?: string;
}
```

### Payme Webhooks

Payme uses a JSON-RPC style API for webhooks:

```typescript
app.post('/webhooks/payme', async (req, res) => {
  const result = await paymeProvider.handleWebhook(req.body);
  
  // Webhook handles multiple methods:
  // - CheckPerformTransaction: Validate payment
  // - CreateTransaction: Create payment
  // - PerformTransaction: Complete payment
  // - CancelTransaction: Cancel payment
  // - CheckTransaction: Check status
  // - GetStatement: Get transactions list
  
  res.json(result);
});
```

## Error Handling

Both providers use comprehensive error codes:

### Click Error Codes
```typescript
enum ClickErrorCodes {
  Success = 0,
  SignatureFailure = -1,
  InvalidAmount = -2,
  ActionNotFound = -3,
  AlreadyPaid = -4,
  UserNotFound = -5,
  TransactionNotFound = -6,
  BadRequest = -8,
  TransactionCanceled = -9
}
```

### Payme Error Codes
```typescript
enum PaymeErrorCodes {
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
```

## Testing

Both providers support test environments:

### Click Test Environment
- Test URL: https://test.click.uz
- Use test credentials provided by Click
- Set `test_mode: true` in provider config

### Payme Test Environment
- Test URL: https://test.paycom.uz
- Use test password from your merchant cabinet
- Set `test_mode: true` in provider config

## Security Considerations

1. **Signature Verification**
   - Both providers implement signature verification for webhooks
   - Click uses MD5 hash with secret key
   - Payme uses Basic Auth with merchant credentials

2. **Environment Variables**
   - Never expose credentials in code
   - Use different credentials for test/production
   - Store sensitive data in secure environment variables

3. **HTTPS**
   - Always use HTTPS in production
   - Both providers require HTTPS for webhooks
   - Verify SSL certificates in production

4. **Error Handling**
   - Implement proper error logging
   - Never expose internal errors to clients
   - Handle timeout and network errors gracefully

5. **Amount Validation**
   - Validate payment amounts
   - Click uses UZS directly
   - Payme requires conversion to tiyin (UZS * 100)

## NestJS Integration Guide

### 1. Create Payment Module

```typescript
// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { HttpClient } from 'uzpayments/utils';
import { PaymeProvider, ClickProvider } from 'uzpayments';

@Module({
  providers: [
    PaymentService,
    {
      provide: HttpClient,
      useValue: new HttpClient(),
    },
    {
      provide: PaymeProvider,
      useFactory: (httpClient: HttpClient) => {
        return new PaymeProvider(httpClient, {
          merchant_id: process.env.PAYME_MERCHANT_ID,
          password: process.env.PAYME_PASSWORD,
          test_mode: process.env.NODE_ENV !== 'production',
        });
      },
      inject: [HttpClient],
    },
    {
      provide: ClickProvider,
      useFactory: (httpClient: HttpClient) => {
        return new ClickProvider(httpClient, {
          merchant_id: process.env.CLICK_MERCHANT_ID,
          service_id: process.env.CLICK_SERVICE_ID,
          secret_key: process.env.CLICK_SECRET,
          test_mode: process.env.NODE_ENV !== 'production',
        });
      },
      inject: [HttpClient],
    },
  ],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
```

### 2. Create Payment Service

```typescript
// src/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import { PaymeProvider, ClickProvider } from 'uzpayments';
import { 
  PaymentOrder, 
  PaymentResult, 
  PaymentVerifyResult 
} from 'uzpayments/interfaces';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
  ) {}

  async createPayment(
    provider: 'payme' | 'click',
    order: PaymentOrder,
  ): Promise<PaymentResult> {
    const paymentProvider = 
      provider === 'payme' ? this.paymeProvider : this.clickProvider;
    
    try {
      const result = await paymentProvider.createPayment(order);
      return result;
    } catch (error) {
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  async verifyPayment(
    provider: 'payme' | 'click',
    transactionId: string,
  ): Promise<PaymentVerifyResult> {
    const paymentProvider = 
      provider === 'payme' ? this.paymeProvider : this.clickProvider;
    
    try {
      const result = await paymentProvider.verifyPayment(transactionId);
      return result;
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  async cancelPayment(
    provider: 'payme' | 'click',
    transactionId: string,
  ): Promise<PaymentResult> {
    const paymentProvider = 
      provider === 'payme' ? this.paymeProvider : this.clickProvider;
    
    try {
      const result = await paymentProvider.cancelPayment(transactionId);
      return result;
    } catch (error) {
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  generatePaymentUrl(
    provider: 'payme' | 'click',
    order: PaymentOrder,
  ): string {
    const paymentProvider = 
      provider === 'payme' ? this.paymeProvider : this.clickProvider;
    return paymentProvider.generatePaymentUrl(order);
  }
}
```

### 3. Create Payment Controller

```typescript
// src/payment/payment.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymeProvider, ClickProvider } from 'uzpayments';
import { PaymentOrder } from 'uzpayments/interfaces';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
  ) {}

  @Post(':provider/create')
  async createPayment(
    @Param('provider') provider: 'payme' | 'click',
    @Body() order: PaymentOrder,
  ) {
    try {
      const result = await this.paymentService.createPayment(provider, order);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':provider/verify/:transactionId')
  async verifyPayment(
    @Param('provider') provider: 'payme' | 'click',
    @Param('transactionId') transactionId: string,
  ) {
    try {
      const result = await this.paymentService.verifyPayment(
        provider,
        transactionId,
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('payme/webhook')
  async paymeWebhook(@Body() request: any) {
    try {
      const result = await this.paymeProvider.handleWebhook(request);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('click/webhook')
  async clickWebhook(@Body() request: any) {
    try {
      const result = await this.clickProvider.handleWebhook(request);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':provider/payment-url')
  generatePaymentUrl(
    @Param('provider') provider: 'payme' | 'click',
    @Query() order: PaymentOrder,
  ) {
    try {
      const paymentUrl = this.paymentService.generatePaymentUrl(provider, order);
      return { payment_url: paymentUrl };
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

### 4. Create DTOs (Optional but Recommended)

```typescript
// src/payment/dto/create-payment.dto.ts
import { IsString, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AmountDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;
}

export class CreatePaymentDto {
  @IsString()
  id: string;

  @ValidateNested()
  @Type(() => AmountDto)
  amount: AmountDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  return_url?: string;

  @IsOptional()
  extra_params?: Record<string, any>;
}
```

### 5. Usage in Your Application

```typescript
// src/app.module.ts
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

### 6. Example Usage in Another Service

```typescript
// src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrdersService {
  constructor(private readonly paymentService: PaymentService) {}

  async createOrderWithPayment(orderData: any) {
    // Create order in your database
    const order = await this.createOrder(orderData);

    // Create payment
    const paymentOrder = {
      id: order.id,
      amount: {
        amount: order.total,
        currency: 'UZS',
      },
      description: `Payment for Order #${order.id}`,
      return_url: `https://your-site.com/orders/${order.id}/success`,
      extra_params: {
        user_id: order.userId,
      },
    };

    // Generate payment URL
    const paymentUrl = this.paymentService.generatePaymentUrl(
      'payme',
      paymentOrder,
    );

    return {
      order,
      payment_url: paymentUrl,
    };
  }

  async handlePaymentWebhook(provider: 'payme' | 'click', webhookData: any) {
    // Verify payment
    const paymentResult = await this.paymentService.verifyPayment(
      provider,
      webhookData.transaction_id,
    );

    if (paymentResult.success && paymentResult.status === 'completed') {
      // Update order status in your database
      await this.updateOrderStatus(paymentResult.transaction_id, 'paid');
    }

    return paymentResult;
  }
}
```

### 7. API Endpoints

After setting up the payment module, you'll have the following endpoints available:

```
POST /payments/:provider/create
- Create a new payment
- Providers: 'payme' or 'click'
- Body: PaymentOrder object

GET /payments/:provider/verify/:transactionId
- Verify payment status
- Providers: 'payme' or 'click'

POST /payments/payme/webhook
- Handle Payme webhook callbacks

POST /payments/click/webhook
- Handle Click webhook callbacks

GET /payments/:provider/payment-url
- Generate payment URL
- Providers: 'payme' or 'click'
- Query params: PaymentOrder object
```

## Quick Start

### 1. Configure Environment Variables

```env
# Payme Configuration
PAYME_MERCHANT_ID=your_merchant_id
PAYME_LOGIN=Paycom
PAYME_PASSWORD=your_production_password
PAYME_PASSWORD_TEST=your_test_password

# Click Configuration
CLICK_MERCHANT_ID=your_merchant_id
CLICK_SERVICE_ID=your_service_id
CLICK_SECRET_KEY=your_secret_key

# Common
NODE_ENV=development|production
```

### 2. Basic Usage

```typescript
import { PaymeProvider, ClickProvider } from 'uzpayments';
import { HttpClient } from 'uzpayments/utils';

// Initialize providers
const httpClient = new HttpClient();

const paymeProvider = new PaymeProvider(httpClient, {
  merchant_id: process.env.PAYME_MERCHANT_ID,
  password: process.env.PAYME_PASSWORD,
  test_mode: true // Use test environment
});

const clickProvider = new ClickProvider(httpClient, {
  merchant_id: process.env.CLICK_MERCHANT_ID,
  service_id: process.env.CLICK_SERVICE_ID,
  secret_key: process.env.CLICK_SECRET_KEY,
  test_mode: true
});

// Create payment order
const order = {
  id: 'order_123',
  amount: {
    amount: 100000, // Amount in UZS
    currency: 'UZS'
  },
  description: 'Payment for Order #123',
  return_url: 'https://your-site.com/payment/success',
  extra_params: {
    user_id: 'user_123'
  }
};

// Generate payment URLs
const paymeUrl = paymeProvider.generatePaymentUrl(order);
const clickUrl = clickProvider.generatePaymentUrl(order);

// Verify payments
const paymeResult = await paymeProvider.verifyPayment('transaction_id');
const clickResult = await clickProvider.verifyPayment('transaction_id');
```

### 3. Webhook Handling

```typescript
// Payme Webhook
app.post('/webhooks/payme', async (req, res) => {
  const result = await paymeProvider.handleWebhook(req.body);
  res.json(result);
});

// Click Webhook
app.post('/webhooks/click', async (req, res) => {
  const result = await clickProvider.handleWebhook(req.body);
  res.json(result);
});
```

## API Reference

### PaymeProvider

#### Configuration

```typescript
interface PaymeConfig {
  merchant_id?: string;      // Merchant ID for payment URL generation
  login?: string;           // Merchant login (default: 'Paycom')
  password?: string;        // Merchant password
  test_mode?: boolean;      // Enable test mode
  timeout?: number;         // Request timeout in ms (default: 30000)
  retries?: number;         // Number of retries (default: 3)
  retry_delay?: number;     // Delay between retries in ms (default: 1000)
}
```

#### Methods

- `generatePaymentUrl(order: PaymentOrder): string`
- `createPayment(order: PaymentOrder): Promise<PaymentResult>`
- `verifyPayment(transaction_id: string): Promise<PaymentVerifyResult>`
- `cancelPayment(transaction_id: string): Promise<PaymentResult>`
- `handleWebhook(request: PaymeWebhookRequest): Promise<PaymeWebhookResponse>`

### ClickProvider

#### Configuration

```typescript
interface ClickConfig {
  merchant_id?: string;     // Merchant ID
  service_id?: string;      // Service ID
  secret_key?: string;      // Secret key
  test_mode?: boolean;      // Enable test mode
  timeout?: number;         // Request timeout in ms (default: 30000)
  retries?: number;         // Number of retries (default: 3)
  retry_delay?: number;     // Delay between retries in ms (default: 1000)
}
```

#### Methods

- `generatePaymentUrl(order: PaymentOrder): string`
- `createPayment(order: PaymentOrder): Promise<PaymentResult>`
- `verifyPayment(transaction_id: string): Promise<PaymentVerifyResult>`
- `cancelPayment(transaction_id: string): Promise<PaymentResult>`
- `handleWebhook(request: ClickWebhookRequest): Promise<ClickWebhookResponse>`

## Common Types

### PaymentOrder

```typescript
interface PaymentOrder {
  id: string;               // Order ID
  amount: {
    amount: number;         // Amount in UZS
    currency: string;       // Currency code (e.g., 'UZS')
  };
  description?: string;     // Order description
  return_url?: string;      // Return URL after payment
  extra_params?: Record<string, any>; // Additional parameters
}
```

### PaymentResult

```typescript
interface PaymentResult {
  success: boolean;
  payment_url?: string;     // Payment URL for redirect
  transaction_id?: string;  // Provider's transaction ID
  error?: {
    code: string;
    message: string;
  };
}
```

### PaymentVerifyResult

```typescript
interface PaymentVerifyResult {
  success: boolean;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  paid_amount?: number;
  paid_time?: Date;
  error?: {
    code: string;
    message: string;
  };
}
```

## Error Handling

The package provides detailed error information through the `error` field in responses:

```typescript
{
  success: false,
  error: {
    code: 'PAYMENT_CREATE_ERROR',
    message: 'Failed to create payment: Invalid amount'
  }
}
```

Common error codes:
- `PAYMENT_CREATE_ERROR`: Error creating payment
- `PAYMENT_VERIFY_ERROR`: Error verifying payment
- `PAYMENT_CANCEL_ERROR`: Error cancelling payment
- `PAYMENT_TIMEOUT`: Request timeout
- `INVALID_AMOUNT`: Invalid payment amount
- `INVALID_CURRENCY`: Invalid currency
- `INVALID_SIGNATURE`: Invalid webhook signature

## Testing

The package supports test mode for both providers. Enable it by:
1. Setting `test_mode: true` in provider configuration
2. Using test credentials in environment variables
3. Setting `NODE_ENV` to 'development'

```typescript
const provider = new PaymeProvider(httpClient, {
  merchant_id: 'test_merchant_id',
  password: 'test_password',
  test_mode: true
});
```

## Security Considerations

1. Never expose your credentials in client-side code
2. Always verify webhook signatures
3. Use environment variables for sensitive data
4. Implement proper error handling
5. Use HTTPS for all API calls
6. Keep your dependencies up to date

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please [open an issue](https://github.com/yourusername/uzpayments/issues) or contact our support team.
