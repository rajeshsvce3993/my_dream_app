import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeliveryLoginForm } from '../../components/DeliveryLoginForm';
import { apiRequest, clearTokens, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Offer = {
  id: string;
  expiresAt: string;
  order: {
    orderNumber: string;
    earning: number;
    currency: string;
    pickupNames: string[];
    deliveryAddress: { line1: string; city: string };
  };
};

type ActiveOrder = {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: { line1: string; city: string };
  deliveryEarning?: number;
  shippingTotal: number;
  currency: string;
};

type Me = {
  availability: 'ONLINE' | 'OFFLINE';
  approvalStatus: string;
  offer: Offer | null;
  activeOrder: ActiveOrder | null;
};

function money(currency: string, amount: number) {
  return `${currency === 'INR' ? '₹' : `${currency} `}${Math.round(amount)}`;
}

export default function HomeScreen() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasSession()
      .then((ok) => {
        if (!mounted) return;
        setSignedIn(ok);
        setSessionReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSignedIn(false);
        setSessionReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!sessionReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return <DeliveryLoginForm onSignedIn={() => setSignedIn(true)} />;
  }

  return <SignedInDeliveryHome onSignedOut={() => setSignedIn(false)} />;
}

function SignedInDeliveryHome({ onSignedOut }: { onSignedOut: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [banner, setBanner] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['delivery-me'],
    queryFn: () => apiRequest<Me>('/delivery/me'),
    refetchInterval: 4000,
    retry: 1,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const availability = useMutation({
    mutationFn: (next: 'ONLINE' | 'OFFLINE') =>
      apiRequest('/delivery/me/availability', {
        method: 'POST',
        body: JSON.stringify({ availability: next }),
      }),
    onSuccess: () => {
      setBanner(null);
      qc.invalidateQueries({ queryKey: ['delivery-me'] });
    },
    onError: (err: Error) => setBanner(err.message),
  });

  const accept = useMutation({
    mutationFn: (offerId: string) => apiRequest(`/delivery/offers/${offerId}/accept`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => {
      setBanner(err.message);
      qc.invalidateQueries({ queryKey: ['delivery-me'] });
    },
  });

  const reject = useMutation({
    mutationFn: (offerId: string) => apiRequest(`/delivery/offers/${offerId}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
  });

  const pickup = useMutation({
    mutationFn: () => apiRequest('/delivery/me/pickup', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => setBanner(err.message),
  });

  const deliver = useMutation({
    mutationFn: () => apiRequest('/delivery/me/deliver', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => setBanner(err.message),
  });

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (me.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: theme.bg }}>
        <Text style={{ fontWeight: '700', marginBottom: spacing.md }}>
          {(me.error as Error).message || 'No internet connection. We’ll reconnect automatically.'}
        </Text>
        <Pressable onPress={() => me.refetch()}>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const data = me.data!;
  const online = data.availability === 'ONLINE';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const secondsLeft = data.offer ? Math.max(0, Math.ceil((new Date(data.offer.expiresAt).getTime() - now) / 1000)) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: insets.bottom + 32 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{greeting}</Text>
      <View style={card}>
        <Text style={{ color: theme.muted, fontWeight: '700' }}>Delivery status</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>{online ? '● Online' : '○ Offline'}</Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>
          {online ? 'You’re available for deliveries.' : 'You’re not receiving new deliveries.'}
        </Text>
        <Pressable
          onPress={() => availability.mutate(online ? 'OFFLINE' : 'ONLINE')}
          style={{
            marginTop: spacing.lg,
            backgroundColor: online ? theme.text : theme.primary,
            padding: 14,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>{online ? 'Go offline' : 'Go online'}</Text>
        </Pressable>
      </View>

      {banner ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{banner}</Text> : null}

      {data.activeOrder ? (
        <View style={card}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Active delivery</Text>
          <Text style={{ marginTop: 6 }}>Order #{data.activeOrder.orderNumber}</Text>
          <Text style={{ color: theme.muted, marginTop: 4 }}>
            {data.activeOrder.deliveryAddress.line1}, {data.activeOrder.deliveryAddress.city}
          </Text>
          <Text style={{ marginTop: 8, fontWeight: '700' }}>
            {money(data.activeOrder.currency, data.activeOrder.deliveryEarning ?? data.activeOrder.shippingTotal)}
          </Text>
          {data.activeOrder.status === 'READY_FOR_PICKUP' ? (
            <Pressable onPress={() => pickup.mutate()} style={primaryBtn}>
              <Text style={primaryLabel}>{pickup.isPending ? 'Updating…' : 'Picked up'}</Text>
            </Pressable>
          ) : null}
          {data.activeOrder.status === 'OUT_FOR_DELIVERY' ? (
            <Pressable onPress={() => deliver.mutate()} style={primaryBtn}>
              <Text style={primaryLabel}>{deliver.isPending ? 'Updating…' : 'Delivered'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!data.activeOrder && data.offer && online ? (
        <View style={card}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>New delivery</Text>
          <Text style={{ marginTop: 8 }}>Order #{data.offer.order.orderNumber}</Text>
          <Text style={{ color: theme.muted, marginTop: 8 }}>Pickup</Text>
          <Text style={{ fontWeight: '700' }}>{data.offer.order.pickupNames.join(', ') || 'Store'}</Text>
          <Text style={{ color: theme.muted, marginTop: 8 }}>Deliver to</Text>
          <Text style={{ fontWeight: '700' }}>
            {data.offer.order.deliveryAddress.line1}, {data.offer.order.deliveryAddress.city}
          </Text>
          <Text style={{ marginTop: 8, fontWeight: '800' }}>
            Estimated earnings {money(data.offer.order.currency, data.offer.order.earning)}
          </Text>
          <Text style={{ color: theme.muted, marginTop: 6 }}>Expires in {secondsLeft} seconds</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.lg }}>
            <Pressable onPress={() => reject.mutate(data.offer!.id)} style={[primaryBtn, { flex: 1, backgroundColor: theme.border, marginTop: 0 }]}>
              <Text style={{ fontWeight: '800' }}>Reject</Text>
            </Pressable>
            <Pressable
              onPress={() => accept.mutate(data.offer!.id)}
              disabled={accept.isPending || secondsLeft <= 0}
              style={[primaryBtn, { flex: 2, marginTop: 0 }]}
            >
              <Text style={primaryLabel}>{accept.isPending ? 'Accepting…' : 'Accept delivery'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!data.activeOrder && !data.offer ? (
        <Text style={{ color: theme.muted, textAlign: 'center', marginTop: spacing.xl }}>
          {online ? 'Waiting for a delivery offer.' : 'Go online to receive deliveries.'}
        </Text>
      ) : null}

      <Pressable
        onPress={async () => {
          await clearTokens();
          qc.removeQueries({ queryKey: ['delivery-me'] });
          onSignedOut();
        }}
        style={{ marginTop: spacing.xl, alignItems: 'center' }}
      >
        <Text style={{ color: theme.muted }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginTop: spacing.lg,
  borderWidth: 1,
  borderColor: theme.border,
};

const primaryBtn = {
  marginTop: spacing.lg,
  backgroundColor: theme.primary,
  padding: 14,
  borderRadius: radius.md,
  alignItems: 'center' as const,
};

const primaryLabel = { color: 'white', fontWeight: '800' as const };
