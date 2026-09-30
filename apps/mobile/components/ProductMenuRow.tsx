import { useRef } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Text, View } from 'react-native';
import { useAddToCartFlow } from './AddToCartFlowProvider';
import { formatMoney } from '../lib/format';
import { resolveProductDisplayPrice, resolveProductMrpForStrike } from '../lib/productDisplayPrice';
import { theme, spacing, radius } from '../lib/theme';
import type { ProductSummary } from './ProductCardHorizontal';

type Props = {
  product: ProductSummary;
  currency?: string;
  onAdd?: () => void;
  /** Restaurant menu context — matches add-in-flight loader key. */
  contextVendorId?: string;
  /** @deprecated Dividers removed — kept for call-site compatibility. */
  showDivider?: boolean;
};

const IMG = 60;

/** Restaurant / top-pick menu row — image, name, price, ADD. */
export function ProductMenuRow({ product, currency = '₹', onAdd, contextVendorId }: Props) {
  const { isAddingProduct } = useAddToCartFlow();
  const displayPrice = resolveProductDisplayPrice(product);
  const strikeMrp = resolveProductMrpForStrike(product, displayPrice);
  const showMrp = strikeMrp != null;
  const vendorKey = product.recommendedVendorId ?? product.vendorId ?? contextVendorId;
  const adding = isAddingProduct(product.productId, vendorKey);
  const discount =
    product.discountPercent && product.discountPercent > 0
      ? Math.round(product.discountPercent)
      : null;

  const scale = useRef(new Animated.Value(1)).current;

  const handleAdd = () => {
    if (adding) return;
    scale.setValue(0.9);
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
    onAdd?.();
  };

  return (
    <View
      style={{
        backgroundColor: theme.white,
        marginHorizontal: spacing.lg,
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: IMG,
          height: IMG,
          borderRadius: 8,
          backgroundColor: theme.neutralSoft,
          overflow: 'hidden',
        }}
      >
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>

      <Pressable
        onPress={handleAdd}
        disabled={adding || !onAdd}
        style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 }}
      >
        <Text
          numberOfLines={2}
          style={{
            fontWeight: '700',
            fontSize: 13,
            lineHeight: 17,
            color: theme.text,
            letterSpacing: -0.15,
          }}
        >
          {product.name.en}
        </Text>
        {product.dietType === 'veg' || product.dietType === 'nonveg' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderWidth: 1,
                borderColor: product.dietType === 'veg' ? '#2F7D5C' : '#B83A3A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: product.dietType === 'veg' ? '#2F7D5C' : '#B83A3A',
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: product.dietType === 'veg' ? '#2F7D5C' : '#B83A3A',
              }}
            >
              {product.dietType === 'veg' ? 'Veg' : 'Non-veg'}
            </Text>
          </View>
        ) : null}
        {product.vendorName ? (
          <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: theme.muted }}>
            {product.vendorName}
          </Text>
        ) : product.unitLabel ? (
          <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: theme.muted }}>
            {product.unitLabel}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5, marginTop: 1 }}>
          {displayPrice != null ? (
            <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>
              {formatMoney(currency, displayPrice)}
            </Text>
          ) : null}
          {showMrp ? (
            <Text
              style={{
                fontSize: 11,
                color: theme.muted,
                textDecorationLine: 'line-through',
              }}
            >
              {formatMoney(currency, strikeMrp!)}
            </Text>
          ) : null}
          {discount != null ? (
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.discount }}>
              {discount}% off
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={handleAdd}
        disabled={adding || !onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name.en}`}
        accessibilityState={{ busy: adding }}
      >
        <Animated.View
          style={{
            minWidth: 54,
            height: 30,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: theme.primary,
            backgroundColor: adding ? theme.primaryMuted : theme.white,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: adding ? 0.85 : 1,
            transform: [{ scale }],
          }}
        >
          {adding ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: theme.primary }}>
              ADD
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}
