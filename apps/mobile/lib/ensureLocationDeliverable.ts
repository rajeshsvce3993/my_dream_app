import { apiRequest } from './api';
import { createOutsideServiceAreaError } from './locationMessages';
import type { AppLocation } from './location';

export type LocationStatus = {
  inServiceArea: boolean;
  reason: string;
  serviceAreaTitle?: string;
  serviceAreaMessage?: string;
};

export async function fetchLocationStatus(
  location: Pick<AppLocation, 'lng' | 'lat'>,
): Promise<LocationStatus> {
  return apiRequest<LocationStatus>(
    `/delivery/location-status?lng=${location.lng}&lat=${location.lat}`,
  );
}

/** Throws with the standard service-area alert copy when delivery zones block this address. */
export async function ensureLocationDeliverable(
  location: Pick<AppLocation, 'lng' | 'lat'>,
): Promise<void> {
  const status = await fetchLocationStatus(location);
  if (!status.inServiceArea) {
    throw createOutsideServiceAreaError({
      title: status.serviceAreaTitle,
      body: status.serviceAreaMessage,
    });
  }
}
