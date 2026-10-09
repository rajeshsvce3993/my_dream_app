import type { Types } from 'mongoose';
import { BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { getConfigValue, getVendorRankingWeights } from '../configuration/configuration.service.js';
import { InventoryModel, type IInventory } from '../inventory/inventory.model.js';
import { OfferModel } from '../offers/offer.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { VendorProductModel, type IVendorProduct } from '../products/vendorProduct.model.js';
import { VendorModel, type IVendor } from '../vendors/vendor.model.js';
import {
  assertCustomerInServiceArea,
  isCustomerInAllowedServiceArea,
  vendorSharesCustomerLaunchArea,
} from '../delivery/deliveryServiceAreas.service.js';
import { haversineKm } from '../vendors/vendorDelivery.service.js';
import { computeCustomerUnitPrice } from './customerUnitPrice.js';
import { foodProductIdSet, vendorMenuGstPercent } from './foodCharges.service.js';

export interface VendorOfferQuote {
  vendorId: string;
  vendorName: string;
  variantId: string;
  vendorPrice: number;
  mrp: number;
  sellingPrice: number;
  discountAmount: number;
  offerDiscount: number;
  taxAmount: number;
  finalUnitPrice: number;
  availableQuantity: number;
  distanceKm?: number;
  rating: number;
  score: number;
  deliveryEstimateMinutes?: number;
}

type ActiveOffer = Awaited<ReturnType<typeof loadActiveOffers>>[number];

async function loadActiveOffers() {
  const now = new Date();
  return OfferModel.find({
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  }).lean();
}

function offerDiscountFromCatalog(
  offers: ActiveOffer[],
  vendorId: string,
  variantId: string,
  basePrice: number,
  quantity: number,
): number {
  let best = 0;
  for (const offer of offers) {
    const vendorMatch =
      offer.vendorId == null || offer.vendorId.toString() === vendorId;
    const variantMatch =
      offer.variantId == null || offer.variantId.toString() === variantId;
    if (!vendorMatch || !variantMatch) continue;
    if (offer.minQuantity && quantity < offer.minQuantity) continue;
    let discount = 0;
    if (offer.discountType === 'PERCENTAGE') {
      discount = (basePrice * offer.discountValue) / 100;
      if (offer.maxDiscountAmount) discount = Math.min(discount, offer.maxDiscountAmount);
    } else {
      discount = offer.discountValue;
    }
    best = Math.max(best, discount);
  }
  return Math.min(best, basePrice);
}

export type VendorOfferComparison = Awaited<ReturnType<typeof quoteVendorOffers>>;

type LeanVendorProduct = IVendorProduct & { _id: Types.ObjectId };
type LeanVendor = IVendor & { _id: Types.ObjectId };
type LeanInventory = IInventory & { _id: Types.ObjectId };

function finalizeVendorQuotes(quotes: VendorOfferQuote[]): VendorOfferComparison {
  if (!quotes.length) {
    return {
      vendors: [],
      cheapestVendorId: null,
      nearestVendorId: null,
      bestOverallVendorId: null,
      vendorProductIdMap: new Map(),
    };
  }
  quotes.sort((a, b) => b.score - a.score);
  const cheapest = [...quotes].sort((a, b) => a.finalUnitPrice - b.finalUnitPrice)[0];
  const nearest = [...quotes].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))[0];
  return {
    vendors: quotes,
    cheapestVendorId: cheapest?.vendorId ?? null,
    nearestVendorId: nearest?.vendorId ?? null,
    bestOverallVendorId: quotes[0]?.vendorId ?? null,
    vendorProductIdMap: new Map(),
  };
}

