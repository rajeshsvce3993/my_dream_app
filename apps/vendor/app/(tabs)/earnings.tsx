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
import { Ionicons } from '@expo/vector-icons';
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
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

        {data ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Today net</Text>
              <Text style={styles.heroValue}>{money(data.today.net)}</Text>
              <Text style={styles.heroMeta}>
                Gross {money(data.today.gross)} · Commission {money(data.today.commission)} ·{' '}
                {data.today.orders} orders
              </Text>
            </View>

            {(
              [
                { title: 'This week', row: data.thisWeek, icon: 'calendar-outline' as const },
                { title: 'This month', row: data.thisMonth, icon: 'stats-chart-outline' as const },
                { title: 'All time', row: data.total, icon: 'trophy-outline' as const },
              ] as const
            ).map((block) => (
              <View key={block.title} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.icon}>
                    <Ionicons name={block.icon} size={18} color={theme.delivery} />
                  </View>
                  <Text style={styles.cardTitle}>{block.title}</Text>
                  <Text style={styles.cardNet}>{money(block.row.net)}</Text>
                </View>
                <Text style={styles.cardMeta}>
                  Gross {money(block.row.gross)} · Fee {money(block.row.commission)} · {block.row.orders}{' '}
                  orders
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  hero: {
    backgroundColor: theme.headerBg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.onHeaderMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: -1,
  },
  heroMeta: { marginTop: spacing.sm, color: theme.onHeaderMuted, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.text },
  cardNet: { fontSize: 18, fontWeight: '900', color: theme.primaryDark },
  cardMeta: { marginTop: 10, fontSize: 12, color: theme.muted, fontWeight: '600' },
  errorBox: { padding: spacing.lg, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
