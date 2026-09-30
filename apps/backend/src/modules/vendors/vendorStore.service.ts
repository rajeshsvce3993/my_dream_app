import mongoose from 'mongoose';
import { NotFoundError } from '../../common/errors/AppError.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { InventoryModel } from '../inventory/inventory.model.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { VendorProductModel } from '../products/vendorProduct.model.js';
import { quoteVendorOffers } from '../pricing/pricing.service.js';
import { VendorModel } from './vendor.model.js';
import { isCustomerInAllowedServiceArea } from '../delivery/deliveryServiceAreas.service.js';
import type { LocationAvailabilityInfo } from '../delivery/locationAvailability.js';
import { locationInfoForVendorList } from '../delivery/locationAvailability.js';
import {
  getVendorSearchRadiusKm,
  haversineKm,
  isWithinVendorDeliveryRadius,
  isWithinVendorDiscoveryRadius,
} from './vendorDelivery.service.js';
import {
  discountPercentFromMrp,
  productCardPriceFromQuote,
  type ProductCardPriceFields,
} from '../catalog/productCardPricing.js';
import { computeCustomerUnitPrice } from '../pricing/customerUnitPrice.js';
import { getVariantListPrice } from '../products/variantListPrice.service.js';
import {
  productMatchesDietFilter,
  resolveProductDietType,
} from '../catalog/diet.util.js';