function buildQuotesForVariant(input: {
  variantId: string;
  mappings: LeanVendorProduct[];
  vendorMap: Map<string, LeanVendor>;
  inventoryMap: Map<string, LeanInventory>;
  offers: ActiveOffer[];
  taxRate: number;
  /** Food lines use each restaurant’s own GST. Other lines use taxRate. */
  isFood?: boolean;
  weights: Awaited<ReturnType<typeof getVendorRankingWeights>>;
  quantity: number;
  customerLng?: number;
  customerLat?: number;
  matchedLaunchAreas?: Awaited<ReturnType<typeof isCustomerInAllowedServiceArea>>['matchedAreas'] | null;
  skipLocationFilter?: boolean;
  allowInsufficientStock?: boolean;
}): VendorOfferComparison {
  const mappings = input.mappings;
  if (!mappings.length) {
    return finalizeVendorQuotes([]);
  }

  const quotes: VendorOfferQuote[] = [];
  const maxPrice = Math.max(...mappings.map((m) => m.sellingPrice), 1);
  const maxDistance = 50;

  for (const mapping of mappings) {
    const vendor = input.vendorMap.get(mapping.vendorId.toString());
    if (!vendor) continue;

    if (input.matchedLaunchAreas) {
      const [vlng, vlat] = vendor.location.coordinates;
      if (!vendorSharesCustomerLaunchArea(vlng, vlat, input.matchedLaunchAreas)) continue;
    }

    const inv = input.inventoryMap.get(`${mapping.vendorId}:${mapping.variantId}`);
    const available = inv?.available ?? 0;
    if (!input.allowInsufficientStock && available < input.quantity) continue;

    let distanceKm: number | undefined;
    if (
      !input.skipLocationFilter &&
      input.customerLng !== undefined &&
      input.customerLat !== undefined
    ) {
      const [vlng, vlat] = vendor.location.coordinates;
      distanceKm = haversineKm(input.customerLng, input.customerLat, vlng, vlat);
    }

    const baseDiscount = Math.max(0, mapping.mrp - mapping.sellingPrice);
    const offerDiscount = offerDiscountFromCatalog(
      input.offers,
      mapping.vendorId.toString(),
      mapping.variantId.toString(),
      mapping.sellingPrice,
      input.quantity,
    );
    const priced = computeCustomerUnitPrice({
      sellingPrice: mapping.sellingPrice,
      offerDiscount,
      taxRatePercent: input.isFood ? vendorMenuGstPercent(vendor) : input.taxRate,
    });
    const { taxAmount, finalUnitPrice } = priced;

    const priceScore = 1 - mapping.sellingPrice / maxPrice;
    const distanceScore =
      distanceKm !== undefined ? 1 - Math.min(distanceKm, maxDistance) / maxDistance : 0.5;
    const ratingScore = vendor.rating / 5;
    const availabilityScore = Math.min(available / 100, 1);

    const score =
      input.weights.priceWeight * priceScore +
      input.weights.distanceWeight * distanceScore +
      input.weights.ratingWeight * ratingScore +
      input.weights.availabilityWeight * availabilityScore;

    quotes.push({
      vendorId: mapping.vendorId.toString(),
      vendorName: vendor.name,
      variantId: mapping.variantId.toString(),
      vendorPrice: mapping.vendorPrice,
      mrp: mapping.mrp,
      sellingPrice: mapping.sellingPrice,
      discountAmount: baseDiscount,
      offerDiscount,
      taxAmount,
      finalUnitPrice,
      availableQuantity: available,
      distanceKm,
      rating: vendor.rating,
      score,
      deliveryEstimateMinutes: mapping.preparationMinutes,
    });
  }

  return finalizeVendorQuotes(quotes);
}

