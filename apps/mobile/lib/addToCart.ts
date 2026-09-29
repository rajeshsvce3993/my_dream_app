import * as SecureStore from 'expo-secure-store';
import { openLogin } from './openLogin';
import { Alert } from 'react-native';
import { createOutsideServiceAreaError } from './locationMessages';
import { apiRequest } from './api';
import type { AppLocation } from './location';

export class SignInRequiredError extends Error {
  constructor() {
    super('SIGN_IN_REQUIRED');
    this.name = 'SignInRequiredError';
  }
}

export async function ensureSignedInForCart(): Promise<void> {
  const access = await SecureStore.getItemAsync('accessToken');
  const refresh = await SecureStore.getItemAsync('refreshToken');
  if (!access && !refresh) {
    openLogin();
    throw new SignInRequiredError();
  }
}

export async function addCartItem(input: {
  vendorId?: string;
  productId: string;
  variantId: string;
  vendorProductId?: string;
  quantity: number;
  location: Pick<AppLocation, 'lng' | 'lat'>;
  deferAvailability?: boolean;
}): Promise<void> {
  await ensureSignedInForCart();
  await apiRequest('/cart/items', {
    method: 'POST',
    body: JSON.stringify({
      vendorId: input.vendorId,
      productId: input.productId,
      variantId: input.variantId,
      vendorProductId: input.vendorProductId,
      quantity: input.quantity,
      lng: input.location.lng,
      lat: input.location.lat,
      deferAvailability: input.deferAvailability,
    }),
  });
}

export function handleAddToCartError(err: unknown): void {
  if (err instanceof SignInRequiredError) return;
  const message = err instanceof Error ? err.message : 'Something went wrong';
  if (message === 'NEEDS_VENDOR') return;
  Alert.alert('Could not add to cart', message);
}

type ResolvedOffer = {
  variantId: string;
  vendorId: string | null;
  serviceableAtLocation: boolean;
  reason?: 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS_NEARBY' | 'IN_SERVICE_AREA';
  serviceAreaTitle?: string;
  message?: string;
};

/** Pick a vendor for this product at the customer's delivery location (within delivery radius). */
export async function resolveOfferForProduct(
  productId: string,
  location: Pick<AppLocation, 'lng' | 'lat'>,
  hints?: { variantId?: string },
): Promise<{ variantId: string; vendorId: string }> {
  const params = new URLSearchParams({
    productId,
    lng: String(location.lng),
    lat: String(location.lat),
  });
  if (hints?.variantId) params.set('variantId', hints.variantId);

  const resolved = await apiRequest<ResolvedOffer>(`/catalog/resolve-offer?${params.toString()}`);

  if (!resolved.serviceableAtLocation || !resolved.vendorId) {
    if (
      resolved.reason === 'OUTSIDE_SERVICE_AREA' ||
      resolved.serviceAreaTitle != null
    ) {
      throw createOutsideServiceAreaError({
        title: resolved.serviceAreaTitle,
        body: resolved.message,
      });
    }
    throw new Error(
      resolved.message ??
        'No store offers this item at your address. Try another product or update your address in Profile.',
    );
  }

  return { variantId: resolved.variantId, vendorId: resolved.vendorId };
}