export type CustomerVendorCard = {
  id: string;
  code: string;
  name: string;
  rating: number;
  ratingCount: number;
  distanceKm?: number;
  deliveryEstimateMinutes?: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrderAmount: number;
  isOpen: boolean;
  productCount: number;
  cuisineTags: string[];
  dietType?: 'veg' | 'nonveg' | 'both';
  imageUrl?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export type VendorStoreProductCard = {
  vendorProductId: string;
  vendorId: string;
  productId: string;
  variantId: string;
  name: { en: string; ta?: string };
  brand?: string;
  imageUrl?: string;
  unitLabel?: string;
  categoryId?: string;
  mrp: number;
  sellingPrice: number;
  finalUnitPrice: number;
  discountPercent?: number;
  actualPrice?: number;
  displayPrice: number;
  availableQuantity: number;
  inStock: boolean;
  deliveryEstimateMinutes?: number;
  dietType?: 'veg' | 'nonveg';
};

export type VendorStoreProductDetail = VendorStoreProductCard & {
  vendorName: string;
  description?: { en?: string; ta?: string };
  productSlug: string;
  variantName: { en: string; ta?: string };
};

async function resolveVendorProductDisplayPrice(input: {
  vendorId: string;
  variantId: string;
  mrp: number;
  sellingPrice: number;
  lng?: number;
  lat?: number;
}): Promise<ProductCardPriceFields> {
  const taxRate = await getConfigValue<number>('tax.defaultRate', 0);
  const actualPrice = await getVariantListPrice(input.variantId);
  try {
    const quote = await quoteVendorOffers({
      variantId: input.variantId,
      quantity: 1,
      customerLng: input.lng,
      customerLat: input.lat,
      vendorIds: [input.vendorId],
      allowInsufficientStock: true,
    });
    const match = quote.vendors.find((v) => v.vendorId === input.vendorId) ?? quote.vendors[0];
    if (match) {
      const price = productCardPriceFromQuote(match, actualPrice);
      return {
        mrp: price.mrp,
        sellingPrice: price.sellingPrice,
        finalUnitPrice: price.finalUnitPrice,
        displayPrice: price.displayPrice,
        actualPrice,
        discountPercent: price.discountPercent,
      };
    }
  } catch {
    /* fall through */
  }

  const { finalUnitPrice } = computeCustomerUnitPrice({
    sellingPrice: input.sellingPrice,
    taxRatePercent: taxRate,
  });
  const reference = actualPrice ?? input.mrp;
  return {
    mrp: reference,
    sellingPrice: input.sellingPrice,
    finalUnitPrice,
    displayPrice: finalUnitPrice,
    actualPrice,
    discountPercent: discountPercentFromMrp(reference, finalUnitPrice),
  };
}

function estimateDeliveryMinutes(distanceKm?: number, prepMinutes = 30): number {
  if (distanceKm === undefined) return prepMinutes;
  const travel = Math.round(distanceKm * 4);
  return Math.max(10, Math.min(60, prepMinutes + travel));
}

function vendorIsOpen(operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>): boolean {
  if (!operatingHours || !Object.keys(operatingHours).length) return true;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const slot = operatingHours[day];
  if (!slot || slot.closed) return false;
  const now = new Date();
  const [oh, om] = slot.open.split(':').map(Number);
  const [ch, cm] = slot.close.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= oh * 60 + om && mins <= ch * 60 + cm;
}

export async function listCustomerVendors(input: {
  lng?: number;
  lat?: number;
  page?: number;
  limit?: number;
  q?: string;
  diet?: 'veg' | 'nonveg';
}): Promise<{ items: CustomerVendorCard[]; total: number; location?: LocationAvailabilityInfo }> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const maxRadiusKm = await getVendorSearchRadiusKm();
  if (input.lng !== undefined && input.lat !== undefined) {
    const zone = await isCustomerInAllowedServiceArea(input.lng, input.lat);
    if (!zone.allowed) {
      return {
        items: [],
        total: 0,
        location: locationInfoForVendorList({ inServiceArea: false, vendorCount: 0 }),
      };
    }
  }
  const deliveryFee = await getConfigValue<number>('delivery.defaultFee', 0);
  const freeDeliveryThreshold = await getConfigValue<number>('delivery.freeThreshold', 499);
  const minimumOrderAmount = await getConfigValue<number>('order.minValue', 100);

  let vendors = await VendorModel.find({
    status: 'ACTIVE',
    // Legacy shops without KYC stay live; new shops must complete onboarding
    onboardingComplete: { $ne: false },
  }).lean();
  if (input.q?.trim()) {
    const term = input.q.trim();
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    vendors = vendors.filter((v) => re.test(v.name) || re.test(v.code));
  }
  if (input.diet === 'veg' || input.diet === 'nonveg') {
    vendors = vendors.filter((v) => {
      const d = v.dietType === 'veg' || v.dietType === 'nonveg' || v.dietType === 'both' ? v.dietType : 'both';
      return d === 'both' || d === input.diet;
    });
  }

  const withMeta: CustomerVendorCard[] = [];
  for (const v of vendors) {
    const [vlng, vlat] = v.location.coordinates;
    let distanceKm: number | undefined;
    if (input.lng !== undefined && input.lat !== undefined) {
      distanceKm = haversineKm(input.lng, input.lat, vlng, vlat);
      if (!isWithinVendorDiscoveryRadius(distanceKm, v, maxRadiusKm)) continue;
    }

    const activeMappings = await VendorProductModel.countDocuments({
      vendorId: v._id,
      isActive: true,
    });
    if (activeMappings === 0) continue;

    withMeta.push({
      id: v._id.toString(),
      code: v.code,
      name: v.name,
      rating: v.rating,
      ratingCount: v.ratingCount,
      distanceKm,
      deliveryEstimateMinutes: estimateDeliveryMinutes(distanceKm),
      deliveryFee,
      freeDeliveryThreshold,
      minimumOrderAmount,
      isOpen: vendorIsOpen(v.operatingHours),
      productCount: activeMappings,
      cuisineTags: Array.isArray(v.cuisineTags) ? v.cuisineTags : [],
      dietType: v.dietType === 'veg' || v.dietType === 'nonveg' || v.dietType === 'both' ? v.dietType : 'both',
      imageUrl: v.imageUrl || undefined,
      address: v.address,
    });
  }

  withMeta.sort((a, b) => {
    const da = a.distanceKm ?? 999;
    const db = b.distanceKm ?? 999;
    if (da !== db) return da - db;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.productCount - a.productCount;
  });

  const total = withMeta.length;
  const items = withMeta.slice((page - 1) * limit, page * limit);
  const location =
    input.lng !== undefined && input.lat !== undefined && total === 0
      ? locationInfoForVendorList({ inServiceArea: true, vendorCount: 0 })
      : undefined;
  return { items, total, location };
}

