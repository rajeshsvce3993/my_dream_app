import type { VendorOfferQuote } from '../pricing/pricing.service.js';

/** Discount vs product actual (list) price — not vendor-specific MRP. */
export function discountPercentFromMrp(mrp: number, finalUnitPrice: number): number | undefined {
  if (mrp <= 0 || finalUnitPrice >= mrp) return undefined;
  return Math.round(((mrp - finalUnitPrice) / mrp) * 100);
}

export const discountPercentFromActualPrice = discountPercentFromMrp;

/** Listing/home cards show the lowest deliverable price at the customer location. */
export function pickCheapestQuoteForDisplay(vendors: VendorOfferQuote[]): VendorOfferQuote | undefined {
  if (!vendors.length) return undefined;
  return [...vendors].sort((a, b) => a.finalUnitPrice - b.finalUnitPrice)[0];
}

export type ProductCardPriceFields = {
  mrp: number;
  sellingPrice: number;
  finalUnitPrice: number;
  displayPrice: number;
  /** Reference list MRP when distinct from quoted vendor MRP. */
  actualPrice?: number;
  discountPercent?: number;
};

export function productCardPriceFromQuote(
  quote: VendorOfferQuote,
  actualPrice?: number,
): ProductCardPriceFields {
  const reference = actualPrice ?? quote.mrp;
  const discountPercent = discountPercentFromMrp(reference, quote.finalUnitPrice);
  return {
    mrp: reference,
    sellingPrice: quote.sellingPrice,
    finalUnitPrice: quote.finalUnitPrice,
    displayPrice: quote.finalUnitPrice,
    actualPrice: actualPrice ?? undefined,
    discountPercent,
  };
}
