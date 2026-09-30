import { useAddToCartFlow } from '../components/AddToCartFlowProvider';
import type { ProductSummary } from '../components/ProductCardHorizontal';

/** Home, category listing, search, and vendor store quick-add. */
export function useQuickAddToCart(contextVendorId?: string, contextVendorName?: string) {
  const { startAddToCart, isPending } = useAddToCartFlow();

  return {
    /** Returns true when the item was added to the cart. */
    mutate: (product: ProductSummary): Promise<boolean> => {
      const vendorId = product.recommendedVendorId ?? product.vendorId ?? contextVendorId;
      // Restaurant menu / offer rows already show that store’s price — skip compare sheet.
      const skipVendorCompare = Boolean(vendorId && (product.vendorName || contextVendorId));
      return startAddToCart({
        productId: product.productId,
        variantId: product.variantId,
        quantity: 1,
        productName: product.name.en,
        contextVendorId: vendorId,
        contextVendorName: product.vendorName ?? contextVendorName,
        skipVendorCompare,
      });
    },
    isPending,
  };
}
