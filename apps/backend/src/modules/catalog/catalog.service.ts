import mongoose from 'mongoose';
import { getConfigValue } from '../configuration/configuration.service.js';
import { CategoryModel } from '../categories/category.model.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { isCustomerInAllowedServiceArea } from '../delivery/deliveryServiceAreas.service.js';
import {
  PRODUCT_NO_VENDOR_MESSAGE,
  SERVICE_AREA_BODY,
  SERVICE_AREA_TITLE,
  type LocationAvailabilityReason,
} from '../delivery/locationAvailability.js';
import { quoteVendorOffers, quoteVendorOffersBatch, type VendorOfferComparison } from '../pricing/pricing.service.js';
import { VendorProductModel } from '../products/vendorProduct.model.js';
import { normalizeSeedPrice } from '../../common/money.util.js';
import { VendorModel } from '../vendors/vendor.model.js';
import {
  pickCheapestQuoteForDisplay,
  productCardPriceFromQuote,
} from './productCardPricing.js';

type VendorComparison = VendorOfferComparison;

function emptyComparison(): VendorComparison {
  return {
    vendors: [],
    cheapestVendorId: null,
    nearestVendorId: null,
    bestOverallVendorId: null,
    vendorProductIdMap: new Map(),
  };
}

function applyComparisonToSummary(
  summary: ProductCardSummary,
  comparison: VendorComparison,
  actualPrice?: number,
): void {
  const displayQuote = pickCheapestQuoteForDisplay(comparison.vendors);
  if (!displayQuote) return;
  const price = productCardPriceFromQuote(displayQuote, actualPrice);
  if (actualPrice != null) summary.actualPrice = actualPrice;
  summary.mrp = price.mrp;
  summary.sellingPrice = price.sellingPrice;
  summary.finalUnitPrice = price.finalUnitPrice;
  summary.displayPrice = price.displayPrice;
  summary.discountPercent = price.discountPercent;
  summary.nearestKm = displayQuote.distanceKm;
  summary.deliveryMinutes = displayQuote.deliveryEstimateMinutes;
  summary.rating = displayQuote.rating;
  summary.recommendedVendorId =
    comparison.bestOverallVendorId ??
    comparison.cheapestVendorId ??
    displayQuote.vendorId;
  if (comparison.cheapestVendorId) summary.labels.push('best_price');
  if (comparison.nearestVendorId) summary.labels.push('nearby');
  if (comparison.bestOverallVendorId) summary.labels.push('best_overall');
}

async function batchQuoteForProductCards(
  variantIds: string[],
  lng?: number,
  lat?: number,
): Promise<Map<string, { comparison: VendorComparison; vendorsAtLocation: number }>> {
  const out = new Map<string, { comparison: VendorComparison; vendorsAtLocation: number }>();
  if (!variantIds.length) return out;

  const atLocation = await quoteVendorOffersBatch({
    variantIds,
    quantity: 1,
    customerLng: lng,
    customerLat: lat,
  });

  const needRelaxed: string[] = [];
  for (const id of variantIds) {
    const comparison = atLocation.get(id) ?? emptyComparison();
    if (comparison.vendors.length > 0) {
      out.set(id, { comparison, vendorsAtLocation: comparison.vendors.length });
    } else {
      needRelaxed.push(id);
    }
  }

  if (needRelaxed.length) {
    const relaxed = await quoteVendorOffersBatch({
      variantIds: needRelaxed,
      quantity: 1,
      customerLng: lng,
      customerLat: lat,
      skipLocationFilter: true,
      allowInsufficientStock: true,
    });
    for (const id of needRelaxed) {
      out.set(id, {
        comparison: relaxed.get(id) ?? emptyComparison(),
        vendorsAtLocation: 0,
      });
    }
  }

  return out;
}

