import { describe, expect, it } from 'vitest';
import { enrichVendorComparisonOffers } from '../src/modules/catalog/vendorComparisonPresentation.js';
import type { VendorOfferQuote } from '../src/modules/pricing/pricing.service.js';

describe('enrichVendorComparisonOffers', () => {
  it('uses product actual price for discount on each vendor row', () => {
    const vendors = enrichVendorComparisonOffers(100, [
      {
        vendorId: 'a',
        vendorName: 'A',
        variantId: 'v1',
        vendorPrice: 70,
        mrp: 90,
        sellingPrice: 80,
        discountAmount: 10,
        offerDiscount: 0,
        taxAmount: 0,
        finalUnitPrice: 84,
        availableQuantity: 5,
        rating: 4,
        score: 1,
      } as VendorOfferQuote,
    ]);
    expect(vendors[0]?.actualPrice).toBe(100);
    expect(vendors[0]?.discountPercent).toBe(16);
  });
});
