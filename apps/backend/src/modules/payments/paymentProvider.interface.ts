import type { PaymentStatus } from './payment.model.js';

export interface CreatePaymentIntentInput {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
}

export interface PaymentIntentResult {
  status: PaymentStatus;
  providerReference: string;
  clientSecret?: string;
  redirectUrl?: string;
}

export interface PaymentProvider {
  name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(payload: unknown, signature: string): Promise<{ event: string; data: unknown }>;
}