export async function getCustomerVendor(
  vendorId: string,
  lng?: number,
  lat?: number,
): Promise<CustomerVendorCard & { status: string }> {
  if (!mongoose.Types.ObjectId.isValid(vendorId)) throw new NotFoundError('Vendor not found');
  const vendor = await VendorModel.findById(vendorId).lean();
  if (!vendor || vendor.status !== 'ACTIVE') throw new NotFoundError('Vendor not found');

  let distanceKm: number | undefined;
  if (lng !== undefined && lat !== undefined) {
    const zone = await isCustomerInAllowedServiceArea(lng, lat);
    if (!zone.allowed) throw new NotFoundError('Vendor not serviceable at your location');
    const maxRadiusKm = await getVendorSearchRadiusKm();
    const deliverable = isWithinVendorDeliveryRadius(lng, lat, vendor);
    if (
      !deliverable.ok ||
      (!vendor.serviceAreaWideDelivery &&
        !isWithinVendorDiscoveryRadius(deliverable.distanceKm, vendor, maxRadiusKm))
    ) {
      throw new NotFoundError('Vendor not serviceable at your location');
    }
    distanceKm = deliverable.distanceKm;
  }

  const productCount = await VendorProductModel.countDocuments({ vendorId: vendor._id, isActive: true });
  const deliveryFee = await getConfigValue<number>('delivery.defaultFee', 0);
  const freeDeliveryThreshold = await getConfigValue<number>('delivery.freeThreshold', 499);
  const minimumOrderAmount = await getConfigValue<number>('order.minValue', 100);

  return {
    id: vendor._id.toString(),
    code: vendor.code,
    name: vendor.name,
    rating: vendor.rating,
    ratingCount: vendor.ratingCount,
    status: vendor.status,
    distanceKm,
    deliveryEstimateMinutes: estimateDeliveryMinutes(distanceKm),
    deliveryFee,
    freeDeliveryThreshold,
    minimumOrderAmount,
    isOpen: vendorIsOpen(vendor.operatingHours),
    productCount,
    cuisineTags: Array.isArray(vendor.cuisineTags) ? vendor.cuisineTags : [],
    dietType:
      vendor.dietType === 'veg' || vendor.dietType === 'nonveg' || vendor.dietType === 'both'
        ? vendor.dietType
        : 'both',
    imageUrl: vendor.imageUrl || undefined,
    address: vendor.address,
  };
}

export type VendorProductListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: string;
  lng?: number;
  lat?: number;
  diet?: 'veg' | 'nonveg';
};

