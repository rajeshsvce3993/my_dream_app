import { describe, expect, it } from 'vitest';
import { computeCustomerUnitPrice } from '../src/modules/pricing/customerUnitPrice.js';

describe('computeCustomerUnitPrice', () => {
  it('charges 5% of 120 as 6, not 6.50', () => {
    const priced = computeCustomerUnitPrice({ sellingPrice: 120, taxRatePercent: 5 });
    expect(priced.taxAmount).toBe(6);
    expect(priced.finalUnitPrice).toBe(126);
  });

  it('keeps paisa so split item taxes still add up to 5% of the bill', () => {
    const a = computeCustomerUnitPrice({ sellingPrice: 45, taxRatePercent: 5 });
    const b = computeCustomerUnitPrice({ sellingPrice: 75, taxRatePercent: 5 });
    expect(a.taxAmount + b.taxAmount).toBe(6);
  });
});
