import * as SecureStore from 'expo-secure-store';

export type PendingAddToCart = {
  productId: string;
  variantId?: string;
  quantity: number;
};

const KEY = 'pendingAddToCart';

export async function savePendingAddToCart(pending: PendingAddToCart): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(pending));
}

export async function loadPendingAddToCart(): Promise<PendingAddToCart | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingAddToCart;
  } catch {
    return null;
  }
}

export async function clearPendingAddToCart(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
