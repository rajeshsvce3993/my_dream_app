import { useAddToCartFlow } from '../components/AddToCartFlowProvider';
import type { ProductSummary } from '../components/ProductCardHorizontal';

/** Home, category listing, search, and vendor store quick-add. */
export function useQuickAddToCart(contextVendorId?: string) {
  const { startAddToCart, isPending } = useAddToCartFlow();

  return {
    mutate: (product: ProductSummary) => {
      void startAddToCart({
        productId: product.productId,
        variantId: product.variantId,
        quantity: 1,
        productName: product.name.en,
        contextVendorId,
      });
    },
    isPending,
  };
}
