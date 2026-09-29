import { randomUUID } from 'crypto';
import type { PaymentProvider, CreatePaymentIntentInput, PaymentIntentResult } from '../paymentProvider.interface.js';

export class CodPaymentProvider implements PaymentProvider {
  name = 'COD';

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      status: 'CAPTURED',
      providerReference: `cod_${input.orderId}_${randomUUID()}`,
    };
  }

  async verifyWebhook(): Promise<{ event: string; data: unknown }> {
    return { event: 'noop', data: {} };
  }
}
