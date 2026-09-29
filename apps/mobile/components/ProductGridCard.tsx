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
  const adding = isAddingProduct(product.productId);

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
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: '#EEF0F3',
        overflow: 'hidden',
        ...shadow.card,
      }}
    >
      <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
        <View style={{ height: 104, backgroundColor: '#FAFAFA' }}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.border }} />
          )}
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
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
      <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable
            onPress={handleAdd}
            disabled={adding || !onAdd}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}
          >
            {displayPrice != null ? (
              <Text style={{ fontWeight: '800', color: theme.primary, fontSize: 15 }}>
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
        <Pressable onPress={handleAdd} disabled={adding || !onAdd}>
          <Text numberOfLines={2} style={{ fontWeight: '700', fontSize: 12, color: theme.text, marginTop: 4, lineHeight: 16 }}>
            {product.name.en}
          </Text>
          {product.unitLabel ? (
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{product.unitLabel}</Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
