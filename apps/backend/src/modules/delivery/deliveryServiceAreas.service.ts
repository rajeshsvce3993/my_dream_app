import { z } from 'zod';
import { BusinessRuleError } from '../../common/errors/AppError.js';
import { ConfigurationModel } from '../configuration/configuration.model.js';
import { DEFAULT_DELIVERY_SERVICE_AREAS } from './deliveryServiceAreas.defaults.js';
import { haversineKm } from '../vendors/vendorDelivery.service.js';
import type { LocationAvailabilityInfo } from './locationAvailability.js';
import { locationInfoForVendorList } from './locationAvailability.js';
import { OutsideServiceAreaError } from './outsideServiceArea.error.js';

export const DELIVERY_SERVICE_AREAS_KEY = 'delivery.serviceAreas';

const areaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.5).max(500),
  /** Extra km past this zone’s edge where a rider may wait and still take its orders. */
  outsideKm: z.number().min(0).max(100).default(0),
  active: z.boolean().optional(),
  /** Two-digit code used in order numbers, e.g. 01. Assigned from list order when omitted. */
  code: z.string().regex(/^\d{2,3}$/).optional(),
});

export const deliveryServiceAreasSchema = z.array(areaSchema);

export type DeliveryServiceArea = z.infer<typeof areaSchema>;

function withAreaCodes(areas: DeliveryServiceArea[]): DeliveryServiceArea[] {
  return areas.map((area, index) => ({
    ...area,
    code: area.code?.padStart(2, '0') || String(index + 1).padStart(2, '0'),
  }));
}

async function readDeliveryServiceAreas(): Promise<DeliveryServiceArea[]> {
  const doc = await ConfigurationModel.findOne({ key: DELIVERY_SERVICE_AREAS_KEY }).lean();
  if (!doc) return withAreaCodes(DEFAULT_DELIVERY_SERVICE_AREAS);
  const parsed = deliveryServiceAreasSchema.safeParse(doc.value);
  if (!parsed.success) return withAreaCodes(DEFAULT_DELIVERY_SERVICE_AREAS);
  return withAreaCodes(parsed.data);
}

export async function getDeliveryServiceAreas(): Promise<DeliveryServiceArea[]> {
  const areas = await readDeliveryServiceAreas();
  // Admin saved an empty list = no platform restriction.
  if (!areas.length) return [];
  return areas.filter((area) => area.active !== false);
}

export function isPointInsideLaunchArea(
  lng: number,
  lat: number,
  area: DeliveryServiceArea,
): boolean {
  return haversineKm(lng, lat, area.longitude, area.latitude) <= area.radiusKm;
}

/** Rider may wait `area.outsideKm` past this circle and still take orders for it. */
export function isPointWithinRiderReach(
  lng: number,
  lat: number,
  area: DeliveryServiceArea,
): boolean {
  const extra = Math.max(0, area.outsideKm ?? 0);
  return haversineKm(lng, lat, area.longitude, area.latitude) <= area.radiusKm + extra;
}

/**
 * If no zones are saved, every location is allowed.
 * Otherwise the point must fall inside at least one active zone.
 * `matchedAreas` are the zones that contain this point — restaurants must sit in one of those same circles.
 */
export async function isCustomerInAllowedServiceArea(lng: number, lat: number): Promise<{
  allowed: boolean;
  unrestricted: boolean;
  matchedArea?: DeliveryServiceArea;
  matchedAreas: DeliveryServiceArea[];
  areas: DeliveryServiceArea[];
}> {
  const areas = await getDeliveryServiceAreas();
  if (!areas.length) {
    return { allowed: true, unrestricted: true, matchedAreas: [], areas: [] };
  }
  const matchedAreas = areas.filter((area) => isPointInsideLaunchArea(lng, lat, area));
  if (matchedAreas.length) {
    return {
      allowed: true,
      unrestricted: false,
      matchedArea: matchedAreas[0],
      matchedAreas,
      areas,
    };
  }
  return { allowed: false, unrestricted: false, matchedAreas: [], areas };
}

/** Restaurant coordinates must be inside a launch zone that also contains the customer. */
export function vendorSharesCustomerLaunchArea(
  vendorLng: number,
  vendorLat: number,
  matchedAreas: DeliveryServiceArea[],
): boolean {
  if (!matchedAreas.length) return true;
  return matchedAreas.some((area) => isPointInsideLaunchArea(vendorLng, vendorLat, area));
}

export async function getLocationAvailabilityForCustomer(
  lng: number,
  lat: number,
): Promise<LocationAvailabilityInfo> {
  const zone = await isCustomerInAllowedServiceArea(lng, lat);
  if (!zone.allowed) {
    return locationInfoForVendorList({ inServiceArea: false, vendorCount: 0 });
  }
  return { inServiceArea: true, reason: 'IN_SERVICE_AREA' };
}

export async function assertCustomerInServiceArea(lng: number, lat: number): Promise<void> {
  const zone = await isCustomerInAllowedServiceArea(lng, lat);
  if (!zone.allowed) {
    throw new OutsideServiceAreaError();
  }
}

export function validateDeliveryServiceAreasConfig(value: unknown): DeliveryServiceArea[] {
  const parsed = deliveryServiceAreasSchema.safeParse(value);
  if (!parsed.success) {
    throw new BusinessRuleError('Invalid delivery.serviceAreas JSON');
  }
  return parsed.data;
}
