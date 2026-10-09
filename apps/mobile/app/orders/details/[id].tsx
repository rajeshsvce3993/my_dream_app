import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { apiRequest } from '../../../lib/api';
import { formatMoney } from '../../../lib/format';
import { text } from '../../../lib/locale';
import {
  type CustomerOrderDetail,
  deliveryPartnerLine,
  groupOrderItemsByVendor,
} from '../../../lib/orderDetailTypes';
import { theme, spacing, radius } from '../../../lib/theme';
import { screenHeaderStyles as h } from '../../../lib/screenHeaderStyles';

function formatAddress(order: CustomerOrderDetail['order']) {
  const a = order.deliveryAddress;
  const parts = [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean);
  return parts.join(', ');
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', color: theme.warning, bg: '#F5EBD8' },
  PAID: { label: 'Paid', color: theme.success, bg: theme.successSoft },
  CONFIRMED: { label: 'Confirmed', color: theme.success, bg: theme.successSoft },
  PROCESSING: { label: 'Preparing', color: theme.bannerBg, bg: '#F0E4E6' },
  PACKED: { label: 'Ready', color: theme.bannerBg, bg: '#F0E4E6' },
  OUT_FOR_DELIVERY: { label: 'On the way', color: theme.delivery, bg: '#E4F0F2' },
  DELIVERED: { label: 'Delivered', color: theme.success, bg: theme.successSoft },
  CANCELLED: { label: 'Cancelled', color: theme.discount, bg: '#F5E0E0' },
};

function statusMeta(status: string) {
  return (
    STATUS_STYLE[status] ?? {
      label: status.replaceAll('_', ' '),
      color: theme.muted,
      bg: theme.neutralSoft,
    }
  );
}

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useQuery({
    queryKey: ['mobile-order', id],
    queryFn: () => apiRequest<CustomerOrderDetail>(`/orders/my/${id}`),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: 5000,
  });

  if (detail.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Order details" showBack layout="centered" />
        <View style={{ ...h.bodyPadding, paddingTop: spacing.lg }}>
          <Text style={{ fontWeight: '700', color: theme.text }}>Unable to load order</Text>
          <Pressable onPress={() => router.push('/login')} style={{ marginTop: spacing.sm }}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const { order } = detail.data;
  const partner = deliveryPartnerLine(order.status, detail.data.tracking?.assignedPartner?.name);
  const currency = order.currency === 'INR' ? '₹' : `${order.currency} `;
  const vendorGroups = groupOrderItemsByVendor(detail.data);
  const restaurant = vendorGroups
    .map((group) => group.vendorName)
    .filter(Boolean)
    .join(', ');
  const placedAt = new Date(order.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const meta = statusMeta(order.status);
  const canTrack = !['DELIVERED', 'CANCELLED'].includes(order.status);
  const footerPad = Math.max(insets.bottom, 8) + spacing.md;
  const deliveryCharge = order.shippingTotal + (order.platformFee ?? 0);
  const deliveryFree = deliveryCharge === 0;
  const itemTotal = detail.data.items.reduce(
    (sum, line) => sum + Math.max(0, line.lineTotal - line.taxAmount),
    0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Order details" showBack layout="centered" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: canTrack ? 88 + footerPad : spacing.xl + insets.bottom,
          gap: spacing.sm,
        }}
      >
        {/* Summary */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: theme.bannerBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="receipt-outline" size={18} color={theme.white} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {restaurant ? (
                <Text
                  style={{ fontSize: 15, fontWeight: '800', color: theme.text, letterSpacing: -0.2 }}
                  numberOfLines={2}
                >
                  {restaurant}
                </Text>
              ) : null}
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: restaurant ? 2 : 0 }}>
                Order {order.orderNumber}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{placedAt}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                    backgroundColor: meta.bg,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                    backgroundColor: theme.neutralSoft,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.muted }}>
                    {order.paymentStatus.replaceAll('_', ' ')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Delivery */}
        <SectionLabel>Delivered to</SectionLabel>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons name="location-sharp" size={16} color={theme.primary} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 12, color: theme.text, lineHeight: 18 }}>
              {formatAddress(order)}
            </Text>
          </View>
        </View>

        <SectionLabel>Delivery partner</SectionLabel>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="bicycle-outline" size={16} color={theme.primary} />
            <View style={{ flex: 1 }}>
              {partner.name ? (
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.text }}>{partner.name}</Text>
              ) : null}
              <Text
                style={{
                  fontSize: partner.name ? 11 : 12,
                  color: theme.muted,
                  marginTop: partner.name ? 1 : 0,
                  lineHeight: 16,
                }}
              >
                {partner.message}
              </Text>
            </View>
          </View>
        </View>

        {/* By restaurant */}
        <SectionLabel>Items</SectionLabel>
        {vendorGroups.map((group) => (
          <View key={group.vendorId} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
              <Ionicons name="storefront-outline" size={14} color={theme.primary} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                {group.vendorName}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.muted }}>
                {statusMeta(group.status).label}
              </Text>
            </View>

            <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
              {group.lines.map((line, idx) => (
                <View
                  key={`${line.variantId}-${idx}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      backgroundColor: theme.neutralSoft,
                      overflow: 'hidden',
                    }}
                  >
                    {line.imageUrl ? (
                      <Image
                        source={{ uri: line.imageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: theme.text }} numberOfLines={2}>
                      {text(line.productName, 'Product')}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 1 }}>
                      Qty {line.quantity} ·{' '}
                      {formatMoney(
                        currency,
                        line.quantity > 0
                          ? Math.max(0, line.lineTotal - (line.taxAmount ?? 0)) / line.quantity
                          : 0,
                      )}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', fontSize: 12, color: theme.text }}>
                    {formatMoney(currency, Math.max(0, line.lineTotal - (line.taxAmount ?? 0)))}
                  </Text>
                </View>
              ))}

              {group.shippingFee > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.muted }}>Delivery</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>
                    {formatMoney(currency, group.shippingFee)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}

        {/* Bill */}
        <SectionLabel>Bill details</SectionLabel>
        <View style={styles.card}>
          <BillRow label="Item total" value={formatMoney(currency, itemTotal)} />
          {order.discountTotal > 0 ? (
            <BillRow
              label="Discount"
              value={`−${formatMoney(currency, order.discountTotal)}`}
              valueColor={theme.success}
            />
          ) : null}
          <BillRow
            label="Delivery charges"
            value={deliveryFree ? 'FREE' : formatMoney(currency, deliveryCharge)}
            valueColor={deliveryFree ? theme.success : theme.text}
          />
          {order.taxTotal > 0 ? (
            <BillRow label="GST" value={formatMoney(currency, order.taxTotal)} />
          ) : null}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.border,
              marginVertical: 8,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>Total paid</Text>
            <Text style={{ fontWeight: '800', fontSize: 14, color: theme.text }}>
              {formatMoney(currency, order.grandTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {canTrack ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.tabBarBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.tabBarBorder,
            paddingHorizontal: spacing.lg,
            paddingTop: 8,
            paddingBottom: footerPad,
          }}
        >
          <Pressable
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(id) } })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: theme.bannerBg,
              paddingVertical: 13,
              borderRadius: radius.sm,
            }}
          >
            <Ionicons name="locate-outline" size={16} color={theme.white} />
            <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>Track order</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: theme.muted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 4,
        marginBottom: 2,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

function BillRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontSize: 12, color: theme.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: valueColor ?? theme.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
