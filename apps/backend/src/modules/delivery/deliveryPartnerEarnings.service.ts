import { z } from 'zod';
import { roundToPaisa } from '../../common/money.util.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { OrderModel } from '../orders/order.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { haversineKm } from '../vendors/vendorDelivery.service.js';

export const PARTNER_EARNINGS_KEY = 'delivery.partnerEarnings';

export type PartnerEarnings = {
  /** Distance covered by the base earning. Example: 3 means 0–3 km. */
  baseKm: number;
  baseCharge: number;
  /** Added for each started kilometre beyond baseKm. */
  perKmCharge: number;
};

const partnerEarningsSchema = z.object({
  baseKm: z.coerce.number().min(0).max(100),
  baseCharge: z.coerce.number().min(0).max(10000),
  perKmCharge: z.coerce.number().min(0).max(1000),
});

export function parsePartnerEarnings(value: unknown): PartnerEarnings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return partnerEarningsSchema.parse({
    baseKm: raw.baseKm ?? 3,
    baseCharge: raw.baseCharge ?? 0,
    perKmCharge: raw.perKmCharge ?? 0,
  });
}

export function quotePartnerEarning(
  charges: PartnerEarnings,
  distanceKm: number | null | undefined,
): number {
  const base = Math.max(0, charges.baseCharge);
  const perKm = Math.max(0, charges.perKmCharge);
  const baseKm = Math.max(0, charges.baseKm);
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= baseKm) return base;
  const extraKm = Math.ceil(distanceKm - baseKm - 1e-6);
  return roundToPaisa(base + extraKm * perKm);
}

export async function getPartnerEarnings(): Promise<PartnerEarnings | null> {
  const saved = await getConfigValue<unknown>(PARTNER_EARNINGS_KEY, null);
  if (!saved || typeof saved !== 'object') return null;
  try {
    return parsePartnerEarnings(saved);
  } catch {
    return null;
  }
}

async function legacyEarning(shippingTotal: number): Promise<number> {
  try {
    const configured = await getConfigValue<number>('delivery.earningPerOrder', shippingTotal);
    const amount = Number(configured);
    return Number.isFinite(amount) && amount > 0 ? amount : shippingTotal;
  } catch {
    return shippingTotal;
  }
}

/** Sum of restaurant-to-customer earnings. Each restaurant is measured on its own. */
export async function quoteDeliveryEarning(order: {
  _id?: unknown;
  deliveryEarning?: number | null;
  shippingTotal?: number;
}): Promise<number> {
  const charges = await getPartnerEarnings();
  if (!charges) {
    if (order.deliveryEarning != null && Number.isFinite(order.deliveryEarning)) return order.deliveryEarning;
    return legacyEarning(order.shippingTotal ?? 0);
  }
  if (!order._id) return quotePartnerEarning(charges, null);

  const stored = await OrderModel.findById(order._id).select('deliveryAddress').lean();
  const drop = stored?.deliveryAddress?.location?.coordinates;
  const slices = await VendorOrderModel.find({ parentOrderId: order._id }).select('vendorId').lean();
  const vendors = slices.length
    ? await VendorModel.find({ _id: { $in: slices.map((slice) => slice.vendorId) } })
        .select('location')
        .lean()
    : [];
  if (!drop || drop.length < 2 || !vendors.length) return quotePartnerEarning(charges, null);

  const total = vendors.reduce((sum, vendor) => {
    const point = vendor.location?.coordinates;
    const distanceKm =
      point && point.length >= 2 ? haversineKm(point[0]!, point[1]!, drop[0]!, drop[1]!) : null;
    return sum + quotePartnerEarning(charges, distanceKm);
  }, 0);
  return roundToPaisa(total);
}
