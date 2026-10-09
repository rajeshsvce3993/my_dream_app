import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router, Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderPlacedCelebration } from '../../components/OrderPlacedCelebration';
import { Ionicons } from '@expo/vector-icons';
import { OrderTimeline } from '../../components/OrderTimeline';
import { deliveryPartnerLine } from '../../lib/orderDetailTypes';
import { apiRequest } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { theme, spacing, radius } from '../../lib/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { screenHeaderStyles as h } from '../../lib/screenHeaderStyles';

type OrderDetail = {
  order: {
    orderNumber: string;
    status: string;
    grandTotal: number;
    createdAt: string;
    timeline: Array<{ status: string; at: string }>;
  };
  vendorOrders?: Array<{ vendorName?: string }>;
  items: Array<{ quantity: number; productName?: { en: string }; imageUrl?: string; vendorName?: string }>;
  tracking?: {
    partner: string;
    trackingId: string;
    assignedPartner?: { name?: string; phone?: string } | null;
  };
};

function restaurantLabel(detail: OrderDetail) {
  const fromVendors = (detail.vendorOrders ?? [])
    .map((vendor) => vendor.vendorName)
    .filter((name): name is string => Boolean(name));
  const fromItems = detail.items
    .map((item) => item.vendorName)
    .filter((name): name is string => Boolean(name));
  const names = [...new Set(fromVendors.length ? fromVendors : fromItems)];
  return names.join(', ');
}

const STATUS_COPY: Record<string, { title: string; subtitle: string }> = {
  PENDING_PAYMENT: { title: 'Awaiting payment', subtitle: 'Complete payment to confirm your order' },
  PAID: { title: 'Payment received', subtitle: 'Restaurant will confirm shortly' },
  CONFIRMED: { title: 'Order confirmed', subtitle: 'Restaurant has accepted your order' },
  PROCESSING: { title: 'Preparing your food', subtitle: 'The kitchen is on it' },
  PACKED: { title: 'Ready for delivery', subtitle: 'Partner will pick up soon' },
  OUT_FOR_DELIVERY: { title: 'On the way', subtitle: 'Your order is out for delivery' },
  DELIVERED: { title: 'Delivered', subtitle: 'Hope you enjoy your meal' },
  CANCELLED: { title: 'Cancelled', subtitle: 'This order was cancelled' },
};

function etaMinutes(status: string): number | null {
  if (status === 'OUT_FOR_DELIVERY') return 8;
  if (status === 'PACKED' || status === 'PROCESSING') return 18;
  if (status === 'CONFIRMED') return 25;
  return null;
}

function statusLabel(status: string) {
  return STATUS_COPY[status]?.title ?? status.replaceAll('_', ' ');
}

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const [showCelebration, setShowCelebration] = useState(placed === '1');

  useEffect(() => {
    if (placed !== '1') return;
    setShowCelebration(true);
    const t = setTimeout(() => setShowCelebration(false), 5000);
    return () => clearTimeout(t);
  }, [placed]);

  const detail = useQuery({
    queryKey: ['mobile-order', id],
    queryFn: () => apiRequest<OrderDetail>(`/orders/my/${id}`),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: 5000,
  });

  if (detail.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Track order" showBack layout="centered" />
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

  const { order, tracking, items } = detail.data;
  const partner = deliveryPartnerLine(order.status, tracking?.assignedPartner?.name);
  const restaurant = restaurantLabel(detail.data);
  const eta = etaMinutes(order.status);
  const copy = STATUS_COPY[order.status] ?? {
    title: statusLabel(order.status),
    subtitle: 'Live updates every few minutes',
  };
  const footerPad = Math.max(insets.bottom, 8) + spacing.md;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Track order" showBack layout="centered" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 88 + footerPad,
          gap: spacing.sm,
        }}
      >
        <OrderPlacedCelebration orderNumber={order.orderNumber} visible={showCelebration} />

        {/* Status summary */}
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
              <Ionicons
                name={
                  order.status === 'DELIVERED'
                    ? 'checkmark-done'
                    : order.status === 'OUT_FOR_DELIVERY'
                      ? 'bicycle'
                      : 'restaurant-outline'
                }
                size={20}
                color={theme.white}
              />
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
              <Text
                style={{
                  fontSize: restaurant ? 13 : 15,
                  fontWeight: '800',
                  color: restaurant ? theme.muted : theme.text,
                  letterSpacing: -0.2,
                  marginTop: restaurant ? 2 : 0,
                }}
              >
                {copy.title}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 16 }}>
                {copy.subtitle}
              </Text>
              <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4, fontWeight: '600' }}>
                Order {order.orderNumber}
              </Text>
            </View>
          </View>

          {eta != null ? (
            <View
              style={{
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                backgroundColor: theme.successSoft,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.full,
              }}
            >
              <Ionicons name="time-outline" size={14} color={theme.success} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.success }}>
                Arriving in ~{eta} mins
              </Text>
            </View>
          ) : null}
        </View>

        {/* Timeline */}
        <SectionLabel>Order status</SectionLabel>
        <View style={styles.card}>
          <OrderTimeline current={order.status} timeline={order.timeline} />
        </View>

        <SectionLabel>Delivery partner</SectionLabel>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: theme.neutralSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="bicycle-outline" size={18} color={theme.primary} />
            </View>
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

        {/* Items */}
        <SectionLabel>
          Items · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </SectionLabel>
        <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          {items.map((item, idx) => (
            <View
              key={`${item.productName?.en ?? 'item'}-${idx}`}
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
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="fast-food-outline" size={16} color={theme.muted} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', fontSize: 12, color: theme.text }} numberOfLines={1}>
                  {item.productName?.en ?? 'Item'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>Qty {item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: theme.muted }}>Order total</Text>
            <Text style={{ fontWeight: '800', fontSize: 14, color: theme.text }}>
              {formatMoney('₹', order.grandTotal)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
            Placed{' '}
            {new Date(order.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </ScrollView>

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
        <Link href={{ pathname: '/orders/details/[id]', params: { id: String(id) } }} asChild>
          <Pressable
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
            <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>View order details</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.white} />
          </Pressable>
        </Link>
      </View>
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
