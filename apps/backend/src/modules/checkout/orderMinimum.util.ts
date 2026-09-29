/** Compare money amounts in paise to avoid float/display rounding mismatches (e.g. 99.6 shown as ₹100). */
export function toOrderMoneyPaise(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function parseMinOrderValue(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function meetsMinimumOrderValue(orderTotal: number, minValue: unknown): boolean {
  const min = parseMinOrderValue(minValue, 0);
  if (min <= 0) return true;
  return toOrderMoneyPaise(orderTotal) >= toOrderMoneyPaise(min);
}
