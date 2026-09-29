import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoney } from '../lib/format';
import { theme, spacing, radius } from '../lib/theme';

export type VendorOfferCompareItem = {
  vendorId: string;
  vendorName: string;
  vendorPrice?: number;
  sellingPrice?: number;
  finalUnitPrice: number;
  displayPrice?: number;
  discountPercent?: number;
  distanceKm?: number;
  rating: number;
  deliveryEstimateMinutes?: number;
  tag?: string;
  footer?: ReactNode;
};

type Props = {
  actualPrice?: number;
  vendor: VendorOfferCompareItem;
  currency?: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function VendorOfferCompareCard({
  actualPrice,
  vendor,
  currency = '₹',
  onPress,
  disabled,
}: Props) {
  const pay = vendor.displayPrice ?? vendor.finalUnitPrice;
  const strike = actualPrice != null && actualPrice > pay ? actualPrice : undefined;

  const body = (
    <>
      {vendor.tag ? (
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{vendor.tag}</Text>
      ) : null}
      <Text style={{ fontWeight: '800', fontSize: 16 }}>{vendor.vendorName}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 18 }}>{formatMoney(currency, pay)}</Text>
        {strike != null ? (
          <Text style={{ color: theme.muted, textDecorationLine: 'line-through', fontSize: 14 }}>
            {formatMoney(currency, strike)}
          </Text>
        ) : null}
        {vendor.discountPercent ? (
          <Text style={{ color: theme.discount, fontWeight: '700', fontSize: 13 }}>{vendor.discountPercent}% off</Text>
        ) : null}
      </View>
      {vendor.sellingPrice != null && vendor.vendorPrice != null ? (
        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
          Store price {formatMoney(currency, vendor.sellingPrice)}
          {vendor.vendorPrice !== vendor.sellingPrice
            ? ` · Vendor cost ${formatMoney(currency, vendor.vendorPrice)}`
            : ''}
        </Text>
      ) : null}
      <Text style={{ color: theme.muted, marginTop: 4, fontSize: 13 }}>
        {vendor.distanceKm != null ? `${vendor.distanceKm.toFixed(1)} km · ` : ''}
        {vendor.deliveryEstimateMinutes ?? '—'} min · ★ {vendor.rating.toFixed(1)}
      </Text>
      {vendor.footer}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: radius.md,
        borderColor: theme.border,
        borderWidth: 1,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      {body}
    </View>
  );
}
