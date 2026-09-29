export type LocationAvailabilityReason =
  | 'IN_SERVICE_AREA'
  | 'OUTSIDE_SERVICE_AREA'
  | 'NO_VENDORS_NEARBY';

export type LocationAvailabilityInfo = {
  inServiceArea: boolean;
  reason: LocationAvailabilityReason;
  /** Headline when outside platform delivery zones. */
  serviceAreaTitle?: string;
  /** Body copy when outside platform delivery zones. */
  serviceAreaMessage?: string;
  /** Shown only on the stores / vendor list when in-zone but no stores match. */
  vendorListEmptyMessage?: string;
};

export const SERVICE_AREA_TITLE = 'We don’t deliver to this location yet 📍';

export const SERVICE_AREA_BODY =
  'Your current address is outside our delivery area. Change your location to see stores and products available near you.';

/** Single string for alerts and simple text blocks. */
export const SERVICE_AREA_MESSAGE = `${SERVICE_AREA_TITLE}\n\n${SERVICE_AREA_BODY}`;

export const VENDOR_LIST_EMPTY_MESSAGE =
  'No stores deliver to your address right now. Try another delivery location or check back later.';

export const PRODUCT_NO_VENDOR_MESSAGE =
  'No store offers this item for delivery to your address. Try another product or update your address.';

export function locationInfoForVendorList(input: {
  inServiceArea: boolean;
  vendorCount: number;
}): LocationAvailabilityInfo {
  if (!input.inServiceArea) {
    return {
      inServiceArea: false,
      reason: 'OUTSIDE_SERVICE_AREA',
      serviceAreaTitle: SERVICE_AREA_TITLE,
      serviceAreaMessage: SERVICE_AREA_BODY,
    };
  }
  if (input.vendorCount === 0) {
    return {
      inServiceArea: true,
      reason: 'NO_VENDORS_NEARBY',
      vendorListEmptyMessage: VENDOR_LIST_EMPTY_MESSAGE,
    };
  }
  return { inServiceArea: true, reason: 'IN_SERVICE_AREA' };
}
