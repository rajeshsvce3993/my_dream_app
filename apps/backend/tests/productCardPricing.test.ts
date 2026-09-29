import { describe, expect, it } from 'vitest';
import {
  discountPercentFromMrp,
  pickCheapestQuoteForDisplay,
} from '../src/modules/catalog/productCardPricing.js';
import type { VendorOfferQuote } from '../src/modules/pricing/pricing.service.js';

function quote(partial: Partial<VendorOfferQuote> & { vendorId: string; finalUnitPrice: number }): VendorOfferQuote {
  return {
    vendorName: 'V',
    variantId: 'v1',
    vendorPrice: 90,
    mrp: 120,
    sellingPrice: 100,
    discountAmount: 20,
    offerDiscount: 0,
    taxAmount: 0,
    availableQuantity: 10,
    rating: 4,
    score: 1,
    ...partial,
  };
}

describe('productCardPricing', () => {
  it('computes discount from MRP vs final price only', () => {
    expect(discountPercentFromMrp(120, 96)).toBe(20);
    expect(discountPercentFromMrp(100, 100)).toBeUndefined();
  });

  it('picks cheapest final unit price for listing display', () => {
    const cheapest = pickCheapestQuoteForDisplay([
      quote({ vendorId: 'a', finalUnitPrice: 110, score: 2 }),
      quote({ vendorId: 'b', finalUnitPrice: 95, score: 1 }),
    ]);
    expect(cheapest?.vendorId).toBe('b');
  });
});