async function batchVariantListPrices(
  variants: Array<{ _id: mongoose.Types.ObjectId; listPrice?: number }>,
): Promise<Map<string, number | undefined>> {
  const prices = new Map<string, number | undefined>();
  const missing: string[] = [];
  for (const v of variants) {
    const id = v._id.toString();
    if (v.listPrice != null && v.listPrice > 0) {
      prices.set(id, v.listPrice);
    } else {
      missing.push(id);
    }
  }
  if (missing.length) {
    const mappings = await VendorProductModel.find({ variantId: { $in: missing }, isActive: true })
      .select('variantId mrp')
      .lean();
    const maxByVariant = new Map<string, number>();
    for (const m of mappings) {
      const vid = m.variantId.toString();
      const prev = maxByVariant.get(vid) ?? 0;
      maxByVariant.set(vid, Math.max(prev, m.mrp));
    }
    for (const id of missing) {
      const max = maxByVariant.get(id);
      prices.set(id, max != null ? normalizeSeedPrice(max) : undefined);
    }
  }
  return prices;
}

export type ProductCardSummary = {
  productId: string;
  name: { en: string; ta?: string };
  brand?: string;
  imageUrl?: string;
  variantId?: string;
  recommendedVendorId?: string;
  /** Product reference MRP (same for all vendors). */
  actualPrice?: number;
  mrp?: number;
  sellingPrice?: number;
  finalUnitPrice?: number;
  /** Same as finalUnitPrice when quoted; use for all listing/home UIs. */
  displayPrice?: number;
  discountPercent?: number;
  vendorCount: number;
  nearestKm?: number;
  deliveryMinutes?: number;
  rating?: number;
  labels: string[];
  unitLabel?: string;
  serviceableAtLocation?: boolean;
  availabilityReason?: LocationAvailabilityReason;
  availabilityTitle?: string;
  availabilityMessage?: string;
};

export type ResolvedProductOffer = {
  productId: string;
  variantId: string;
  vendorId: string | null;
  serviceableAtLocation: boolean;
  vendorCount: number;
  reason?: LocationAvailabilityReason;
  serviceAreaTitle?: string;
  message?: string;
};

