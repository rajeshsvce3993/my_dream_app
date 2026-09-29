import { roundToHalfRupee } from '../../common/money.util.js';

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
  const unitBeforeTax = roundToHalfRupee(Math.max(0, input.sellingPrice - offerDiscount));
  const taxAmount = roundToHalfRupee((unitBeforeTax * taxRate) / 100);
  const finalUnitPrice = roundToHalfRupee(unitBeforeTax + taxAmount);
  return { unitBeforeTax, taxAmount, finalUnitPrice };
}
