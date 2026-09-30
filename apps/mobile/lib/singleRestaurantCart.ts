import { Alert, InteractionManager } from 'react-native';
import { apiRequest } from './api';

type CartLineBrief = {
  vendorId: string;
  vendorName?: string;
};

type CartBrief = {
  lines?: CartLineBrief[];
  vendorGroups?: Array<{ vendorId: string; vendorName?: string }>;
};

export type SingleRestaurantConfirm = {
  /** Caller may proceed to add. */
  ok: boolean;
  /** Clear other restaurants in the same add request (atomic). */
  replaceCart?: boolean;
};

function otherRestaurantFromCart(cart: CartBrief, vendorId: string): CartLineBrief | null {
  const target = String(vendorId);
  const lines = cart.lines ?? [];
  for (const line of lines) {
    if (line.vendorId && String(line.vendorId) !== target) {
      return line;
    }
  }
  for (const group of cart.vendorGroups ?? []) {
    if (group.vendorId && String(group.vendorId) !== target) {
      return { vendorId: group.vendorId, vendorName: group.vendorName };
    }
  }
  return null;
}

function showReplaceAlert(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Alert after await can fail to present on Android — defer to next frame.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        Alert.alert('Replace cart?', message, [
          { text: 'Keep cart', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
        ]);
      }, 0);
    });
  });
}

/**
 * Ensures cart only holds one restaurant.
 * @returns ok + optional replaceCart flag for the add API.
 */
export async function confirmSingleRestaurantCart(input: {
  vendorId: string;
  vendorName?: string;
}): Promise<SingleRestaurantConfirm> {
  let cart: CartBrief;
  try {
    cart = await apiRequest<CartBrief>(`/cart?_=${Date.now()}`);
  } catch {
    Alert.alert('Could not check cart', 'Please try again.');
    return { ok: false };
  }

  const other = otherRestaurantFromCart(cart, input.vendorId);
  if (!other) return { ok: true };

  const fromName = other.vendorName?.trim() || 'another restaurant';
  const toName = input.vendorName?.trim() || 'this restaurant';
  const replace = await showReplaceAlert(
    `Your cart is from ${fromName}. Clear it to order from ${toName}?`,
  );
  if (!replace) return { ok: false };
  return { ok: true, replaceCart: true };
}

/** Prompt after the API rejected a multi-restaurant add. */
export async function promptReplaceAfterConflict(input: {
  vendorName?: string;
}): Promise<boolean> {
  const toName = input.vendorName?.trim() || 'this restaurant';
  return showReplaceAlert(
    `Your cart is from another restaurant. Clear it to order from ${toName}?`,
  );
}

export function isCartOtherRestaurantError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('CART_OTHER_RESTAURANT') ||
    msg.toLowerCase().includes('another restaurant')
  );
}
