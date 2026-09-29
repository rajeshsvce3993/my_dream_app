import { getConfigValue } from '../configuration/configuration.service.js';

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Radius within which the vendor accepts orders (km). */
export function getVendorDeliveryRadiusKm(vendor: { deliveryRadiusKm: number }): number {
  return Math.max(0, vendor.deliveryRadiusKm);
}

export async function getVendorSearchRadiusKm(): Promise<number> {
  return getConfigValue<number>('vendor.search.maxRadiusKm', 25);
}

/**
 * Customer can add to cart / checkout when within the vendor's delivery radius.
 */
export type VendorLocationPolicy = {
  location: { coordinates: [number, number] };
  deliveryRadiusKm: number;
  serviceAreaWideDelivery?: boolean;
};

export function isWithinVendorDeliveryRadius(
  customerLng: number,
  customerLat: number,
  vendor: VendorLocationPolicy,
): { ok: boolean; distanceKm: number } {
  const [vlng, vlat] = vendor.location.coordinates;
  const distanceKm = haversineKm(customerLng, customerLat, vlng, vlat);
  if (vendor.serviceAreaWideDelivery) {
    return { ok: true, distanceKm };
  }
  return {
    ok: distanceKm <= getVendorDeliveryRadiusKm(vendor),
    distanceKm,
  };
}

/**
 * "Stores near you" list — within delivery radius and optional platform search cap.
 */
export function isWithinVendorDiscoveryRadius(
  distanceKm: number,
  vendor: VendorLocationPolicy,
  maxSearchRadiusKm: number,
): boolean {
  if (vendor.serviceAreaWideDelivery) return true;
  const deliverable = distanceKm <= getVendorDeliveryRadiusKm(vendor);
  const withinSearchCap = distanceKm <= maxSearchRadiusKm;
  return deliverable && withinSearchCap;
}
