/** Matches backend product card pricing (MRP vs final unit price). */
export type ProductPriceLike = {
  displayPrice?: number;
  finalUnitPrice?: number;
  sellingPrice?: number;
  /** Product reference MRP (actual price). */
  actualPrice?: number;
  mrp?: number;
  discountPercent?: number;
};

export function resolveProductDisplayPrice(product: ProductPriceLike): number | undefined {
  return product.displayPrice ?? product.finalUnitPrice ?? product.sellingPrice ?? product.mrp;
}

export function resolveProductMrpForStrike(product: ProductPriceLike, displayPrice?: number): number | undefined {
  const price = displayPrice ?? resolveProductDisplayPrice(product);
  const mrp = product.actualPrice ?? product.mrp ?? product.sellingPrice;
  if (mrp == null || price == null) return undefined;
  return mrp > price ? mrp : undefined;
}
