import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { formatWhen, money, statusLabel } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

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
  { key: 'completed', label: 'Done' },
] as const;

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bucket?: string }>();
  const initial =
    params.bucket === 'active' || params.bucket === 'completed' || params.bucket === 'new'
      ? params.bucket
      : 'new';
  const [bucket, setBucket] = useState<(typeof tabs)[number]['key']>(initial);

  useEffect(() => {
    if (params.bucket === 'active' || params.bucket === 'completed' || params.bucket === 'new') {
      setBucket(params.bucket);
    }
  }, [params.bucket]);

  const orders = useQuery({
    queryKey: ['vendor-orders', bucket],
    queryFn: () => apiRequest<Row[]>(`/vendor/orders?bucket=${bucket}`),
    refetchInterval: 5000,
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Orders" subtitle="Kitchen queue" />
      <View style={styles.chips}>
        {tabs.map((t) => {
          const selected = bucket === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setBucket(t.key)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {orders.isLoading && !orders.data ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
      ) : null}

      {orders.isError && !orders.data ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{(orders.error as Error).message}</Text>
          <Pressable onPress={() => orders.refetch()}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={orders.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 0,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
          gap: spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={orders.isFetching && !orders.isLoading}
            onRefresh={() => orders.refetch()}
          />
        }
        ListEmptyComponent={
          !orders.isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={28} color={theme.muted} />
              </View>
              <Text style={styles.emptyTitle}>No {bucket} orders</Text>
              <Text style={styles.emptyBody}>Orders in this queue will show up here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Link href={`/order/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.orderNo}>#{item.orderNumber}</Text>
                <View style={styles.statusChip}>
                  <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.itemCount} items · {money(item.subtotal)}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.payout}>{money(item.vendorPayoutAmount)} payout</Text>
                <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: theme.primaryDark,
    borderColor: theme.primaryDark,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: theme.text },
  chipTextActive: { color: theme.onPrimary },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNo: { fontSize: 15, fontWeight: '800', color: theme.text },
  statusChip: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '800', color: theme.primary },
  meta: { marginTop: 8, fontSize: 13, color: theme.muted, fontWeight: '600' },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payout: { fontSize: 14, fontWeight: '900', color: theme.success },
  when: { fontSize: 12, fontWeight: '600', color: theme.muted },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  emptyBody: { marginTop: 6, fontSize: 13, color: theme.muted, textAlign: 'center' },
  errorBox: { padding: spacing.xl, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
