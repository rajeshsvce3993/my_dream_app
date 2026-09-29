import { NotFoundError } from '../../common/errors/AppError.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { isCustomerInAllowedServiceArea } from '../delivery/deliveryServiceAreas.service.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { discountPercentFromMrp } from './productCardPricing.js';
import { getVariantListPrice } from '../products/variantListPrice.service.js';
import { quoteVendorOffers, type VendorOfferQuote } from '../pricing/pricing.service.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { filterCheaperVendorOffers, resolveVendorPickDecision } from './addToCartVendorPick.util.js';

export type AddToCartFlowStatus =
  | 'NO_DELIVERY_ADDRESS'
  | 'OUTSIDE_SERVICE_AREA'
  | 'NO_VENDORS'
  | 'SELECT_VENDOR';

export type AddToCartFlowVendorOffer = VendorOfferQuote & {
  vendorProductId: string;
  deliveryFee: number;
  isOpen: boolean;
  discountPercent?: number;
};

export type AddToCartFlowResult = {
  status: AddToCartFlowStatus;
  productId: string;
  variantId: string;
  /** Product reference MRP for discount display. */
  actualPrice?: number;
  quantity: number;
  messages?: { title?: string; body?: string };
  vendors: AddToCartFlowVendorOffer[];
  recommendedVendorId: string | null;
  /** When false, client adds using autoVendorId without compare sheet. */
  showVendorCompare: boolean;
  autoVendorId: string | null;
  /** Selected / current store when compare is shown (not duplicated in vendors list). */
  referenceVendor?: AddToCartFlowVendorOffer;
  canDeferAvailability: boolean;
};

const MSG_OUTSIDE = {
  title: 'We don’t deliver to this location yet 📍',
  body: 'Your current address is outside our delivery area. Change your location to see stores and products available near you.',
};

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

async function enrichVendorOffers(
  quotes: VendorOfferQuote[],
  vendorProductIds: Map<string, string>,
  actualPrice?: number,
): Promise<AddToCartFlowVendorOffer[]> {
  const deliveryFee = await getConfigValue<number>('delivery.defaultFee', 0);
  const vendorIds = quotes.map((q) => q.vendorId);
  const vendors = await VendorModel.find({ _id: { $in: vendorIds } }).lean();
  const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));

  return quotes.map((q) => {
    const vendor = vendorMap.get(q.vendorId);
    const reference = actualPrice ?? q.mrp;
    const discountPercent = discountPercentFromMrp(reference, q.finalUnitPrice);
    return {
      ...q,
      vendorProductId: vendorProductIds.get(`${q.vendorId}:${q.variantId}`) ?? '',
      deliveryFee,
      isOpen: vendorIsOpen(vendor?.operatingHours),
      discountPercent,
    };
  });
}

export async function evaluateAddToCartFlow(input: {
  productId: string;
  variantId?: string;
  quantity?: number;
  lng?: number;
  lat?: number;
  hasDeliveryAddress: boolean;
  contextVendorId?: string;
}): Promise<AddToCartFlowResult> {
  const quantity = input.quantity ?? 1;
  const product = await ProductModel.findById(input.productId).lean();
  if (!product || product.status !== 'ACTIVE') throw new NotFoundError('Product not found');

  const variant = input.variantId
    ? await ProductVariantModel.findById(input.variantId).lean()
    : await ProductVariantModel.findOne({ productId: product._id, status: 'ACTIVE' })
        .sort({ sortOrder: 1 })
        .lean();
  if (!variant || variant.status !== 'ACTIVE') throw new NotFoundError('Variant not available');

  const base = {
    productId: product._id.toString(),
    variantId: variant._id.toString(),
    quantity,
    vendors: [] as AddToCartFlowVendorOffer[],
    recommendedVendorId: null as string | null,
    showVendorCompare: false,
    autoVendorId: null as string | null,
    canDeferAvailability: true,
  };

  if (!input.hasDeliveryAddress || input.lng === undefined || input.lat === undefined) {
    return { ...base, status: 'NO_DELIVERY_ADDRESS' };
  }

  const zone = await isCustomerInAllowedServiceArea(input.lng, input.lat);
  if (!zone.allowed) {
    return {
      ...base,
      status: 'OUTSIDE_SERVICE_AREA',
      messages: MSG_OUTSIDE,
      canDeferAvailability: false,
    };
  }

  let comparison;
  try {
    comparison = await quoteVendorOffers({
      variantId: variant._id.toString(),
      quantity,
      customerLng: input.lng,
      customerLat: input.lat,
      includeVendorProductIds: true,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return {
        ...base,
        status: 'NO_VENDORS',
        vendors: [],
      };
    }
    throw err;
  }

  const actualPrice = await getVariantListPrice(variant._id.toString());
  const vendors = await enrichVendorOffers(
    comparison.vendors,
    comparison.vendorProductIdMap,
    actualPrice,
  );

  if (!vendors.length) {
    return {
      ...base,
      status: 'NO_VENDORS',
      vendors: [],
    };
  }

  const recommendedVendorId =
    comparison.bestOverallVendorId ?? comparison.cheapestVendorId ?? vendors[0]?.vendorId ?? null;

  const pick = resolveVendorPickDecision({
    vendors,
    contextVendorId: input.contextVendorId,
    cheapestVendorId: comparison.cheapestVendorId,
  });

  const referenceVendor =
    pick.autoVendorId != null ? vendors.find((v) => v.vendorId === pick.autoVendorId) : undefined;

  const responseVendors =
    pick.showVendorCompare && referenceVendor
      ? filterCheaperVendorOffers(vendors, referenceVendor.vendorId)
      : vendors;

  if (pick.showVendorCompare && referenceVendor && responseVendors.length === 0) {
    return {
      ...base,
      status: 'SELECT_VENDOR',
      actualPrice,
      vendors,
      recommendedVendorId,
      showVendorCompare: false,
      autoVendorId: referenceVendor.vendorId,
      canDeferAvailability: false,
    };
  }

  return {
    ...base,
    status: 'SELECT_VENDOR',
    actualPrice,
    vendors: responseVendors,
    recommendedVendorId,
    showVendorCompare: pick.showVendorCompare,
    autoVendorId: pick.autoVendorId,
    referenceVendor: pick.showVendorCompare ? referenceVendor : undefined,
    canDeferAvailability: false,
  };
}
