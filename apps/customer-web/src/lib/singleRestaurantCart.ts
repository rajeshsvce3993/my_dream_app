import { apiRequest } from '../api/client';

type CartLineBrief = {
  vendorId: string;
  vendorName?: string;
};

type CartBrief = {
  lines?: CartLineBrief[];
  vendorGroups?: Array<{ vendorId: string; vendorName?: string }>;
};

export type SingleRestaurantConfirm = {
  ok: boolean;
  replaceCart?: boolean;
};

function otherRestaurantFromCart(cart: CartBrief, vendorId: string): CartLineBrief | null {
  const target = String(vendorId);
  for (const line of cart.lines ?? []) {
    if (line.vendorId && String(line.vendorId) !== target) return line;
  }
  for (const group of cart.vendorGroups ?? []) {
    if (group.vendorId && String(group.vendorId) !== target) {
      return { vendorId: group.vendorId, vendorName: group.vendorName };
    }
  }
  return null;
}

/**
 * Ensures cart only holds one restaurant (same rule as mobile).
 */
export async function confirmSingleRestaurantCart(input: {
  vendorId: string;
  vendorName?: string;
}): Promise<SingleRestaurantConfirm> {
  let cart: CartBrief;
  try {
    cart = await apiRequest<CartBrief>(`/cart?_=${Date.now()}`);
  } catch {
    window.alert('Could not check cart. Please try again.');
    return { ok: false };
  }

  const other = otherRestaurantFromCart(cart, input.vendorId);
  if (!other) return { ok: true };

  const fromName = other.vendorName?.trim() || 'another restaurant';
  const toName = input.vendorName?.trim() || 'this restaurant';
  const replace = window.confirm(
    `Your cart is from ${fromName}. Clear it to order from ${toName}?`,
  );
  if (!replace) return { ok: false };
  return { ok: true, replaceCart: true };
}

export async function promptReplaceAfterConflict(input: {
  vendorName?: string;
}): Promise<boolean> {
  const toName = input.vendorName?.trim() || 'this restaurant';
  return window.confirm(
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
