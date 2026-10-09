import mongoose from 'mongoose';
import { BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { roundToPaisa } from '../../common/money.util.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import {
  quoteVendorOffers,
  validateLinePrice,
  type VendorOfferQuote,
} from '../pricing/pricing.service.js';
import { computeCustomerUnitPrice } from '../pricing/customerUnitPrice.js';
import { VendorProductModel } from '../products/vendorProduct.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { CartModel } from './cart.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { assertCustomerInServiceArea } from '../delivery/deliveryServiceAreas.service.js';
import { foodProductIdSet, getFoodCharges, quoteFoodDeliveryCharge, vendorMenuGstPercent } from '../pricing/foodCharges.service.js';
import { haversineKm } from '../vendors/vendorDelivery.service.js';

export async function getOrCreateCustomerId(userId: string): Promise<string> {
  let customer = await CustomerModel.findOne({ userId });
  if (!customer) {
    customer = await CustomerModel.create({ userId });
  }
  return customer._id.toString();
}

export async function getCartForUser(userId: string) {
  const customerId = await getOrCreateCustomerId(userId);
  let cart = await CartModel.findOne({ customerId });
  if (!cart) {
    cart = await CartModel.create({ customerId, items: [] });
  }
  return cart;
}

/** Removes all items from the customer's cart (used when switching restaurants). */
export async function clearCartForUser(userId: string) {
  const cart = await getCartForUser(userId);
  cart.items = [] as typeof cart.items;
  await cart.save();
  return cart;
}

export async function addToCart(input: {
  userId: string;
  vendorId?: string;
  productId: string;
  variantId: string;
  vendorProductId?: string;
  quantity: number;
  lng?: number;
  lat?: number;
  deferAvailability?: boolean;
  /** When true, drop items from other restaurants before adding. */
  replaceCart?: boolean;
}) {
  if (input.quantity < 1) throw new BusinessRuleError('Invalid quantity');

  if (input.lng !== undefined && input.lat !== undefined) {
    await assertCustomerInServiceArea(input.lng, input.lat);
  }

  let vendorId = input.vendorId;
  let vendorProductId = input.vendorProductId;
  let availabilityPending = Boolean(input.deferAvailability);

  if (input.deferAvailability) {
    try {
      const pick = await quoteVendorOffers({
        variantId: input.variantId,
        quantity: input.quantity,
        customerLng: input.lng,
        customerLat: input.lat,
        skipLocationFilter: true,
        allowInsufficientStock: true,
        includeVendorProductIds: true,
      });
      const best = pick.vendors[0];
      if (best) {
        vendorId = best.vendorId;
        vendorProductId =
          pick.vendorProductIdMap.get(`${best.vendorId}:${best.variantId}`) ?? vendorProductId;
      }
    } catch {
      /* fall through to mapping lookup */
    }
    if (!vendorId) {
      const mapping = await VendorProductModel.findOne({
        variantId: input.variantId,
        isActive: true,
      })
        .sort({ updatedAt: -1 })
        .lean();
      if (!mapping) throw new BusinessRuleError('No vendor listing found for this product');
      vendorId = mapping.vendorId.toString();
      vendorProductId = mapping._id.toString();
    }
    availabilityPending = true;
  }

  if (!vendorId) throw new BusinessRuleError('vendorId is required');

  const [product, variant, vendor] = await Promise.all([
    ProductModel.findById(input.productId),
    ProductVariantModel.findById(input.variantId),
    VendorModel.findById(vendorId),
  ]);
  if (!product || product.status !== 'ACTIVE') throw new NotFoundError('Product not available');
  if (!variant || variant.status !== 'ACTIVE' || variant.productId.toString() !== product._id.toString()) {
    throw new BusinessRuleError('Invalid variant for product');
  }
  if (!vendor || vendor.status !== 'ACTIVE') throw new NotFoundError('Vendor not available');

  if (vendorProductId) {
    const vp = await VendorProductModel.findById(vendorProductId).lean();
    if (
      !vp ||
      !vp.isActive ||
      vp.vendorId.toString() !== vendorId ||
      vp.variantId.toString() !== input.variantId
    ) {
      throw new BusinessRuleError('Invalid vendor product for this offer');
    }
  }

  // Store availability / delivery radius is enforced at checkout, not when adding to cart.
  if (
    !availabilityPending &&
    input.lng !== undefined &&
    input.lat !== undefined &&
    vendorId
  ) {
    const atLocation = await quoteVendorOffers({
      variantId: input.variantId,
      quantity: input.quantity,
      customerLng: input.lng,
      customerLat: input.lat,
      vendorIds: [vendorId],
    }).catch(() => null);
    if (!atLocation?.vendors.length) {
      availabilityPending = true;
    }
  }

  const cart = await getCartForUser(input.userId);

  // One restaurant per cart — never mix vendors.
  const hasOtherVendor = cart.items.some((i) => i.vendorId.toString() !== vendorId);
  if (hasOtherVendor) {
    if (!input.replaceCart) {
      throw new BusinessRuleError(
        'CART_OTHER_RESTAURANT: Your cart has items from another restaurant. Clear your cart to order from this restaurant.',
      );
    }
    cart.items = cart.items.filter(
      (i) => i.vendorId.toString() === vendorId,
    ) as typeof cart.items;
  }

  const idx = cart.items.findIndex(
    (i) =>
      i.vendorId.toString() === vendorId &&
      i.variantId.toString() === input.variantId,
  );

  if (idx >= 0) {
    cart.items[idx].quantity += input.quantity;
    if (vendorProductId) {
      cart.items[idx].vendorProductId = new mongoose.Types.ObjectId(vendorProductId);
    }
    if (availabilityPending) cart.items[idx].availabilityPending = true;
  } else {
    cart.items.push({
      vendorId: vendor._id,
      productId: product._id,
      variantId: variant._id,
      vendorProductId: vendorProductId
        ? new mongoose.Types.ObjectId(vendorProductId)
        : undefined,
      quantity: input.quantity,
      availabilityPending,
    } as (typeof cart.items)[0]);
  }

  if (input.lng !== undefined && input.lat !== undefined) {
    cart.deliveryLocation = { type: 'Point', coordinates: [input.lng, input.lat] };
  }

  await cart.save();
  return cart;
}

