import { z } from 'zod';
import { getConfigValue } from '../configuration/configuration.service.js';
import { CategoryModel } from '../categories/category.model.js';
import { ProductModel } from '../products/product.model.js';

export const FOOD_CHARGES_KEY = 'food.charges';

export type FoodCharges = {
  /** Distance covered by the base delivery charge. Example: 3 means 0–3 km. */
  baseKm: number;
  baseDeliveryCharge: number;
  /** Charged for each kilometre beyond baseKm. A fraction of a kilometre counts as one. */
  perKmCharge: number;
  /** Flat amount added once on a food order. */
  platformFee: number;
  gstEnabled: boolean;
  gstPercent: number;
};

const foodChargesSchema = z.object({
  baseKm: z.coerce.number().min(0).max(100),
  baseDeliveryCharge: z.coerce.number().min(0).max(10000),
  perKmCharge: z.coerce.number().min(0).max(1000),
  platformFee: z.coerce.number().min(0).max(10000),
  gstEnabled: z.boolean(),
  gstPercent: z.coerce.number().min(0).max(100),
});

export function parseFoodCharges(value: unknown): FoodCharges {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const parsed = foodChargesSchema.parse({
    baseKm: raw.baseKm ?? 3,
    baseDeliveryCharge: raw.baseDeliveryCharge ?? raw.deliveryCharge ?? 0,
    perKmCharge: raw.perKmCharge ?? 0,
    platformFee: raw.platformFee ?? 0,
    gstEnabled: raw.gstEnabled ?? false,
    gstPercent: raw.gstPercent ?? 5,
  });
  return parsed;
}

export function isFoodCategorySlug(slug?: string | null): boolean {
  if (!slug) return false;
  const value = slug.trim().toLowerCase();
  return value === 'food' || value.startsWith('food-');
}

/**
 * Food delivery charge from restaurant to customer.
 * Distance within baseKm pays only the base charge. Each started kilometre after that adds perKmCharge.
 * Missing distance uses the base charge.
 */
export function quoteFoodDeliveryCharge(
  charges: FoodCharges,
  distanceKm: number | null | undefined,
): number {
  const base = Math.max(0, charges.baseDeliveryCharge);
  const perKm = Math.max(0, charges.perKmCharge);
  const baseKm = Math.max(0, charges.baseKm);
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= baseKm) return base;
  const extraKm = Math.ceil(distanceKm - baseKm - 1e-6);
  return base + extraKm * perKm;
}

/** Distance delivery charge plus the admin platform fee, once per restaurant quote. */
export function quoteCustomerFoodDeliveryCharge(
  charges: FoodCharges,
  distanceKm: number | null | undefined,
): number {
  return quoteFoodDeliveryCharge(charges, distanceKm) + Math.max(0, charges.platformFee);
}

export function foodGstPercent(charges: FoodCharges): number {
  if (!charges.gstEnabled) return 0;
  return charges.gstPercent;
}

/** GST added on a restaurant’s food prices. Off means the menu price already includes tax. */
export function vendorMenuGstPercent(vendor: { gstEnabled?: boolean; gstPercent?: number } | null | undefined): number {
  if (!vendor?.gstEnabled) return 0;
  const rate = Number(vendor.gstPercent);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.min(100, rate);
}

export async function getFoodCharges(): Promise<FoodCharges> {
  const saved = await getConfigValue<unknown>(FOOD_CHARGES_KEY, null);
  if (saved && typeof saved === 'object') {
    try {
      return parseFoodCharges(saved);
    } catch {
      // Invalid saved values fall back to the defaults below.
    }
  }
  return {
    baseKm: 3,
    baseDeliveryCharge: 0,
    perKmCharge: 0,
    platformFee: 0,
    gstEnabled: false,
    gstPercent: 5,
  };
}

/** Product ids whose category, subcategory, or parent category is the food catalog. */
export async function foodProductIdSet(productIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  const out = new Set<string>();
  if (!unique.length) return out;

  const products = await ProductModel.find({ _id: { $in: unique } })
    .select('categoryId subcategoryId')
    .lean();
  const categoryIds = [
    ...new Set(
      products.flatMap((product) =>
        [product.categoryId, product.subcategoryId].filter(Boolean).map((id) => id!.toString()),
      ),
    ),
  ];
  if (!categoryIds.length) return out;

  const categories = await CategoryModel.find({ _id: { $in: categoryIds } })
    .select('slug parentId')
    .lean();
  const parentIds = categories.map((category) => category.parentId?.toString()).filter(Boolean) as string[];
  const parents = parentIds.length
    ? await CategoryModel.find({ _id: { $in: parentIds } }).select('slug').lean()
    : [];
  const parentSlug = new Map(parents.map((parent) => [parent._id.toString(), parent.slug]));
  const foodCategoryIds = new Set(
    categories
      .filter(
        (category) =>
          isFoodCategorySlug(category.slug) ||
          isFoodCategorySlug(parentSlug.get(category.parentId?.toString() ?? '')),
      )
      .map((category) => category._id.toString()),
  );

  for (const product of products) {
    const ids = [product.categoryId, product.subcategoryId].filter(Boolean).map((id) => id!.toString());
    if (ids.some((id) => foodCategoryIds.has(id))) out.add(product._id.toString());
  }
  return out;
}