export async function buildProductSummaries(input: {
  lng?: number;
  lat?: number;
  limit?: number;
  categoryId?: string;
  categorySlug?: string;
  productIds?: string[];
  q?: string;
}): Promise<ProductCardSummary[]> {
  const limit = Math.min(48, input.limit ?? 12);
  const filter: Record<string, unknown> = { status: 'ACTIVE' };

  let categoryObjectId: mongoose.Types.ObjectId | undefined;
  if (input.categoryId && mongoose.Types.ObjectId.isValid(input.categoryId)) {
    categoryObjectId = new mongoose.Types.ObjectId(input.categoryId);
  } else if (input.categorySlug) {
    const cat = await CategoryModel.findOne({ slug: input.categorySlug, isActive: true }).lean();
    if (cat) categoryObjectId = cat._id as mongoose.Types.ObjectId;
  }
  if (categoryObjectId) filter.categoryId = categoryObjectId;
  if (input.productIds?.length) filter._id = { $in: input.productIds };
  if (input.q?.trim()) filter.$text = { $search: input.q.trim() };

  const products = await ProductModel.find(filter)
    .sort(input.q?.trim() ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .limit(limit)
    .lean();
  const summaries: ProductCardSummary[] = [];

  if (!products.length) return summaries;

  const productIds = products.map((p) => p._id);
  const variantDocs = await ProductVariantModel.find({
    productId: { $in: productIds },
    status: 'ACTIVE',
  })
    .sort({ sortOrder: 1 })
    .lean();

  const variantByProductId = new Map<string, (typeof variantDocs)[number]>();
  for (const variant of variantDocs) {
    const pid = variant.productId.toString();
    if (!variantByProductId.has(pid)) variantByProductId.set(pid, variant);
  }

  const variantIds = [...variantByProductId.values()].map((v) => v._id.toString());
  const [quoteMap, listPriceMap, zone] = await Promise.all([
    batchQuoteForProductCards(variantIds, input.lng, input.lat),
    batchVariantListPrices(variantDocs),
    input.lng !== undefined && input.lat !== undefined
      ? isCustomerInAllowedServiceArea(input.lng, input.lat)
      : Promise.resolve({ allowed: true }),
  ]);
  const outsideServiceArea = !zone.allowed;

  for (const product of products) {
    const variant = variantByProductId.get(product._id.toString());
    if (!variant) continue;

    const variantId = variant._id.toString();
    const summary: ProductCardSummary = {
      productId: product._id.toString(),
      name: product.name,
      brand: product.brand,
      imageUrl: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
      variantId,
      unitLabel: variant.name?.en,
      vendorCount: 0,
      labels: [],
    };

    const quoted = quoteMap.get(variantId) ?? { comparison: emptyComparison(), vendorsAtLocation: 0 };
    const actualPrice = listPriceMap.get(variantId);
    applyComparisonToSummary(summary, quoted.comparison, actualPrice);

    if (outsideServiceArea) {
      summary.serviceableAtLocation = false;
      summary.vendorCount = 0;
      summary.availabilityReason = 'OUTSIDE_SERVICE_AREA';
      summary.availabilityTitle = SERVICE_AREA_TITLE;
      summary.availabilityMessage = SERVICE_AREA_BODY;
      summary.labels.push('outside_service_area');
      summaries.push(summary);
      continue;
    }

    summary.vendorCount = quoted.vendorsAtLocation;
    summary.serviceableAtLocation = quoted.vendorsAtLocation > 0;
    if (!summary.serviceableAtLocation) {
      summary.availabilityReason = 'NO_VENDORS_NEARBY';
      summary.availabilityMessage = PRODUCT_NO_VENDOR_MESSAGE;
    }

    summaries.push(summary);
  }

  if (input.productIds?.length) {
    const order = new Map(input.productIds.map((id, i) => [id, i]));
    summaries.sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
  }

  return summaries;
}

export async function resolveProductOffer(input: {
  productId: string;
  variantId?: string;
  lng?: number;
  lat?: number;
  quantity?: number;
}): Promise<ResolvedProductOffer> {
  const product = await ProductModel.findById(input.productId).lean();
  if (!product || product.status !== 'ACTIVE') throw new NotFoundError('Product not found');

  const variant = input.variantId
    ? await ProductVariantModel.findById(input.variantId).lean()
    : await ProductVariantModel.findOne({ productId: product._id, status: 'ACTIVE' })
        .sort({ sortOrder: 1 })
        .lean();
  if (!variant || variant.status !== 'ACTIVE') throw new NotFoundError('Variant not available');

  if (input.lng !== undefined && input.lat !== undefined) {
    const zone = await isCustomerInAllowedServiceArea(input.lng, input.lat);
    if (!zone.allowed) {
      return {
        productId: product._id.toString(),
        variantId: variant._id.toString(),
        vendorId: null,
        serviceableAtLocation: false,
        vendorCount: 0,
        reason: 'OUTSIDE_SERVICE_AREA',
        serviceAreaTitle: SERVICE_AREA_TITLE,
        message: SERVICE_AREA_BODY,
      };
    }
  }

  const comparison = await quoteVendorOffers({
    variantId: variant._id.toString(),
    quantity: input.quantity ?? 1,
    customerLng: input.lng,
    customerLat: input.lat,
  });

  const vendorId =
    comparison.bestOverallVendorId ??
    comparison.cheapestVendorId ??
    comparison.vendors[0]?.vendorId ??
    null;

  const serviceableAtLocation = comparison.vendors.length > 0 && Boolean(vendorId);

  return {
    productId: product._id.toString(),
    variantId: variant._id.toString(),
    vendorId,
    serviceableAtLocation,
    vendorCount: comparison.vendors.length,
    reason: serviceableAtLocation
      ? undefined
      : input.lng !== undefined && input.lat !== undefined
        ? 'NO_VENDORS_NEARBY'
        : undefined,
    message: serviceableAtLocation
      ? undefined
      : input.lng !== undefined && input.lat !== undefined
        ? PRODUCT_NO_VENDOR_MESSAGE
        : 'No vendor offers this product right now.',
  };
}

export async function searchSuggest(q: string, limit = 8) {
  const term = q.trim();
  if (term.length < 2) {
    const popular = await getConfigValue<string[]>('search.popularQueries', []);
    return { suggestions: [], popular, recent: [] as string[] };
  }

  const products = await ProductModel.find(
    { status: 'ACTIVE', $text: { $search: term } },
    { score: { $meta: 'textScore' }, name: 1, brand: 1, slug: 1 },
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();

  const categories = await CategoryModel.find({
    isActive: true,
    $or: [{ 'name.en': new RegExp(term, 'i') }, { 'name.ta': new RegExp(term, 'i') }],
  })
    .limit(4)
    .lean();

  return {
    suggestions: [
      ...products.map((p) => ({
        type: 'product' as const,
        id: p._id.toString(),
        label: p.name,
        slug: p.slug,
      })),
      ...categories.map((c) => ({
        type: 'category' as const,
        id: c._id.toString(),
        label: c.name,
        slug: c.slug,
      })),
    ],
    popular: await getConfigValue<string[]>('search.popularQueries', []),
    recent: [] as string[],
  };
}

export type CategoryBrowseSettings = {
  categories: Array<{
    _id: mongoose.Types.ObjectId;
    slug: string;
    name: { en: string; ta?: string };
    parentId?: mongoose.Types.ObjectId | null;
    sortOrder?: number;
  }>;
  productLimit: number;
  subcategoryLimit: number;
  /** Optional parent slug → default subcategory slug when opening listing from home. */
  defaultSubcategorySlugByParent: Record<string, string>;
};

/** Parent categories + limits from admin `home.sections` → category_shortcuts. */
export async function resolveCategoryBrowseSettings(): Promise<CategoryBrowseSettings | null> {
  const sections =
    (await getConfigValue<
      Array<{ type: string; enabled: boolean; config?: Record<string, unknown> }>
    >('home.sections', [])) ?? [];
  const section = sections.find((s) => s.enabled && s.type === 'category_shortcuts');
  if (!section) return null;
  const config = section.config ?? {};
  const limit = Number(config.limit ?? 12);
  const productLimit = Number(config.productLimit ?? 10);
  const subcategoryLimit = Number(config.subcategoryLimit ?? 20);
  const defaultSubcategorySlugByParent =
    (config.defaultSubcategorySlugByParent as Record<string, string> | undefined) ?? {};
  const slugs = config.slugs as string[] | undefined;
  let categories;
  if (slugs?.length) {
    const docs = await CategoryModel.find({
      slug: { $in: slugs },
      isActive: true,
      $or: [{ parentId: null }, { parentId: { $exists: false } }],
    }).lean();
    const order = new Map(slugs.map((s, i) => [s, i]));
    categories = docs.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  } else {
    const featuredOnly = Boolean(config.featuredOnly);
    const filter: Record<string, unknown> = { isActive: true, parentId: null };
    if (featuredOnly) filter.isFeatured = true;
    categories = await CategoryModel.find(filter).sort({ sortOrder: 1 }).limit(limit).lean();
  }
  return { categories, productLimit, subcategoryLimit, defaultSubcategorySlugByParent };
}

export async function buildHomeFeed(lng?: number, lat?: number) {
  const sections =
    (await getConfigValue<
      Array<{
        id: string;
        type: string;
        enabled: boolean;
        title?: { en: string; ta?: string };
        subtitle?: { en: string; ta?: string };
        config?: Record<string, unknown>;
      }>
    >('home.sections', [])) ?? [];

  const deliveryPromise = await getConfigValue<{ en: string; ta?: string }>('home.deliveryPromise', {
    en: 'Delivery in 18–25 min',
    ta: '18–25 நிமிடத்தில் விநியோகம்',
  });

  const greeting = await getConfigValue<{ en: string; ta?: string }>('home.greetingTemplate', {
    en: 'What do you need today?',
    ta: 'இன்று என்ன வேண்டும்?',
  });

  const resolved = [];
  for (const section of sections.filter((s) => s.enabled)) {
    if (section.type === 'delivery_promise') {
      resolved.push({ ...section, data: { promise: deliveryPromise } });
      continue;
    }
    if (section.type === 'hero_banner') {
      const hero = await getConfigValue('home.hero', {
        title: { en: 'Fresh Products Better Prices', ta: 'புதிய பொருட்கள் சிறந்த விலை' },
        subtitle: {
          en: 'Compare nearby vendors and get the best deal delivered fast.',
          ta: 'அர 근ம் உள்ள கடைகளை ஒப்பிட்டு விரைவாக ஆர்டர் செய்யுங்கள்.',
        },
        ctaLabel: { en: 'Shop now', ta: 'இப்போது வாங்க' },
        ctaPath: '/products',
      });
      resolved.push({ ...section, data: hero });
      continue;
    }
    if (section.type === 'category_shortcuts') {
      const browse = await resolveCategoryBrowseSettings();
      resolved.push({
        ...section,
        data: {
          categories: browse?.categories ?? [],
          productLimit: browse?.productLimit ?? 10,
          subcategoryLimit: browse?.subcategoryLimit ?? 20,
          defaultSubcategorySlugByParent: browse?.defaultSubcategorySlugByParent ?? {},
        },
      });
      continue;
    }
    if (section.type === 'product_row') {
      const limit = Number(section.config?.limit ?? 8);
      let categoryId = section.config?.categoryId as string | undefined;
      const categorySlug = section.config?.categorySlug as string | undefined;
      if (!categoryId && categorySlug) {
        const cat = await CategoryModel.findOne({ slug: categorySlug, isActive: true }).lean();
        categoryId = cat?._id.toString();
      }
      const skus = section.config?.skus as string[] | undefined;
      let products = await buildProductSummaries({ lng, lat, limit, categoryId });
      if (skus?.length) {
        const bySku = await ProductModel.find({ sku: { $in: skus }, status: 'ACTIVE' }).lean();
        const idOrder = new Map(bySku.map((p) => [p.sku, p._id.toString()]));
        const orderedIds = skus.map((s) => idOrder.get(s)).filter(Boolean) as string[];
        if (orderedIds.length) {
          products = await buildProductSummaries({
            lng,
            lat,
            limit: orderedIds.length,
            productIds: orderedIds,
          });
        }
      }
      const layout = (section.config?.layout as string) ?? 'grid';
      const viewAllPath = section.config?.viewAllPath as string | undefined;
      const viewAllCategorySlug = section.config?.viewAllCategorySlug as string | undefined;
      const viewAllLabel = section.config?.viewAllLabel as { en: string; ta?: string } | string | undefined;
      resolved.push({
        ...section,
        data: { products, layout, viewAllPath, viewAllCategorySlug, viewAllLabel },
      });
      continue;
    }
    if (section.type === 'vendor_row') {
      const maxRadius = await getConfigValue<number>('vendor.search.maxRadiusKm', 25);
      const vendors = await VendorModel.find({ status: 'ACTIVE' }).limit(8).lean();
      const withDistance = vendors.map((v) => {
        let distanceKm: number | undefined;
        if (lng !== undefined && lat !== undefined && v.location?.coordinates) {
          const [vlng, vlat] = v.location.coordinates;
          distanceKm = haversineKm(lng, lat, vlng, vlat);
        }
        return {
          id: v._id.toString(),
          name: v.name,
          rating: v.rating,
          ratingCount: v.ratingCount,
          distanceKm,
          withinService: distanceKm === undefined || distanceKm <= maxRadius,
        };
      });
      resolved.push({ ...section, data: { vendors: withDistance } });
      continue;
    }
    if (section.type === 'promo_strip') {
      const promos = await getConfigValue<
        Array<{
          label: { en: string; ta?: string };
          subtitle?: { en: string; ta?: string };
          badgeLabel?: { en: string; ta?: string };
          ctaLabel?: { en: string; ta?: string };
          ctaPath?: string;
          imageUrl?: string;
          backgroundColor?: string;
          tone?: string;
        }>
      >('home.promos', []);
      resolved.push({ ...section, data: { promos } });
      continue;
    }
    if (section.type === 'value_props') {
      const props = await getConfigValue('home.valueProps', []);
      resolved.push({ ...section, data: { props } });
      continue;
    }
    resolved.push({ ...section, data: null });
  }

  return {
    greeting,
    deliveryPromise,
    sections: resolved,
  };
}

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
