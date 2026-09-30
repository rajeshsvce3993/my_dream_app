import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { openLogin } from '../../lib/openLogin';
import { useAuthSession } from '../../lib/useAuthSession';
import { formatMoney } from '../../lib/format';
import { theme, spacing, radius } from '../../lib/theme';

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  itemCount?: number;
  restaurantName?: string;
  restaurantNames?: string[];
  itemPreview?: string;
  moreItemCount?: number;
  previewImageUrl?: string;
};

const ORDERS_RETURN = '/(tabs)/orders';

/** Plain-language status for everyday users */
const STATUS_COPY: Record<string, { label: string; hint: string; color: string; bg: string }> = {
  PENDING_PAYMENT: {
    label: 'Payment pending',
    hint: 'Complete payment to confirm',
    color: theme.warning,
    bg: '#F5EBD8',
  },
  PAID: {
    label: 'Paid',
    hint: 'Waiting for restaurant',
    color: theme.success,
    bg: theme.successSoft,
  },
  CONFIRMED: {
    label: 'Confirmed',
    hint: 'Restaurant accepted your order',
    color: theme.success,
    bg: theme.successSoft,
  },
  PROCESSING: {
    label: 'Preparing',
    hint: 'Kitchen is making your food',
    color: theme.bannerBg,
    bg: '#F0E4E6',
  },
  PACKED: {
    label: 'Ready',
    hint: 'Waiting for delivery partner',
    color: theme.bannerBg,
    bg: '#F0E4E6',
  },
  OUT_FOR_DELIVERY: {
    label: 'On the way',
    hint: 'Partner is bringing your order',
    color: theme.delivery,
    bg: '#E4F0F2',
  },
  DELIVERED: {
    label: 'Delivered',
    hint: 'Enjoy your meal',
    color: theme.success,
    bg: theme.successSoft,
  },
  CANCELLED: {
    label: 'Cancelled',
    hint: 'This order was cancelled',
    color: theme.discount,
    bg: '#F5E0E0',
  },
};

function statusCopy(status: string) {
  return (
    STATUS_COPY[status] ?? {
      label: status.replaceAll('_', ' '),
      hint: 'Tap for more details',
      color: theme.muted,
      bg: theme.neutralSoft,
    }
  );
}

export default function OrdersTab() {
  const { hasToken } = useAuthSession();

  useEffect(() => {
    if (hasToken === false) {
      openLogin(ORDERS_RETURN);
    }
  }, [hasToken]);

  const orders = useQuery({
    queryKey: ['mobile-orders'],
    queryFn: () => apiRequest<Order[]>('/orders/my'),
    enabled: hasToken === true,
    retry: false,
  });

  useEffect(() => {
    if (hasToken !== true || !orders.isError) return;
    const msg = (orders.error as Error)?.message?.toLowerCase() ?? '';
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('sign in')) {
      openLogin(ORDERS_RETURN);
    }
  }, [hasToken, orders.isError, orders.error]);

  if (hasToken !== true) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const list = orders.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Orders" showCart layout="leading" />

      {orders.isLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
            gap: spacing.sm,
            flexGrow: 1,
          }}
        >
          {!list.length ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 64,
                paddingHorizontal: spacing.xl,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: theme.white,
                  borderWidth: 1,
                  borderColor: theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.md,
                }}
              >
                <Ionicons name="receipt-outline" size={28} color={theme.muted} />
              </View>
              <Text style={{ fontWeight: '800', fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>
                No orders yet
              </Text>
              <Text
                style={{
                  color: theme.muted,
                  marginTop: 6,
                  textAlign: 'center',
                  fontSize: 13,
                  lineHeight: 19,
                  maxWidth: 240,
                }}
              >
                When you order food, it will show up here so you can track it.
              </Text>
              <Pressable
                onPress={() => router.push('/restaurants')}
                style={{
                  marginTop: spacing.xl,
                  backgroundColor: theme.bannerBg,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: radius.sm,
                }}
              >
                <Text style={{ color: theme.white, fontWeight: '700', fontSize: 13 }}>Browse restaurants</Text>
              </Pressable>
            </View>
          ) : (
            list.map((order) => {
              const meta = statusCopy(order.status);
              const placedAt = new Date(order.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              });
              const canTrack = !['DELIVERED', 'CANCELLED'].includes(order.status);
              const restaurant =
                order.restaurantNames && order.restaurantNames.length > 1
                  ? `${order.restaurantNames[0]} +${order.restaurantNames.length - 1}`
                  : order.restaurantName ?? 'Restaurant';
              const itemsLine = order.itemPreview
                ? `${order.itemPreview}${order.moreItemCount ? ` +${order.moreItemCount} more` : ''}`
                : order.itemCount
                  ? `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`
                  : 'Your order';
              const qtyLabel =
                order.itemCount != null
                  ? `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`
                  : null;

              return (
                <Pressable
                  key={order._id}
                  onPress={() =>
                    router.push({
                      pathname: canTrack ? '/orders/[id]' : '/orders/details/[id]',
                      params: { id: order._id },
                    })
                  }
                  style={styles.card}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        backgroundColor: theme.neutralSoft,
                        overflow: 'hidden',
                      }}
                    >
                      {order.previewImageUrl ? (
                        <Image
                          source={{ uri: order.previewImageUrl }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="fast-food-outline" size={22} color={theme.muted} />
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={{ fontWeight: '800', fontSize: 14, color: theme.text }}
                            numberOfLines={1}
                          >
                            {restaurant}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: theme.muted, marginTop: 3, lineHeight: 16 }}
                            numberOfLines={2}
                          >
                            {itemsLine}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                            {placedAt}
                            {qtyLabel ? ` · ${qtyLabel}` : ''}
                          </Text>
                        </View>
                        <Text style={{ fontWeight: '800', fontSize: 14, color: theme.text }}>
                          {formatMoney('₹', order.grandTotal)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
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
                    <Text style={{ flex: 1, fontSize: 11, color: theme.muted }} numberOfLines={1}>
                      {meta.hint}
                    </Text>
                    {canTrack ? (
                      <Pressable
                        hitSlop={4}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: theme.bannerBg,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: radius.sm,
                        }}
                        onPress={() =>
                          router.push({ pathname: '/orders/[id]', params: { id: order._id } })
                        }
                      >
                        <Ionicons name="locate-outline" size={14} color={theme.white} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.white }}>Track</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                        onPress={() =>
                          router.push({ pathname: '/orders/details/[id]', params: { id: order._id } })
                        }
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>Details</Text>
                        <Ionicons name="chevron-forward" size={14} color={theme.muted} />
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
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
