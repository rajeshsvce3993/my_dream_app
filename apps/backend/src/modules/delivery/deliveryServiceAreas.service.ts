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
  active: z.boolean().optional(),
});

export const deliveryServiceAreasSchema = z.array(areaSchema);

export type DeliveryServiceArea = z.infer<typeof areaSchema>;

export async function getDeliveryServiceAreas(): Promise<DeliveryServiceArea[]> {
  const doc = await ConfigurationModel.findOne({ key: DELIVERY_SERVICE_AREAS_KEY }).lean();
  if (!doc) {
    return DEFAULT_DELIVERY_SERVICE_AREAS.filter((a) => a.active !== false);
  }
  const parsed = deliveryServiceAreasSchema.safeParse(doc.value);
  if (!parsed.success) {
    return DEFAULT_DELIVERY_SERVICE_AREAS.filter((a) => a.active !== false);
  }
  // Admin saved an empty list = no platform restriction.
  if (parsed.data.length === 0) {
    return [];
  }
  return parsed.data.filter((a) => a.active !== false);
}

/** If no zones configured, all locations are allowed at platform level. */
export async function isCustomerInAllowedServiceArea(lng: number, lat: number): Promise<{
  allowed: boolean;
  matchedArea?: DeliveryServiceArea;
  areas: DeliveryServiceArea[];
}> {
  const areas = await getDeliveryServiceAreas();
  if (!areas.length) {
    return { allowed: true, areas: [] };
  }
  for (const area of areas) {
    const distanceKm = haversineKm(lng, lat, area.longitude, area.latitude);
    if (distanceKm <= area.radiusKm) {
      return { allowed: true, matchedArea: area, areas };
    }
  }
  return { allowed: false, areas };
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
