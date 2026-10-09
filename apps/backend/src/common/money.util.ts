/** Customer-facing amounts: whole rupees or 50 paise steps (₹1, ₹0.50). */
export function roundToHalfRupee(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 2) / 2;
}

/** GST and bill lines: nearest paisa, so 5% of ₹120 is ₹6.00. */
export function roundToPaisa(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/** Vendor sales are the pre-GST item total. Earnings are that amount after the service charge. */
export function vendorEarningsFromItemTotal(itemTotal: number, commissionRate: number) {
  const sales = roundToPaisa(Math.max(0, itemTotal));
  const serviceCharge = roundToPaisa((sales * Math.max(0, commissionRate || 0)) / 100);
  return {
    sales,
    serviceCharge,
    earnings: roundToPaisa(Math.max(0, sales - serviceCharge)),
  };
}

/** Normalize catalog / seed prices to ₹ whole or .50. */
export function normalizeSeedPrice(amount: number): number {
  return roundToHalfRupee(Math.max(0, amount));
}
