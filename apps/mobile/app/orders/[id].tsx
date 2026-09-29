import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router, Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderPlacedCelebration } from '../../components/OrderPlacedCelebration';
import { Ionicons } from '@expo/vector-icons';
import { OrderTimeline } from '../../components/OrderTimeline';
import { apiRequest } from '../../lib/api';
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
  items: Array<{ quantity: number; productName?: { en: string }; imageUrl?: string }>;
  tracking?: { partner: string; trackingId: string };
};

function etaMinutes(status: string): number | null {
  if (status === 'OUT_FOR_DELIVERY') return 8;
  if (status === 'PACKED' || status === 'PROCESSING') return 18;
  return null;
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
    refetchInterval: 30_000,
  });

  if (detail.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Order tracking" showBack layout="centered" />
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

  const { order, tracking } = detail.data;
  const eta = etaMinutes(order.status);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="Order tracking"
        showBack
        layout="centered"
        right={
          <Link href={{ pathname: '/orders/details/[id]', params: { id: String(id) } }} asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>View</Text>
            </Pressable>
          </Link>
        }
      />

      <View style={{ height: 220, backgroundColor: theme.successSoft }}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800' }}
          style={{ width: '100%', height: '100%', opacity: 0.85 }}
        />
        {eta != null ? (
          <View
            style={{
              position: 'absolute',
              top: spacing.lg,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.primaryDark,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="timer-outline" size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '800' }}>Arriving in {eta} mins</Text>
          </View>
        ) : null}
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: '45%',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.info,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="bicycle" size={20} color="white" />
          </View>
          <View style={{ backgroundColor: 'white', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 9, fontWeight: '700' }}>PARTNER</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          marginTop: -24,
          backgroundColor: theme.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.lg,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        >
          <OrderPlacedCelebration orderNumber={order.orderNumber} visible={showCelebration} />
          <OrderTimeline current={order.status} timeline={order.timeline} />
          {tracking ? (
            <Text style={{ color: theme.muted, marginTop: spacing.md, fontSize: 13 }}>
              {tracking.partner} · {tracking.trackingId}
            </Text>
          ) : null}
          <Text style={{ fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm }}>Items</Text>
          {detail.data.items.map((item, idx) => (
            <Text key={idx} style={{ color: theme.muted, marginBottom: 4 }}>
              {item.productName?.en} ×{item.quantity}
            </Text>
          ))}
          <Text style={{ fontWeight: '800', marginTop: spacing.md }}>₹{order.grandTotal.toFixed(0)}</Text>
        </ScrollView>
      </View>
    </View>
  );
}
