import { apiRequest } from './api';

export type AddToCartFlowVendor = {
  vendorId: string;
  vendorProductId: string;
  vendorName: string;
  variantId: string;
  vendorPrice: number;
  mrp: number;
  sellingPrice: number;
  finalUnitPrice: number;
  discountPercent?: number;
  availableQuantity: number;
  distanceKm?: number;
  rating: number;
  deliveryEstimateMinutes?: number;
  deliveryFee: number;
  isOpen: boolean;
};

export type AddToCartFlowResult = {
  status: 'NO_DELIVERY_ADDRESS' | 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS' | 'SELECT_VENDOR';
  productId: string;
  variantId: string;
  actualPrice?: number;
  quantity: number;
  messages?: { title?: string; body?: string };
  vendors: AddToCartFlowVendor[];
  recommendedVendorId: string | null;
  showVendorCompare: boolean;
  autoVendorId: string | null;
  referenceVendor?: AddToCartFlowVendor;
  canDeferAvailability: boolean;
};

export async function fetchAddToCartFlow(input: {
  productId: string;
  variantId?: string;
  quantity?: number;
  lng?: number;
  lat?: number;
  hasDeliveryAddress: boolean;
  contextVendorId?: string;
}): Promise<AddToCartFlowResult> {
  const params = new URLSearchParams({
    productId: input.productId,
    quantity: String(input.quantity ?? 1),
    hasDeliveryAddress: input.hasDeliveryAddress ? 'true' : 'false',
  });
  if (input.variantId) params.set('variantId', input.variantId);
  if (input.lng !== undefined) params.set('lng', String(input.lng));
  if (input.lat !== undefined) params.set('lat', String(input.lat));
  if (input.contextVendorId) params.set('contextVendorId', input.contextVendorId);
  return apiRequest<AddToCartFlowResult>(`/catalog/add-to-cart-flow?${params.toString()}`);
}
