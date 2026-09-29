import { PaymentError } from '../../common/errors/AppError.js';
import type { PaymentProvider } from './paymentProvider.interface.js';
import { CodPaymentProvider } from './providers/cod.provider.js';

const cod = new CodPaymentProvider();

export function getPaymentProvider(method: 'COD' | 'RAZORPAY' | 'STRIPE'): PaymentProvider {
  if (method === 'COD') return cod;
  throw new PaymentError(`Payment provider not configured: ${method}`);
}
