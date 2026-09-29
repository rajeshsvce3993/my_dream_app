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
  tracking?: { partner: string; trackingId: string };
};

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
      };
    }),
  }));
}
