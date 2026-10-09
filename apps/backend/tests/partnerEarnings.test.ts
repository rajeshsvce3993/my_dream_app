import { describe, expect, it } from 'vitest';
import { quotePartnerEarning, type PartnerEarnings } from '../src/modules/delivery/deliveryPartnerEarnings.service.js';

const charges: PartnerEarnings = {
  baseKm: 3,
  baseCharge: 25,
  perKmCharge: 8,
};

describe('delivery partner earnings', () => {
  it('pays the base amount through the base distance, then each extra kilometre', () => {
    expect(quotePartnerEarning(charges, 1.2)).toBe(25);
    expect(quotePartnerEarning(charges, 3)).toBe(25);
    expect(quotePartnerEarning(charges, 3.1)).toBe(33);
    expect(quotePartnerEarning(charges, 5)).toBe(41);
    expect(quotePartnerEarning(charges, null)).toBe(25);
  });
});
