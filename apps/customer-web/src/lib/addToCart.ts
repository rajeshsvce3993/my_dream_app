import { apiRequest, clearTokens } from '../api/client';

export class SignInRequiredError extends Error {
  constructor() {
    super('SIGN_IN_REQUIRED');
    this.name = 'SignInRequiredError';
  }
}

export function isSignedIn(): boolean {
  return Boolean(localStorage.getItem('accessToken') || localStorage.getItem('refreshToken'));
}

export async function ensureSignedInForCart(returnTo = '/'): Promise<void> {
  if (isSignedIn()) return;
  const q = new URLSearchParams({ returnTo });
  window.location.assign(`/login?${q.toString()}`);
  throw new SignInRequiredError();
}

export async function addCartItem(input: {
  vendorId?: string;
  productId: string;
  variantId: string;
  vendorProductId?: string;
  quantity: number;
  location: { lng: number; lat: number };
  deferAvailability?: boolean;
  replaceCart?: boolean;
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
      replaceCart: input.replaceCart,
    }),
  });
}

export function logoutLocal() {
  clearTokens();
}
