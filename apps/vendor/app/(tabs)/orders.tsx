import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Row = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  vendorPayoutAmount: number;
  itemCount: number;
  createdAt: string;
};

const tabs = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
] as const;

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [bucket, setBucket] = useState<(typeof tabs)[number]['key']>('new');
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const orders = useQuery({
    queryKey: ['vendor-orders', bucket],
    queryFn: () => apiRequest<Row[]>(`/vendor/orders?bucket=${bucket}`),
    enabled: authed === true,
    refetchInterval: 5000,
  });

  if (authed === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!authed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
        <Text style={{ textAlign: 'center', color: theme.muted }}>Sign in on the Home tab.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg }}>Orders</Text>
      <View style={{ flexDirection: 'row', gap: 8, padding: spacing.lg }}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setBucket(t.key)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              backgroundColor: bucket === t.key ? theme.primary : theme.surface,
            }}
          >
            <Text style={{ color: bucket === t.key ? '#fff' : theme.text, fontWeight: '700' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {orders.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
      {orders.isError ? <Text style={{ padding: spacing.lg }}>{(orders.error as Error).message}</Text> : null}
      <FlatList
        data={orders.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        ListEmptyComponent={!orders.isLoading ? <Text style={{ color: theme.muted, textAlign: 'center' }}>No orders</Text> : null}
        renderItem={({ item }) => (
          <Link href={`/order/${item.id}`} asChild>
            <Pressable style={card}>
              <Text style={{ fontWeight: '800' }}>#{item.orderNumber}</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                {item.status} · {item.itemCount} items · ₹{Math.round(item.subtotal)}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginBottom: spacing.md,
  borderWidth: 1,
  borderColor: theme.border,
};
