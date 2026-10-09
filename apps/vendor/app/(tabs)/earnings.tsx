import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Period = { gross: number; commission: number; net: number; orders: number };

type Earnings = {
  today: Period;
  thisWeek: Period;
  thisMonth: Period;
  total: Period;
};

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const earnings = useQuery({
    queryKey: ['vendor-earnings'],
    queryFn: () => apiRequest<Earnings>('/vendor/me/earnings'),
  });

  const data = earnings.data;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Earnings" subtitle="Shop payouts" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24, gap: spacing.sm }}
        refreshControl={
          <RefreshControl
            refreshing={earnings.isFetching && !earnings.isLoading}
            onRefresh={() => earnings.refetch()}
          />
        }
      >
        {earnings.isLoading && !data ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
        ) : null}

        {earnings.isError && !data ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{(earnings.error as Error).message}</Text>
            <Pressable onPress={() => earnings.refetch()}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {data
          ? (
              [
                { title: 'All time', row: data.total },
                { title: 'Today', row: data.today },
                { title: 'This week', row: data.thisWeek },
                { title: 'This month', row: data.thisMonth },
              ] as const
            ).map((block) => (
              <View key={block.title} style={styles.card}>
                <View style={styles.header}>
                  <Text style={styles.title}>{block.title}</Text>
                </View>
                <View style={styles.body}>
                <View style={styles.line}>
                  <Text style={styles.name}>Sales</Text>
                  <Text style={styles.sales}>{money(block.row.gross)}</Text>
                </View>
                <View style={styles.line}>
                  <Text style={styles.name}>Earnings</Text>
                  <Text style={styles.earnings}>{money(block.row.net)}</Text>
                </View>
                <View style={styles.line}>
                  <Text style={styles.name}>Orders</Text>
                  <Text style={styles.orders}>{block.row.orders}</Text>
                </View>
                </View>
              </View>
            ))
          : null}
      </ScrollView>
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
  header: {
    backgroundColor: '#F7F4EF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  body: { paddingVertical: 8, paddingHorizontal: 12, gap: 4 },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A5563',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { fontSize: 12, fontWeight: '700', color: theme.muted },
  sales: { fontSize: 15, fontWeight: '800', color: '#1A5563' },
  earnings: { fontSize: 15, fontWeight: '800', color: theme.primaryDark },
  orders: { fontSize: 15, fontWeight: '800', color: theme.delivery },
  errorBox: { padding: spacing.lg, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