/** Batch quote for catalog cards — avoids N+1 DB round-trips per product. */
export async function quoteVendorOffersBatch(input: {
  variantIds: string[];
  quantity?: number;
  customerLng?: number;
  customerLat?: number;
  skipLocationFilter?: boolean;
  allowInsufficientStock?: boolean;
}): Promise<Map<string, VendorOfferComparison>> {
  const uniqueIds = [...new Set(input.variantIds.filter(Boolean))];
  const out = new Map<string, VendorOfferComparison>();
  if (!uniqueIds.length) return out;

  const quantity = input.quantity ?? 1;
  const [variants, mappings, offers, defaultTaxRate, weights] = await Promise.all([
    ProductVariantModel.find({ _id: { $in: uniqueIds }, status: 'ACTIVE' }).lean(),
    VendorProductModel.find({ variantId: { $in: uniqueIds }, isActive: true }).lean(),
    loadActiveOffers(),
    getConfigValue<number>('tax.defaultRate', 0),
    getVendorRankingWeights(),
  ]);
  const foodProducts = await foodProductIdSet(variants.map((variant) => variant.productId.toString()));
  const productIdByVariant = new Map(variants.map((variant) => [variant._id.toString(), variant.productId.toString()]));

  const activeVariantIds = new Set(variants.map((v) => v._id.toString()));
  for (const id of uniqueIds) {
    if (!activeVariantIds.has(id)) {
      out.set(id, finalizeVendorQuotes([]));
    }
  }

  if (!mappings.length) {
    for (const id of uniqueIds) {
      if (!out.has(id)) out.set(id, finalizeVendorQuotes([]));
    }
    return out;
  }

  const vendorIds = [...new Set(mappings.map((m) => m.vendorId.toString()))];
  const [vendors, inventories] = await Promise.all([
    VendorModel.find({ _id: { $in: vendorIds }, status: 'ACTIVE' }).lean(),
    InventoryModel.find({ variantId: { $in: uniqueIds } }).lean(),
  ]);

  const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));
  const inventoryMap = new Map(inventories.map((i) => [`${i.vendorId}:${i.variantId}`, i]));
  const mappingsByVariant = new Map<string, LeanVendorProduct[]>();
  for (const m of mappings) {
    const vid = m.variantId.toString();
    const list = mappingsByVariant.get(vid) ?? [];
    list.push(m);
    mappingsByVariant.set(vid, list);
  }

  let matchedLaunchAreas: Awaited<ReturnType<typeof isCustomerInAllowedServiceArea>>['matchedAreas'] | null =
    null;
  if (
    !input.skipLocationFilter &&
    input.customerLng !== undefined &&
    input.customerLat !== undefined
  ) {
    const zone = await isCustomerInAllowedServiceArea(input.customerLng, input.customerLat);
    if (!zone.allowed) {
      for (const id of uniqueIds) {
        if (!out.has(id)) out.set(id, finalizeVendorQuotes([]));
      }
      return out;
    }
    matchedLaunchAreas = zone.unrestricted ? null : zone.matchedAreas;
  }

  for (const variantId of uniqueIds) {
    if (out.has(variantId)) continue;
    const variantMappings = mappingsByVariant.get(variantId) ?? [];
    out.set(
      variantId,
      buildQuotesForVariant({
        variantId,
        mappings: variantMappings,
        vendorMap,
        inventoryMap,
        offers,
        taxRate: defaultTaxRate,
        isFood: foodProducts.has(productIdByVariant.get(variantId) ?? ''),
        weights,
        quantity,
        customerLng: input.customerLng,
        customerLat: input.customerLat,
        matchedLaunchAreas,
        skipLocationFilter: input.skipLocationFilter,
        allowInsufficientStock: input.allowInsufficientStock,
      }),
    );
  }

  return out;
}

