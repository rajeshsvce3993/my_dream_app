import type { LocationAvailabilityMeta } from './locationMessages';

export type CustomerVendorCard = {
  id: string;
  name: string;
  rating: number;
  distanceKm?: number;
  deliveryEstimateMinutes?: number;
  isOpen: boolean;
  productCount: number;
  freeDeliveryThreshold: number;
};

export type VendorsQueryData = {
  items: CustomerVendorCard[];
  location?: LocationAvailabilityMeta;
};
