import { BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { VendorProductModel } from '../products/vendorProduct.model.js';

export async function listVendorProducts(vendorId: string) {
  const rows = await VendorProductModel.find({ vendorId }).sort({ updatedAt: -1 }).limit(500).lean();
  const productIds = [...new Set(rows.map((r) => r.productId.toString()))];
  const variantIds = [...new Set(rows.map((r) => r.variantId.toString()))];
  const [products, variants] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }).lean(),
    ProductVariantModel.find({ _id: { $in: variantIds } }).lean(),
  ]);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  return rows.map((row) => {
    const product = productMap.get(row.productId.toString());
    const variant = variantMap.get(row.variantId.toString());
    return {
      id: row._id,
      productId: row.productId,
      variantId: row.variantId,
      name: product?.name?.en ?? 'Product',
      categoryId: product?.categoryId,
      imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
      variantName: variant?.name?.en,
      sellingPrice: row.sellingPrice,
      vendorPrice: row.vendorPrice,
      mrp: row.mrp,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    };
  });
}

export async function updateVendorProduct(
  vendorId: string,
  vendorProductId: string,
  patch: { sellingPrice?: number; isActive?: boolean },
) {
  if (patch.sellingPrice !== undefined) {
    if (!Number.isFinite(patch.sellingPrice) || patch.sellingPrice < 0) {
      throw new BusinessRuleError('Invalid price');
    }
  }

  const update: Record<string, unknown> = {};
  if (patch.sellingPrice !== undefined) {
    update.sellingPrice = patch.sellingPrice;
    update.vendorPrice = patch.sellingPrice;
  }
  if (patch.isActive !== undefined) update.isActive = patch.isActive;

  const row = await VendorProductModel.findOneAndUpdate(
    { _id: vendorProductId, vendorId },
    { $set: update },
    { new: true },
  ).lean();
  if (!row) throw new NotFoundError('Product not found');
  return row;
}
