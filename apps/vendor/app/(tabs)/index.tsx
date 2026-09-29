import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VendorLoginForm } from '../../components/VendorLoginForm';
import { apiRequest, clearTokens, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { name: string; status: string } | null;
  stats: {
    newOrders: number;
    activeOrders: number;
    todayOrderCount: number;
    todaySales: number;
    todayEarnings: number;
  };
};

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

  if (!signedIn) return <VendorLoginForm onSignedIn={() => setSignedIn(true)} />;

  return <SignedInVendorHome onSignedOut={() => setSignedIn(false)} />;
}

function SignedInVendorHome({ onSignedOut }: { onSignedOut: () => void }) {
  const insets = useSafeAreaInsets();
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    refetchInterval: 8000,
  });

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (me.isError || !me.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
        <Text>{(me.error as Error)?.message ?? 'Could not load shop'}</Text>
        <Pressable onPress={() => me.refetch()}>
          <Text style={{ color: theme.primary, marginTop: spacing.md }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const data = me.data;
  const shopOpen = data.acceptingOrders && data.vendor?.status === 'ACTIVE';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: 32 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{data.vendor?.name ?? 'My shop'}</Text>
      <Text style={{ color: theme.muted, marginTop: 4 }}>
        {shopOpen ? '● Open for orders' : '○ Not accepting orders'} · {data.approvalStatus}
      </Text>

      <View style={card}>
        <Text style={{ fontWeight: '700', color: theme.muted }}>Today</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', marginTop: 8 }}>₹{Math.round(data.stats.todayEarnings)} earnings</Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>
          {data.stats.todayOrderCount} orders · ₹{Math.round(data.stats.todaySales)} sales
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={[card, { flex: 1, marginTop: 0 }]}>
          <Text style={{ color: theme.muted, fontWeight: '700' }}>New</Text>
          <Text style={{ fontSize: 28, fontWeight: '800' }}>{data.stats.newOrders}</Text>
        </View>
        <View style={[card, { flex: 1, marginTop: 0 }]}>
          <Text style={{ color: theme.muted, fontWeight: '700' }}>Active</Text>
          <Text style={{ fontSize: 28, fontWeight: '800' }}>{data.stats.activeOrders}</Text>
        </View>
      </View>

      <Pressable
        onPress={async () => {
          await clearTokens();
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
