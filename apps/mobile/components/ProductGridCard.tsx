import { Image, Pressable, Text, View } from 'react-native';
import { useAddToCartFlow } from './AddToCartFlowProvider';
import { AddToCartButtonPulse } from './AddToCartButtonPulse';
import { formatMoney } from '../lib/format';
import { resolveProductDisplayPrice, resolveProductMrpForStrike } from '../lib/productDisplayPrice';
import { theme, spacing, radius, shadow } from '../lib/theme';
import type { ProductSummary } from './ProductCardHorizontal';

type Props = {
  product: ProductSummary;
  currency?: string;
  width: number;
  onAdd?: () => void;
};

function badgeForProduct(product: ProductSummary): { label: string; bg: string } | undefined {
  if (product.discountPercent && product.discountPercent >= 15) {
    return { label: 'HOT DEAL', bg: theme.discount };
  }
  if (product.discountPercent && product.discountPercent > 0) {
    return { label: `${product.discountPercent}% OFF`, bg: theme.discount };
  }
  return undefined;
}

export function ProductGridCard({ product, currency = '₹', width, onAdd }: Props) {
  const { isAddingProduct } = useAddToCartFlow();
  const badge = badgeForProduct(product);
  const displayPrice = resolveProductDisplayPrice(product);
  const strikeMrp = resolveProductMrpForStrike(product, displayPrice);
  const showMrp = strikeMrp != null;
  const adding = isAddingProduct(product.productId, product.recommendedVendorId);

  const handleAdd = () => {
    if (adding) return;
    onAdd?.();
  };

  return (
    <View
      style={{
        width,
        marginBottom: 0,
        borderRadius: radius.md,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EEEEEE',
        overflow: 'hidden',
        ...shadow.card,
      }}
    >
      <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
        <View style={{ height: 118, backgroundColor: '#F5F5F5' }}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#ECECEC' }} />
          )}
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: badge.bg,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>{badge.label}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
          <Text numberOfLines={2} style={{ fontWeight: '700', fontSize: 13, color: theme.text, lineHeight: 17 }}>
            {product.name.en}
          </Text>
          {product.unitLabel ? (
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{product.unitLabel}</Text>
          ) : null}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 8 }}>
          <Pressable
            onPress={handleAdd}
            disabled={adding || !onAdd}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}
          >
            {displayPrice != null ? (
              <Text style={{ fontWeight: '800', color: theme.text, fontSize: 14 }}>
                {formatMoney(currency, displayPrice)}
              </Text>
            ) : null}
            {showMrp ? (
              <Text
                style={{
                  fontWeight: '500',
                  color: theme.muted,
                  fontSize: 11,
                  textDecorationLine: 'line-through',
                }}
              >
                {formatMoney(currency, strikeMrp!)}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={handleAdd} hitSlop={8} disabled={adding || !onAdd}>
            <AddToCartButtonPulse productId={product.productId} loading={adding} size={30} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