export async function quoteVendorOffers(input: {
  variantId: string;
  quantity?: number;
  customerLng?: number;
  customerLat?: number;
  vendorIds?: string[];
  /** When true, include map key `${vendorId}:${variantId}` → vendorProduct _id */
  includeVendorProductIds?: boolean;
  /** Ignore customer delivery radius (deferred / check-later cart adds). */
  skipLocationFilter?: boolean;
  /** When true, include vendors even if inventory is below quantity (availability pending). */
  allowInsufficientStock?: boolean;
}): Promise<{
  vendors: VendorOfferQuote[];
  cheapestVendorId: string | null;
  nearestVendorId: string | null;
  bestOverallVendorId: string | null;
  vendorProductIdMap: Map<string, string>;
}> {
  const quantity = input.quantity ?? 1;
  const variant = await ProductVariantModel.findById(input.variantId).lean();
  if (!variant || variant.status !== 'ACTIVE') throw new NotFoundError('Variant not found');

  const mappingFilter: Record<string, unknown> = {
    variantId: input.variantId,
    isActive: true,
  };
  if (input.vendorIds?.length) mappingFilter.vendorId = { $in: input.vendorIds };

  const mappings = await VendorProductModel.find(mappingFilter).lean();
  if (!mappings.length) throw new NotFoundError('No vendor offers for this variant');

  const vendorIds = mappings.map((m) => m.vendorId.toString());
  const vendors = await VendorModel.find({ _id: { $in: vendorIds }, status: 'ACTIVE' }).lean();
  const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));

  const inventories = await InventoryModel.find({
    vendorId: { $in: vendorIds },
    variantId: input.variantId,
  }).lean();
  const inventoryMap = new Map(inventories.map((i) => [`${i.vendorId}:${i.variantId}`, i]));

  const [defaultTaxRate, weights, offers] = await Promise.all([
    getConfigValue<number>('tax.defaultRate', 0),
    getVendorRankingWeights(),
    loadActiveOffers(),
  ]);
  const foodProducts = await foodProductIdSet([variant.productId.toString()]);
  const isFood = foodProducts.has(variant.productId.toString());

  const quotes: VendorOfferQuote[] = [];
  const vendorProductIdMap = new Map<string, string>();

  let matchedLaunchAreas: Awaited<
    ReturnType<typeof isCustomerInAllowedServiceArea>
  >['matchedAreas'] | null = null;
  if (input.customerLng !== undefined && input.customerLat !== undefined) {
    const zone = await isCustomerInAllowedServiceArea(input.customerLng, input.customerLat);
    if (!zone.allowed && !input.skipLocationFilter) {
      return {
        vendors: [],
        cheapestVendorId: null,
        nearestVendorId: null,
        bestOverallVendorId: null,
        vendorProductIdMap,
      };
    }
    matchedLaunchAreas = zone.unrestricted || !zone.allowed ? null : zone.matchedAreas;
  }

  for (const mapping of mappings) {
    const vendor = vendorMap.get(mapping.vendorId.toString());
    if (!vendor) continue;

    if (matchedLaunchAreas) {
      const [vlng, vlat] = vendor.location.coordinates;
      if (!vendorSharesCustomerLaunchArea(vlng, vlat, matchedLaunchAreas)) continue;
    }

    const inv = inventoryMap.get(`${mapping.vendorId}:${mapping.variantId}`);
    const available = inv?.available ?? 0;
    if (!input.allowInsufficientStock && available < quantity) continue;

    let distanceKm: number | undefined;
    if (
      !input.skipLocationFilter &&
      input.customerLng !== undefined &&
      input.customerLat !== undefined
    ) {
      const [vlng, vlat] = vendor.location.coordinates;
      distanceKm = haversineKm(input.customerLng, input.customerLat, vlng, vlat);
    }

    if (input.includeVendorProductIds) {
      vendorProductIdMap.set(
        `${mapping.vendorId.toString()}:${mapping.variantId.toString()}`,
        mapping._id.toString(),
      );
    }

    const baseDiscount = Math.max(0, mapping.mrp - mapping.sellingPrice);
    const offerDiscount = offerDiscountFromCatalog(
      offers,
      mapping.vendorId.toString(),
      mapping.variantId.toString(),
      mapping.sellingPrice,
      quantity,
    );
    const priced = computeCustomerUnitPrice({
      sellingPrice: mapping.sellingPrice,
      offerDiscount,
      taxRatePercent: isFood ? vendorMenuGstPercent(vendor) : defaultTaxRate,
    });
    const { taxAmount, finalUnitPrice } = priced;

    const maxPrice = Math.max(...mappings.map((m) => m.sellingPrice), 1);
    const maxDistance = 50;
    const priceScore = 1 - mapping.sellingPrice / maxPrice;
    const distanceScore = distanceKm !== undefined ? 1 - Math.min(distanceKm, maxDistance) / maxDistance : 0.5;
    const ratingScore = vendor.rating / 5;
    const availabilityScore = Math.min(available / 100, 1);

    const score =
      weights.priceWeight * priceScore +
      weights.distanceWeight * distanceScore +
      weights.ratingWeight * ratingScore +
      weights.availabilityWeight * availabilityScore;

    quotes.push({
      vendorId: mapping.vendorId.toString(),
      vendorName: vendor.name,
      variantId: mapping.variantId.toString(),
      vendorPrice: mapping.vendorPrice,
      mrp: mapping.mrp,
      sellingPrice: mapping.sellingPrice,
      discountAmount: baseDiscount,
      offerDiscount,
      taxAmount,
      finalUnitPrice,
      availableQuantity: available,
      distanceKm,
      rating: vendor.rating,
      score,
      deliveryEstimateMinutes: mapping.preparationMinutes,
    });
  }

  const finalized = finalizeVendorQuotes(quotes);
  return { ...finalized, vendorProductIdMap };
}

export async function validateLinePrice(input: {
  vendorId: string;
  variantId: string;
  quantity: number;
  customerLng?: number;
  customerLat?: number;
}): Promise<VendorOfferQuote> {
  if (input.customerLng !== undefined && input.customerLat !== undefined) {
    await assertCustomerInServiceArea(input.customerLng, input.customerLat);
  }
  const result = await quoteVendorOffers({
    variantId: input.variantId,
    quantity: input.quantity,
    customerLng: input.customerLng,
    customerLat: input.customerLat,
    vendorIds: [input.vendorId],
  });
  const match = result.vendors.find((v) => v.vendorId === input.vendorId);
  if (!match) {
    throw new BusinessRuleError(
      input.customerLng !== undefined
        ? 'This item is not available for delivery to your location'
        : 'Vendor offer no longer valid',
    );
  }
  return match;
}
