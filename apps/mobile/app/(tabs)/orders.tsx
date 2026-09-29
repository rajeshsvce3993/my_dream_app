import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { openLogin } from '../../lib/openLogin';
import { useAuthSession } from '../../lib/useAuthSession';
import { theme, spacing, radius, shadow } from '../../lib/theme';
import { screenHeaderStyles as h } from '../../lib/screenHeaderStyles';

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

const ORDERS_RETURN = '/(tabs)/orders';

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Orders" showCart layout="leading" />

      {orders.isLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : orders.isError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={h.bodyPadding}>
          {!orders.data?.length ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Your first order is waiting</Text>
              <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>
                Browse nearby stores and checkout in minutes.
              </Text>
              <Link href="/" asChild>
                <Pressable
                  style={{
                    marginTop: spacing.lg,
                    backgroundColor: theme.primary,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Start shopping</Text>
                </Pressable>
              </Link>
            </View>
          ) : null}
          {(orders.data ?? []).map((order) => (
            <View
              key={order._id}
              style={{
                backgroundColor: theme.surface,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginBottom: spacing.sm,
                ...shadow.card,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800' }}>#{order.orderNumber}</Text>
                <Text style={{ color: theme.primary, fontWeight: '800' }}>₹{order.grandTotal.toFixed(0)}</Text>
              </View>
              <Text style={{ color: theme.muted, marginTop: 4 }}>{order.status.replaceAll('_', ' ')}</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: spacing.sm,
                }}
              >
                <Link href={{ pathname: '/orders/[id]', params: { id: order._id } }} asChild>
                  <Pressable hitSlop={8}>
                    <Text style={{ color: theme.delivery, fontWeight: '700', fontSize: 13 }}>Track order →</Text>
                  </Pressable>
                </Link>
                <Link href={{ pathname: '/orders/details/[id]', params: { id: order._id } }} asChild>
                  <Pressable hitSlop={8}>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>View</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