export async function listVendorStoreProducts(
  vendorId: string,
  filters: VendorProductListFilters,
): Promise<{ items: VendorStoreProductCard[]; total: number; categories: Array<{ id: string; name: { en: string; ta?: string } }> }> {
  if (!mongoose.Types.ObjectId.isValid(vendorId)) throw new NotFoundError('Vendor not found');
  const vendor = await VendorModel.findById(vendorId).lean();
  if (!vendor || vendor.status !== 'ACTIVE') throw new NotFoundError('Vendor not found');

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(48, Math.max(1, filters.limit ?? 20));

  const vendorOid = new mongoose.Types.ObjectId(vendorId);
  const mappings = await VendorProductModel.find({ vendorId: vendorOid, isActive: true }).lean();
  if (!mappings.length) {
    return { items: [], total: 0, categories: [] };
  }

  const productIds = [...new Set(mappings.map((m) => m.productId.toString()))];
  const products = await ProductModel.find({ _id: { $in: productIds }, status: 'ACTIVE' }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const variantIds = mappings.map((m) => m.variantId);
  const variants = await ProductVariantModel.find({ _id: { $in: variantIds }, status: 'ACTIVE' }).lean();
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  const inventories = await InventoryModel.find({ vendorId: vendorOid, variantId: { $in: variantIds } }).lean();
  const inventoryMap = new Map(inventories.map((i) => [i.variantId.toString(), i]));

  let distanceKm: number | undefined;
  if (filters.lng !== undefined && filters.lat !== undefined) {
    const [vlng, vlat] = vendor.location.coordinates;
    distanceKm = haversineKm(filters.lng, filters.lat, vlng, vlat);
  }
  const deliveryEstimateMinutes = estimateDeliveryMinutes(distanceKm);

  const cards: VendorStoreProductCard[] = [];
  for (const mapping of mappings) {
    const product = productMap.get(mapping.productId.toString());
    const variant = variantMap.get(mapping.variantId.toString());
    if (!product || !variant) continue;

    if (filters.categoryId && product.categoryId.toString() !== filters.categoryId) continue;
    if (filters.brand && product.brand?.toLowerCase() !== filters.brand.toLowerCase()) continue;
    if (filters.minPrice !== undefined && mapping.sellingPrice < filters.minPrice) continue;
    if (filters.maxPrice !== undefined && mapping.sellingPrice > filters.maxPrice) continue;
    if (
      (filters.diet === 'veg' || filters.diet === 'nonveg') &&
      !productMatchesDietFilter(product.dietType, filters.diet, product.name?.en)
    ) {
      continue;
    }

    if (filters.search?.trim()) {
      const terms = filters.search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 1);
      const hay = [
        product.name?.en,
        product.name?.ta,
        product.brand,
        product.sku,
        ...(product.searchKeywords ?? []),
        variant.name?.en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      // Soft AND: every term must appear somewhere in the dish text
      if (terms.length && !terms.every((t) => hay.includes(t))) continue;
    }

    const inv = inventoryMap.get(mapping.variantId.toString());
    const availableQuantity = inv?.available ?? 0;
    const inStock = availableQuantity > 0;
    if (filters.inStockOnly && !inStock) continue;

    const priceFields = await resolveVendorProductDisplayPrice({
      vendorId,
      variantId: mapping.variantId.toString(),
      mrp: mapping.mrp,
      sellingPrice: mapping.sellingPrice,
      lng: filters.lng,
      lat: filters.lat,
    });

    cards.push({
      vendorProductId: mapping._id.toString(),
      vendorId,
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      name: product.name,
      brand: product.brand,
      imageUrl: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
      unitLabel: variant.name?.en,
      categoryId: product.categoryId.toString(),
      mrp: priceFields.mrp,
      sellingPrice: priceFields.sellingPrice,
      finalUnitPrice: priceFields.finalUnitPrice,
      displayPrice: priceFields.displayPrice,
      actualPrice: priceFields.actualPrice,
      discountPercent: priceFields.discountPercent,
      availableQuantity,
      inStock,
      deliveryEstimateMinutes,
      dietType: resolveProductDietType({ dietType: product.dietType, name: product.name?.en }),
    });
  }

  const sort = filters.sort ?? 'recommended';
  cards.sort((a, b) => {
    switch (sort) {
      case 'price_low_to_high':
        return a.finalUnitPrice - b.finalUnitPrice;
      case 'price_high_to_low':
        return b.finalUnitPrice - a.finalUnitPrice;
      case 'discount':
        return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      case 'newest':
        return b.vendorProductId.localeCompare(a.vendorProductId);
      case 'popular': {
        const soldA = inventoryMap.get(a.variantId)?.sold ?? 0;
        const soldB = inventoryMap.get(b.variantId)?.sold ?? 0;
        return soldB - soldA;
      }
      case 'rating':
        return vendor.rating - vendor.rating;
      default:
        return (b.discountPercent ?? 0) - (a.discountPercent ?? 0) || a.finalUnitPrice - b.finalUnitPrice;
    }
  });

  const categoryIds = [...new Set(cards.map((c) => c.categoryId).filter(Boolean))] as string[];
  const { CategoryModel } = await import('../categories/category.model.js');
  const categoryDocs = await CategoryModel.find({ _id: { $in: categoryIds }, isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  const categories = categoryDocs.map((c) => ({
    id: c._id.toString(),
    name: c.name,
  }));

  const total = cards.length;
  const items = cards.slice((page - 1) * limit, page * limit);
  return { items, total, categories };
}

export async function getVendorStoreProduct(
  vendorId: string,
  vendorProductId: string,
  lng?: number,
  lat?: number,
): Promise<VendorStoreProductDetail> {
  if (!mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(vendorProductId)) {
    throw new NotFoundError('Vendor product not found');
  }

  const mapping = await VendorProductModel.findOne({
    _id: vendorProductId,
    vendorId,
    isActive: true,
  }).lean();
  if (!mapping) throw new NotFoundError('Vendor product not found');

  const [vendor, product, variant] = await Promise.all([
    VendorModel.findById(vendorId).lean(),
    ProductModel.findById(mapping.productId).lean(),
    ProductVariantModel.findById(mapping.variantId).lean(),
  ]);
  if (!vendor || vendor.status !== 'ACTIVE') throw new NotFoundError('Vendor not found');
  if (!product || product.status !== 'ACTIVE') throw new NotFoundError('Product not found');
  if (!variant || variant.status !== 'ACTIVE') throw new NotFoundError('Variant not found');

  const inv = await InventoryModel.findOne({ vendorId, variantId: mapping.variantId }).lean();
  const availableQuantity = inv?.available ?? 0;

  const priceFields = await resolveVendorProductDisplayPrice({
    vendorId,
    variantId: mapping.variantId.toString(),
    mrp: mapping.mrp,
    sellingPrice: mapping.sellingPrice,
    lng,
    lat,
  });

  const [vlng, vlat] = vendor.location.coordinates;
  const distanceKm = lng !== undefined && lat !== undefined ? haversineKm(lng, lat, vlng, vlat) : undefined;

  return {
    vendorProductId: mapping._id.toString(),
    vendorId,
    productId: product._id.toString(),
    variantId: variant._id.toString(),
    name: product.name,
    brand: product.brand,
    description: product.description,
    productSlug: product.slug,
    variantName: variant.name,
    imageUrl: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
    unitLabel: variant.name?.en,
    categoryId: product.categoryId.toString(),
    mrp: priceFields.mrp,
    sellingPrice: priceFields.sellingPrice,
    finalUnitPrice: priceFields.finalUnitPrice,
    displayPrice: priceFields.displayPrice,
    discountPercent: priceFields.discountPercent,
    availableQuantity,
    inStock: availableQuantity > 0,
    deliveryEstimateMinutes: estimateDeliveryMinutes(distanceKm, mapping.preparationMinutes ?? 30),
    vendorName: vendor.name,
  };
}
