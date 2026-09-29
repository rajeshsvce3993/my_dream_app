import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { apiRequest } from '../../../lib/api';
import { formatMoney } from '../../../lib/format';
import { text } from '../../../lib/locale';
import {
  type CustomerOrderDetail,
  groupOrderItemsByVendor,
} from '../../../lib/orderDetailTypes';
import { theme, spacing, radius, shadow } from '../../../lib/theme';
import { screenHeaderStyles as h } from '../../../lib/screenHeaderStyles';

function formatAddress(order: CustomerOrderDetail['order']) {
  const a = order.deliveryAddress;
  const parts = [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean);
  return parts.join(', ');
}

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useQuery({
    queryKey: ['mobile-order', id],
    queryFn: () => apiRequest<CustomerOrderDetail>(`/orders/my/${id}`),
    enabled: Boolean(id),
    retry: false,
  });

  if (detail.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Order details" showBack layout="centered" />
        <View style={{ ...h.bodyPadding }}>
          <Text>Unable to load order.</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={{ color: theme.primary, marginTop: 8 }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const { order } = detail.data;
  const currency = order.currency === 'INR' ? '₹' : `${order.currency} `;
  const vendorGroups = groupOrderItemsByVendor(detail.data);
  const placedAt = new Date(order.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Order details" showBack layout="centered" />

      <ScrollView contentContainerStyle={{ ...h.bodyPadding, paddingBottom: spacing.xl }}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: '800', fontSize: 16 }}>#{order.orderNumber}</Text>
          <Text style={{ color: theme.muted, marginTop: 4, fontSize: 13 }}>{placedAt}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
              {order.status.replaceAll('_', ' ')}
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>·</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.muted }}>
              {order.paymentStatus.replaceAll('_', ' ')}
            </Text>
          </View>
        </View>

        <Text style={{ fontWeight: '800', marginBottom: spacing.sm }}>By store</Text>
        {vendorGroups.map((group) => (
          <View
            key={group.vendorId}
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.md,
              padding: spacing.lg,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={{ fontWeight: '800', fontSize: 15 }}>{group.vendorName}</Text>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                  {group.status.replaceAll('_', ' ')} · #{group.orderNumber}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', color: theme.primary }}>
                {formatMoney(currency, group.subtotal + group.shippingFee)}
              </Text>
            </View>

            {group.lines.map((line, idx) => (
              <View
                key={`${line.variantId}-${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  marginTop: spacing.md,
                  paddingTop: spacing.md,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                {line.imageUrl ? (
                  <Image source={{ uri: line.imageUrl }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: theme.border }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', fontSize: 14 }} numberOfLines={2}>
                    {text(line.productName, 'Product')}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                    Qty {line.quantity} × {formatMoney(currency, line.unitPrice)}
                  </Text>
                </View>
                <Text style={{ fontWeight: '700' }}>{formatMoney(currency, line.lineTotal)}</Text>
              </View>
            ))}

            {group.shippingFee > 0 ? (
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: spacing.sm }}>
                Delivery {formatMoney(currency, group.shippingFee)}
              </Text>
            ) : null}
          </View>
        ))}

        <Text style={{ fontWeight: '800', marginTop: spacing.sm, marginBottom: spacing.sm }}>Delivery address</Text>
        <Text style={{ color: theme.muted, lineHeight: 20, marginBottom: spacing.lg }}>{formatAddress(order)}</Text>

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: '800', marginBottom: spacing.sm }}>Bill summary</Text>
          <Row label="Subtotal" value={formatMoney(currency, order.subtotal)} />
          {order.discountTotal > 0 ? (
            <Row label="Discount" value={`−${formatMoney(currency, order.discountTotal)}`} valueColor={theme.primary} />
          ) : null}
          <Row label="Taxes" value={formatMoney(currency, order.taxTotal)} />
          <Row label="Delivery" value={formatMoney(currency, order.shippingTotal)} />
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: spacing.sm }} />
          <Row label="Total paid" value={formatMoney(currency, order.grandTotal)} bold />
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(id) } })}
          style={{ marginTop: spacing.lg, alignItems: 'center' }}
        >
          <Text style={{ color: theme.delivery, fontWeight: '700' }}>Track order →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ color: theme.muted, fontWeight: bold ? '800' : '500' }}>{label}</Text>
      <Text style={{ fontWeight: bold ? '800' : '600', color: valueColor ?? theme.text }}>{value}</Text>
    </View>
  );
}
