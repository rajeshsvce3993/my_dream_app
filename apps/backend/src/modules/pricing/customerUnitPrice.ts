import { roundToPaisa } from '../../common/money.util.js';

export function computeCustomerUnitPrice(input: {
  sellingPrice: number;
  offerDiscount?: number;
  taxRatePercent?: number;
}): {
  unitBeforeTax: number;
  taxAmount: number;
  finalUnitPrice: number;
} {
  const offerDiscount = input.offerDiscount ?? 0;
  const taxRate = input.taxRatePercent ?? 0;
  const unitBeforeTax = roundToPaisa(Math.max(0, input.sellingPrice - offerDiscount));
  const taxAmount = roundToPaisa((unitBeforeTax * taxRate) / 100);
  const finalUnitPrice = roundToPaisa(unitBeforeTax + taxAmount);
  return { unitBeforeTax, taxAmount, finalUnitPrice };
}
