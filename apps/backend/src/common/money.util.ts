/** Customer-facing amounts: whole rupees or 50 paise steps (₹1, ₹0.50). */
export function roundToHalfRupee(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 2) / 2;
}

/** Normalize catalog / seed prices to ₹ whole or .50. */
export function normalizeSeedPrice(amount: number): number {
  return roundToHalfRupee(Math.max(0, amount));
}