async function quoteForCartLine(input: {
  vendorId: string;
  variantId: string;
  quantity: number;
  customerLng?: number;
  customerLat?: number;
  availabilityPending?: boolean;
}): Promise<VendorOfferQuote> {
  if (!input.availabilityPending) {
    try {
      return await validateLinePrice({
        vendorId: input.vendorId,
        variantId: input.variantId,
        quantity: input.quantity,
        customerLng: input.customerLng,
        customerLat: input.customerLat,
      });
    } catch (err) {
      const business =
        err instanceof BusinessRuleError ||
        (err instanceof Error && err.name === 'OutsideServiceAreaError');
      if (!business) throw err;
    }
  }

  const relaxed = await quoteVendorOffers({
    variantId: input.variantId,
    quantity: input.quantity,
    vendorIds: [input.vendorId],
    customerLng: input.customerLng,
    customerLat: input.customerLat,
    skipLocationFilter: true,
    allowInsufficientStock: true,
  }).catch(() => null);

  const fromQuote = relaxed?.vendors.find((v) => v.vendorId === input.vendorId) ?? relaxed?.vendors[0];
  if (fromQuote) return fromQuote;

  const mapping = await VendorProductModel.findOne({
    vendorId: input.vendorId,
    variantId: input.variantId,
    isActive: true,
  }).lean();
  const vendor = await VendorModel.findById(input.vendorId).lean();
  if (!mapping || !vendor) {
    throw new BusinessRuleError('Unable to price this cart item');
  }

  const variant = await ProductVariantModel.findById(input.variantId).select('productId').lean();
  const foodIds = variant ? await foodProductIdSet([variant.productId.toString()]) : new Set<string>();
  const taxRate = variant && foodIds.has(variant.productId.toString())
    ? vendorMenuGstPercent(vendor)
    : await getConfigValue<number>('tax.defaultRate', 0);
  const { taxAmount, finalUnitPrice } = computeCustomerUnitPrice({
    sellingPrice: mapping.sellingPrice,
    offerDiscount: 0,
    taxRatePercent: taxRate,
  });

  return {
    vendorId: input.vendorId,
    vendorName: vendor.name,
    variantId: input.variantId,
    vendorPrice: mapping.vendorPrice,
    mrp: mapping.mrp,
    sellingPrice: mapping.sellingPrice,
    discountAmount: Math.max(0, mapping.mrp - mapping.sellingPrice),
    offerDiscount: 0,
    taxAmount,
    finalUnitPrice,
    availableQuantity: 0,
    rating: vendor.rating,
    score: 0,
  };
}

