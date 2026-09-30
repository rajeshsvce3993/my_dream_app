import { useAddToCartFlow } from '../components/AddToCartFlowProvider';
import type { ProductSummary } from '../design-system/ProductCard';

/** Home, search, and vendor menu quick-add — mirrors mobile. */
export function useQuickAddToCart(contextVendorId?: string, contextVendorName?: string) {
  const { startAddToCart, isPending, isAddingProduct } = useAddToCartFlow();

  return {
    mutate: (product: ProductSummary): Promise<boolean> => {
      const vendorId = product.recommendedVendorId ?? product.vendorId ?? contextVendorId;
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
    isAddingProduct,
  };
}
