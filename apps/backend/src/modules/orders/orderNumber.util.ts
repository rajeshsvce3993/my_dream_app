import { randomBytes } from 'crypto';

/** Human-readable unique order id, e.g. ORD-20250915-8F3A2B1C */
export function generateOrderNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${d}-${suffix}`;
}
