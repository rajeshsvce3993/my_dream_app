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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { formatDeliveredAt, money, orderSerial } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Row = {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryEarning?: number;
  shippingTotal: number;
  collectAmount?: number;
  paymentMethod?: string;
  earning?: number;
  grandTotal?: number;
  currency: string;
  deliveredAt?: string;
  updatedAt?: string;
  deliveryAddress?: { line1?: string; city?: string };
};

function statusCopy(status: string) {
  if (status === 'DELIVERED') return { label: 'Delivered', bg: theme.successSoft, color: theme.success };
  if (status === 'CANCELLED') return { label: 'Cancelled', bg: theme.dangerSoft, color: theme.danger };
  return { label: 'Closed', bg: '#E4F1F4', color: '#1A5563' };
}

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
          padding: spacing.md,
          paddingBottom: insets.bottom + 24,
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
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyBody}>Completed and cancelled orders show up here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const status = statusCopy(item.status);
          const address = [item.deliveryAddress?.line1, item.deliveryAddress?.city].filter(Boolean).join(', ');
          const cod = !item.paymentMethod || item.paymentMethod === 'COD';
          const when = formatDeliveredAt(item.deliveredAt ?? item.updatedAt);
          return (
            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.serial} numberOfLines={1}>
                  {orderSerial(item.orderNumber)}
                </Text>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                </View>
                <Text style={styles.when} numberOfLines={1}>
                  {when}
                </Text>
              </View>
              <View style={styles.body}>
                {address ? (
                  <View style={styles.place}>
                    <Text style={styles.placeLabel}>{item.status === 'DELIVERED' ? 'Delivered to' : 'Address'}</Text>
                    <Text style={styles.placeValue} numberOfLines={2}>
                      {address}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.money}>
                  <View style={styles.pair}>
                    <Text style={styles.moneyLabel}>Earnings</Text>
                    <Text style={styles.earn}>{money(item.currency, item.earning ?? item.deliveryEarning ?? 0)}</Text>
                  </View>
                  <View style={styles.rule} />
                  <View style={styles.pair}>
                    <Text style={styles.moneyLabel}>{cod ? 'Collect' : 'Paid'}</Text>
                    <Text style={styles.collect}>
                      {cod ? money(item.currency, item.collectAmount ?? item.grandTotal ?? 0) : 'Online'}
                    </Text>
                  </View>
                </View>
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
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F7F4EF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  serial: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1A5563' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700' },
  when: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '600', color: theme.muted },
  body: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 8 },
  place: { gap: 2 },
  placeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B70',
  },
  placeValue: { fontSize: 13, fontWeight: '600', color: theme.text, lineHeight: 18 },
  money: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  pair: { alignItems: 'flex-end' },
  moneyLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B70',
  },
  earn: { marginTop: 1, fontSize: 13, fontWeight: '800', color: theme.primaryDark },
  collect: { marginTop: 1, fontSize: 13, fontWeight: '800', color: '#1A5563' },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.border, marginVertical: 1 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  emptyBody: { marginTop: 4, fontSize: 13, color: theme.muted, textAlign: 'center', lineHeight: 18 },
  errorBox: { padding: spacing.xl, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
