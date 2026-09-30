import { Image, Pressable, Text, View } from 'react-native';
import { useAddToCartFlow } from './AddToCartFlowProvider';
import { AddToCartButtonPulse } from './AddToCartButtonPulse';
import { formatMoney } from '../lib/format';
import { resolveProductDisplayPrice } from '../lib/productDisplayPrice';
import { theme, spacing, radius, shadow } from '../lib/theme';

export type ProductSummary = {
  productId: string;
  name: { en: string };
  imageUrl?: string;
  variantId?: string;
  recommendedVendorId?: string;
  /** Present on vendor-store product cards from `/vendors/:id/products`. */
  vendorId?: string;
  vendorName?: string;
  displayPrice?: number;
  actualPrice?: number;
  finalUnitPrice?: number;
  mrp?: number;
  sellingPrice?: number;
  discountPercent?: number;
  labels?: string[];
  unitLabel?: string;
  dietType?: 'veg' | 'nonveg';
  serviceableAtLocation?: boolean;
  vendorCount?: number;
  availabilityReason?: 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS_NEARBY' | 'IN_SERVICE_AREA';
  availabilityTitle?: string;
  availabilityMessage?: string;
};

type Props = {
  product: ProductSummary;
  currency?: string;
  unitLabel?: string;
  cardWidth?: number;
  imageHeight?: number;
  onAdd?: () => void;
};

export function ProductCardHorizontal({
  product,
  currency = '₹',
  unitLabel,
  cardWidth = 140,
  imageHeight = 100,
  onAdd,
}: Props) {
  const { isAddingProduct } = useAddToCartFlow();
  const displayPrice = resolveProductDisplayPrice(product);
  const dailyPick = product.labels?.includes('best_overall') || product.labels?.includes('best_price');
  const adding = isAddingProduct(product.productId, product.recommendedVendorId);

  const handleAdd = () => {
    if (adding) return;
    onAdd?.();
  };

  return (
    <View
      style={{
        width: cardWidth,
        backgroundColor: theme.surface,
        borderRadius: radius.md,
        marginRight: spacing.md,
        ...shadow.card,
      }}
    >
      <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
        <View
          style={{
            height: imageHeight,
            borderTopLeftRadius: radius.md,
            borderTopRightRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.border }} />
          )}
          {dailyPick ? (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: theme.accent,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: theme.primaryDark, fontSize: 9, fontWeight: '800' }}>DAILY PICK</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={{ padding: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable onPress={handleAdd} disabled={adding || !onAdd} style={{ flex: 1 }}>
            {displayPrice != null ? (
              <Text style={{ fontWeight: '800', color: theme.primary, fontSize: 15 }}>
                {formatMoney(currency, displayPrice)}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={handleAdd} hitSlop={8} disabled={adding || !onAdd}>
            <AddToCartButtonPulse productId={product.productId} loading={adding} size={28} />
          </Pressable>
        </View>
        <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
          <Text numberOfLines={2} style={{ fontWeight: '600', fontSize: 13, color: theme.text, marginTop: 4 }}>
            {product.name.en}
          </Text>
          {(unitLabel ?? product.unitLabel) ? (
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{unitLabel ?? product.unitLabel}</Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
