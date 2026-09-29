import { VendorProductModel } from './vendorProduct.model.js';
import { ProductVariantModel } from './productVariant.model.js';
import { normalizeSeedPrice } from '../../common/money.util.js';

/** Product/variant reference MRP (actual price) — one per SKU, not per vendor. */
export async function getVariantListPrice(variantId: string): Promise<number | undefined> {
  const variant = await ProductVariantModel.findById(variantId).select('listPrice').lean();
  if (variant?.listPrice != null && variant.listPrice > 0) {
    return variant.listPrice;
  }
  const mappings = await VendorProductModel.find({ variantId, isActive: true }).select('mrp').lean();
  if (!mappings.length) return undefined;
  return normalizeSeedPrice(Math.max(...mappings.map((m) => m.mrp)));
}

export async function syncVariantListPriceFromVendors(variantId: string): Promise<number | undefined> {
  const listPrice = await getVariantListPrice(variantId);
  if (listPrice == null) return undefined;
  await ProductVariantModel.updateOne({ _id: variantId }, { listPrice });
  return listPrice;
}
