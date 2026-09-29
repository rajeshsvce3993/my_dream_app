import { describe, expect, it } from 'vitest';
import { computeCustomerUnitPrice } from '../src/modules/pricing/customerUnitPrice.js';

describe('computeCustomerUnitPrice', () => {
  it('rounds customer price to half rupee (no .1 / .7 display)', () => {
    const priced = computeCustomerUnitPrice({ sellingPrice: 42, taxRatePercent: 5 });
    expect(priced.finalUnitPrice).toBe(44);
    expect(priced.finalUnitPrice * 2).toBe(Math.round(priced.finalUnitPrice * 2));
  });

  it('matches catalog and vendor list when tax applies', () => {
    const a = computeCustomerUnitPrice({ sellingPrice: 99, taxRatePercent: 5 });
    const b = computeCustomerUnitPrice({ sellingPrice: 99, taxRatePercent: 5 });
    expect(a.finalUnitPrice).toBe(b.finalUnitPrice);
    expect(a.finalUnitPrice).toBe(104);
  });
});
