import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

export type CartLine = {
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: { en: string; ta?: string };
  variantId: string;
  variantName: { en: string; ta?: string };
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  sellingPrice: number;
  taxAmount?: number;
  lineTotal: number;
};

export type CartCalc = {
  lines: CartLine[];
  vendorGroups: Array<{
    vendorId: string;
    vendorName: string;
    itemCount: number;
    subtotal: number;
    lines: CartLine[];
  }>;
  vendorCount: number;
  subtotal: number;
  shippingTotal: number;
  platformFee?: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  insights?: Array<
    | { type: 'FREE_DELIVERY_GAP'; amountRemaining: number; currency: string }
    | { type: 'MULTI_VENDOR'; vendorCount: number }
    | { type: 'SAVINGS'; amount: number; currency: string }
  >;
};

export function useCart(enabled = true) {
  return useQuery({
    queryKey: ['cart'],
    queryFn: () => apiRequest<CartCalc>('/cart'),
    retry: false,
    enabled,
  });
}

export function cartItemCount(cart?: CartCalc | null) {
  return cart?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;
}
