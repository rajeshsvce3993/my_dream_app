import { Alert } from 'react-native';

export type LocationAvailabilityMeta = {
  inServiceArea: boolean;
  reason: 'IN_SERVICE_AREA' | 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS_NEARBY';
  serviceAreaTitle?: string;
  serviceAreaMessage?: string;
  vendorListEmptyMessage?: string;
};

export const SERVICE_AREA_TITLE = 'We don’t deliver to this location yet 📍';

export const SERVICE_AREA_BODY =
  'Your current address is outside our delivery area. Change your location to see stores and products available near you.';

export class OutsideServiceAreaError extends Error {
  readonly alertTitle: string;

  constructor(title: string = SERVICE_AREA_TITLE, body: string = SERVICE_AREA_BODY) {
    super(body);
    this.name = 'OutsideServiceAreaError';
    this.alertTitle = title;
  }
}

export function createOutsideServiceAreaError(overrides?: {
  title?: string;
  body?: string;
}): OutsideServiceAreaError {
  return new OutsideServiceAreaError(
    overrides?.title ?? SERVICE_AREA_TITLE,
    overrides?.body ?? SERVICE_AREA_BODY,
  );
}

export function isOutsideServiceAreaError(err: unknown): err is OutsideServiceAreaError {
  return (
    err instanceof OutsideServiceAreaError ||
    (err instanceof Error && err.name === 'OutsideServiceAreaError')
  );
}

export function showOutsideServiceAreaAlert(err?: OutsideServiceAreaError): void {
  Alert.alert(err?.alertTitle ?? SERVICE_AREA_TITLE, err?.message ?? SERVICE_AREA_BODY);
}

export function isOutsideServiceAreaProduct(product: {
  availabilityReason?: string;
  labels?: string[];
}): boolean {
  return (
    product.availabilityReason === 'OUTSIDE_SERVICE_AREA' ||
    Boolean(product.labels?.includes('outside_service_area'))
  );
}

export function serviceAreaCopy(
  location?: Pick<LocationAvailabilityMeta, 'serviceAreaTitle' | 'serviceAreaMessage'>,
): { title: string; body: string } {
  return {
    title: location?.serviceAreaTitle ?? SERVICE_AREA_TITLE,
    body: location?.serviceAreaMessage ?? SERVICE_AREA_BODY,
  };
}

export function emptyVendorListMessage(location?: LocationAvailabilityMeta): string {
  if (location?.reason === 'OUTSIDE_SERVICE_AREA') {
    const { title, body } = serviceAreaCopy(location);
    return `${title}\n\n${body}`;
  }
  if (location?.reason === 'NO_VENDORS_NEARBY') {
    return (
      location.vendorListEmptyMessage ??
      'No stores deliver to your address right now. Try another delivery location.'
    );
  }
  return 'No stores deliver to your address right now. Try another delivery location.';
}
