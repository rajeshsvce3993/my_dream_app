export type OrderLineItem = {
  vendorId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
  productName?: { en: string };
  imageUrl?: string;
  vendorName?: string;
};

export type VendorOrderSlice = {
  _id: string;
  vendorId: string;
  vendorName?: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type CustomerOrderDetail = {
  order: {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    grandTotal: number;
    subtotal: number;
    taxTotal: number;
    shippingTotal: number;
    platformFee?: number;
    discountTotal: number;
    currency: string;
    createdAt: string;
    deliveryAddress: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode?: string;
      country: string;
    };
  };
  vendorOrders: VendorOrderSlice[];
  items: OrderLineItem[];
  tracking?: {
    partner: string;
    trackingId: string;
    assignedPartner?: { name?: string; phone?: string } | null;
  };
};

/** Partner name is shown only after a rider accepts. Until then, explain when one will be assigned. */
export function deliveryPartnerLine(status: string, partnerName?: string | null) {
  const name = partnerName?.trim() || null;
  if (name) {
    if (status === 'DELIVERED') return { name, message: 'Delivered your order' };
    if (status === 'OUT_FOR_DELIVERY') return { name, message: 'Bringing your order' };
    return { name, message: 'Accepted your order' };
  }
  if (status === 'CANCELLED') {
    return { name: null, message: 'No delivery partner was assigned.' };
  }
  if (status === 'READY_FOR_PICKUP' || status === 'OUT_FOR_DELIVERY') {
    return { name: null, message: 'Looking for a delivery partner nearby.' };
  }
  return {
    name: null,
    message: "We'll assign a delivery partner once your food is prepared and a partner is available.",
  };
}

export function groupOrderItemsByVendor(detail: CustomerOrderDetail) {
  const itemLookup = new Map(
    detail.items.map((item) => [String(item.variantId), item]),
  );

  return detail.vendorOrders.map((vo) => ({
    vendorId: vo.vendorId,
    vendorName: vo.vendorName ?? 'Store',
    status: vo.status,
    subtotal: vo.subtotal,
    shippingFee: vo.shippingFee,
    orderNumber: vo.orderNumber,
    lines: vo.items.map((line) => {
      const meta = itemLookup.get(String(line.variantId));
      return {
        ...line,
        productName: meta?.productName,
        imageUrl: meta?.imageUrl,
        taxAmount: meta?.taxAmount ?? 0,
      };
    }),
  }));
}
