import { discountPercentFromMrp } from './productCardPricing.js';
import type { VendorOfferQuote } from '../pricing/pricing.service.js';

export type VendorComparisonOffer = VendorOfferQuote & {
  actualPrice: number;
  displayPrice: number;
  discountPercent?: number;
};

export function enrichVendorComparisonOffers(
  actualPrice: number,
  vendors: VendorOfferQuote[],
): VendorComparisonOffer[] {
  return vendors.map((v) => ({
    ...v,
    actualPrice,
    displayPrice: v.finalUnitPrice,
    discountPercent: discountPercentFromMrp(actualPrice, v.finalUnitPrice),
  }));
}
