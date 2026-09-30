import type { LocationAvailabilityMeta } from './locationMessages';

export type CustomerVendorCard = {
  id: string;
  name: string;
  rating: number;
  ratingCount?: number;
  distanceKm?: number;
  deliveryEstimateMinutes?: number;
  deliveryFee?: number;
  minimumOrderAmount?: number;
  isOpen: boolean;
  productCount: number;
  freeDeliveryThreshold: number;
  cuisineTags?: string[];
  dietType?: 'veg' | 'nonveg' | 'both';
  imageUrl?: string;
};

export type VendorsQueryData = {
  items: CustomerVendorCard[];
  location?: LocationAvailabilityMeta;
};
