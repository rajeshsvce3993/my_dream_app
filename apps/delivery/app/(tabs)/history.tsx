import { useQuery } from '@tanstack/react-query';
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
import { formatDeliveredAt, money } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Row = {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryEarning?: number;
  shippingTotal: number;
  currency: string;
  deliveredAt?: string;
  deliveryAddress?: { line1?: string; city?: string };
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const history = useQuery({
    queryKey: ['delivery-history'],
    queryFn: () => apiRequest<Row[]>('/delivery/me/history'),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="History" subtitle="Past deliveries" />
      {history.isLoading && !history.data ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
      ) : null}
      {history.isError && !history.data ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{(history.error as Error).message}</Text>
          <Pressable onPress={() => history.refetch()}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={history.data ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
          gap: spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={history.isFetching && !history.isLoading}
            onRefresh={() => history.refetch()}
          />
        }
        ListEmptyComponent={
          history.isSuccess ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={28} color={theme.muted} />
              </View>
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyBody}>Completed and cancelled jobs will show up here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const delivered = item.status === 'DELIVERED';
          const address = [item.deliveryAddress?.line1, item.deliveryAddress?.city]
            .filter(Boolean)
            .join(', ');
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.orderNo}>#{item.orderNumber}</Text>
                <View style={[styles.chip, delivered ? styles.chipSuccess : styles.chipDanger]}>
                  <Text style={[styles.chipText, { color: delivered ? theme.success : theme.danger }]}>
                    {delivered ? 'Delivered' : item.status.replaceAll('_', ' ')}
                  </Text>
                </View>
              </View>
              {address ? (
                <Text style={styles.address} numberOfLines={2}>
                  {address}
                </Text>
              ) : null}
              <View style={styles.cardBottom}>
                <Text style={styles.earn}>
                  {money(item.currency, item.deliveryEarning ?? item.shippingTotal)}
                </Text>
                {item.deliveredAt ? (
                  <Text style={styles.when}>{formatDeliveredAt(item.deliveredAt)}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderNo: { fontSize: 15, fontWeight: '800', color: theme.text },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  chipSuccess: { backgroundColor: theme.successSoft },
  chipDanger: { backgroundColor: theme.dangerSoft },
  chipText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  address: { marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 18 },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earn: { fontSize: 16, fontWeight: '900', color: theme.primaryDark },
  when: { fontSize: 12, fontWeight: '600', color: theme.muted },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: spacing.xl },
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
  emptyBody: {
    marginTop: 6,
    fontSize: 13,
    color: theme.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBox: { padding: spacing.xl, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