export async function recalculateCart(cartId: string) {
  const cart = await CartModel.findById(cartId);
  if (!cart) throw new NotFoundError('Cart not found');

  if (!cart.items.length) {
    return {
      cart,
      lines: [],
      vendorGroups: [],
      vendorCount: 0,
      subtotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      platformFee: 0,
      grandTotal: 0,
      vendorShipping: [],
      insights: [],
    };
  }

  const lng = cart.deliveryLocation?.coordinates[0];
  const lat = cart.deliveryLocation?.coordinates[1];

  const itemsByVendor = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const key = item.vendorId.toString();
    if (!itemsByVendor.has(key)) itemsByVendor.set(key, []);
    itemsByVendor.get(key)!.push(item);
  }

  const lines = await Promise.all(
    cart.items.map(async (item) => {
      const [product, variant, vendor] = await Promise.all([
        ProductModel.findById(item.productId).lean(),
        ProductVariantModel.findById(item.variantId).lean(),
        VendorModel.findById(item.vendorId).lean(),
      ]);
      const quote = await quoteForCartLine({
        vendorId: item.vendorId.toString(),
        variantId: item.variantId.toString(),
        quantity: item.quantity,
        customerLng: lng,
        customerLat: lat,
        availabilityPending: Boolean(item.availabilityPending),
      });
      return {
        vendorId: item.vendorId.toString(),
        vendorName: vendor?.name ?? quote.vendorName,
        productId: item.productId.toString(),
        productName: product?.name ?? { en: 'Product' },
        variantId: item.variantId.toString(),
        variantName: variant?.name ?? { en: 'Variant' },
        imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
        quantity: item.quantity,
        unitPrice: quote.finalUnitPrice,
        mrp: quote.mrp,
        sellingPrice: quote.sellingPrice,
        taxAmount: roundToPaisa(quote.taxAmount * item.quantity),
        lineTotal: quote.finalUnitPrice * item.quantity,
      };
    }),
  );

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const [foodCharges, foodProducts] = await Promise.all([
    getFoodCharges(),
    foodProductIdSet(lines.map((line) => line.productId)),
  ]);
  const vendorDocs = await VendorModel.find({ _id: { $in: [...itemsByVendor.keys()] } })
    .select('location')
    .lean();
  const vendorPoint = new Map(
    vendorDocs.map((vendor) => [vendor._id.toString(), vendor.location?.coordinates as [number, number] | undefined]),
  );
  const drop = cart.deliveryLocation?.coordinates;
  const shippingPerVendor = [...itemsByVendor.keys()].map((vendorId) => {
    const hasFood = lines.some((line) => line.vendorId === vendorId && foodProducts.has(line.productId));
    if (!hasFood) return { vendorId, fee: 0 };
    const restaurant = vendorPoint.get(vendorId);
    const distanceKm =
      drop && drop.length >= 2 && restaurant && restaurant.length >= 2
        ? haversineKm(drop[0], drop[1], restaurant[0], restaurant[1])
        : null;
    return { vendorId, fee: quoteFoodDeliveryCharge(foodCharges, distanceKm) };
  });
  const shippingTotal = shippingPerVendor.reduce((s, v) => s + v.fee, 0);

  const vendorGroups = [...itemsByVendor.keys()].map((vendorId) => {
    const groupLines = lines.filter((l) => l.vendorId === vendorId);
    return {
      vendorId,
      vendorName: groupLines[0]?.vendorName ?? vendorId,
      itemCount: groupLines.reduce((s, l) => s + l.quantity, 0),
      subtotal: groupLines.reduce((s, l) => s + l.lineTotal, 0),
      lines: groupLines,
    };
  });

  const currency = await getConfigValue<string>('currency.symbol', '₹');
  const insights: Array<
    | { type: 'FREE_DELIVERY_GAP'; amountRemaining: number; currency: string }
    | { type: 'MULTI_VENDOR'; vendorCount: number }
    | { type: 'SAVINGS'; amount: number; currency: string }
  > = [];
  if (vendorGroups.length > 1) {
    insights.push({ type: 'MULTI_VENDOR', vendorCount: vendorGroups.length });
  }
  const savings = lines.reduce((s, l) => {
    const unitBeforeTax = l.quantity > 0 ? (l.lineTotal - l.taxAmount) / l.quantity : 0;
    return s + Math.max(0, l.mrp - unitBeforeTax) * l.quantity;
  }, 0);
  if (savings > 0) insights.push({ type: 'SAVINGS', amount: savings, currency });

  const platformFee = lines.some((line) => foodProducts.has(line.productId)) ? foodCharges.platformFee : 0;

  return {
    cart,
    lines,
    vendorGroups,
    vendorCount: vendorGroups.length,
    subtotal,
    shippingTotal,
    discountTotal: lines.reduce((s, l) => s + Math.max(0, l.mrp - l.sellingPrice) * l.quantity, 0),
    taxTotal: roundToPaisa(lines.reduce((s, l) => s + l.taxAmount, 0)),
    platformFee,
    grandTotal: subtotal + shippingTotal + platformFee,
    vendorShipping: shippingPerVendor,
    insights,
  };
}
