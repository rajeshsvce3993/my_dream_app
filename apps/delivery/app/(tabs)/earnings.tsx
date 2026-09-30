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

type Earnings = {
  currency: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  deliveries?: number;
};

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const earnings = useQuery({
    queryKey: ['delivery-earnings'],
    queryFn: () => apiRequest<Earnings>('/delivery/me/earnings'),
  });

  const data = earnings.data;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Earnings" subtitle="Delivery payouts" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={earnings.isFetching && !earnings.isLoading} onRefresh={() => earnings.refetch()} />
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
              <Text style={styles.heroLabel}>Today</Text>
              <Text style={styles.heroValue}>{money(data.currency, data.today)}</Text>
              <View style={styles.heroMeta}>
                <Ionicons name="bicycle-outline" size={14} color={theme.onHeaderMuted} />
                <Text style={styles.heroMetaText}>
                  {data.deliveries ?? 0} completed {data.deliveries === 1 ? 'delivery' : 'deliveries'} total
                </Text>
              </View>
            </View>

            {(
              [
                { label: 'This week', value: data.thisWeek, icon: 'calendar-outline' as const },
                { label: 'This month', value: data.thisMonth, icon: 'stats-chart-outline' as const },
                { label: 'All time', value: data.total, icon: 'trophy-outline' as const },
              ] as const
            ).map((row) => (
              <View key={row.label} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name={row.icon} size={18} color={theme.delivery} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                </View>
                <Text style={styles.rowValue}>{money(data.currency, row.value)}</Text>
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
  heroMeta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: { color: theme.onHeaderMuted, fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
  rowValue: { fontSize: 17, fontWeight: '900', color: theme.primaryDark },
  errorBox: { padding: spacing.lg, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
