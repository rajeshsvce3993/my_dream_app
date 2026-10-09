import { BusinessRuleError } from '../../common/errors/AppError.js';
import {
  getDeliveryServiceAreas,
  isPointInsideLaunchArea,
} from '../delivery/deliveryServiceAreas.service.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { VendorProductModel } from '../products/vendorProduct.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { productMatchesDietFilter, vendorMatchesDietFilter } from './diet.util.js';
import type { HomeTopPick } from './homeTopPicks.types.js';

type MenuDish = {
  name?: { en?: string; ta?: string };
  searchKeywords?: string[];
  brand?: string;
  sku?: string;
  dietType?: string | null;
  vendorDiet?: string | null;
};

/** Same word match the customer dish search uses: every word of length 2+ must appear. */
export function dishMatchesTopPick(
  pick: Pick<HomeTopPick, 'searchQuery' | 'diet'>,
  dish: MenuDish,
): boolean {
  const terms = pick.searchQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  if (!terms.length) return false;
  const haystack = [dish.name?.en, dish.name?.ta, dish.brand, dish.sku, ...(dish.searchKeywords ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!terms.every((term) => haystack.includes(term))) return false;
  if (pick.diet === 'veg' || pick.diet === 'nonveg') {
    if (!productMatchesDietFilter(dish.dietType, pick.diet, dish.name?.en)) return false;
    if (!vendorMatchesDietFilter(dish.vendorDiet, pick.diet)) return false;
  }
  return true;
}

async function menuDishesInsideServiceAreas(): Promise<MenuDish[]> {
  const areas = await getDeliveryServiceAreas();
  const vendors = await VendorModel.find({
    status: 'ACTIVE',
    onboardingComplete: { $ne: false },
  })
    .select('location dietType')
    .lean();
  const inArea = vendors.filter((vendor) => {
    const [lng, lat] = vendor.location?.coordinates ?? [];
    if (lng === undefined || lat === undefined) return false;
    if (!areas.length) return true;
    return areas.some((area) => isPointInsideLaunchArea(lng, lat, area));
  });
  if (!inArea.length) return [];

  const listings = await VendorProductModel.find({
    vendorId: { $in: inArea.map((vendor) => vendor._id) },
    isActive: true,
  })
    .select('vendorId productId')
    .lean();
  if (!listings.length) return [];

  const productIds = [...new Set(listings.map((row) => row.productId.toString()))];
  const [products, variants] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds }, status: 'ACTIVE' })
      .select('name searchKeywords brand sku dietType')
      .lean(),
    ProductVariantModel.find({ productId: { $in: productIds }, status: 'ACTIVE' })
      .select('productId')
      .lean(),
  ]);
  const sellable = new Set(variants.map((variant) => variant.productId.toString()));
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const dietByVendor = new Map(inArea.map((vendor) => [vendor._id.toString(), vendor.dietType]));

  const dishes: MenuDish[] = [];
  for (const listing of listings) {
    const product = productById.get(listing.productId.toString());
    if (!product || !sellable.has(listing.productId.toString())) continue;
    dishes.push({
      name: product.name,
      searchKeywords: product.searchKeywords,
      brand: product.brand,
      sku: product.sku,
      dietType: product.dietType,
      vendorDiet: dietByVendor.get(listing.vendorId.toString()),
    });
  }
  return dishes;
}

function pickIsOnMenu(pick: HomeTopPick, dishes: MenuDish[]): boolean {
  return dishes.some((dish) => dishMatchesTopPick(pick, dish));
}

/** Enabled picks whose dish is not on any active restaurant inside a launch area. */
export async function topPickLabelsMissingFromServiceAreas(picks: HomeTopPick[]): Promise<string[]> {
  const enabled = picks.filter((pick) => pick.enabled);
  if (!enabled.length) return [];
  const dishes = await menuDishesInsideServiceAreas();
  return enabled.filter((pick) => !pickIsOnMenu(pick, dishes)).map((pick) => pick.label.en);
}

export async function assertTopPicksSoldInServiceAreas(picks: HomeTopPick[]): Promise<void> {
  const missing = await topPickLabelsMissingFromServiceAreas(picks);
  if (!missing.length) return;
  throw new BusinessRuleError(
    `These top picks are not sold by a restaurant inside the configured service areas: ${missing.join(', ')}. Add the dish to a restaurant in a launch area first.`,
  );
}

/** Drop enabled picks the customer cannot order from a restaurant in a launch area. */
export async function filterTopPicksSoldInServiceAreas(picks: HomeTopPick[]): Promise<HomeTopPick[]> {
  const dishes = await menuDishesInsideServiceAreas();
  return picks.filter((pick) => !pick.enabled || pickIsOnMenu(pick, dishes));
}
