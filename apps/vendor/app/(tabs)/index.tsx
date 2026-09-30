import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
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

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { id: string; name: string; code: string; status: string } | null;
  stats: {
    newOrders: number;
    activeOrders: number;
    todayOrderCount: number;
    todaySales: number;
    todayEarnings: number;
  };
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    refetchInterval: 8000,
  });

  const data = me.data;
  const shopOpen = Boolean(data?.acceptingOrders && data?.vendor?.status === 'ACTIVE');
  const approved = data?.approvalStatus === 'APPROVED';

  if (me.isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (me.isError && !data) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.muted} />
        <Text style={styles.errorTitle}>{(me.error as Error).message || 'Could not load shop'}</Text>
        <Pressable onPress={() => me.refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={data?.vendor?.name ?? 'My shop'}
        subtitle={data?.vendor?.code ? `Code ${data.vendor.code}` : 'Dream Vendor'}
        statusOpen={shopOpen}
        statusLabel={shopOpen ? 'Open' : 'Closed'}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={me.isFetching && !me.isLoading} onRefresh={() => me.refetch()} />
        }
      >
        {!approved ? (
          <View style={[styles.card, styles.warningCard]}>
            <View style={styles.row}>
              <Ionicons name="shield-outline" size={20} color={theme.warning} />
              <Text style={styles.cardTitle}>Account pending</Text>
            </View>
            <Text style={styles.bodyMuted}>
              Admin still needs to approve this vendor staff account before you can accept orders.
            </Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Today’s earnings</Text>
          <Text style={styles.heroValue}>{money(data?.stats.todayEarnings ?? 0)}</Text>
          <Text style={styles.heroMeta}>
            {data?.stats.todayOrderCount ?? 0} orders · {money(data?.stats.todaySales ?? 0)} sales
          </Text>
        </View>

        <View style={styles.statRow}>
          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.statLabel}>New</Text>
            <Text style={styles.statValue}>{data?.stats.newOrders ?? 0}</Text>
            <Text style={styles.statHint}>Tap to review</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={styles.statValue}>{data?.stats.activeOrders ?? 0}</Text>
            <Text style={styles.statHint}>In kitchen</Text>
          </Pressable>
        </View>

        <Pressable style={styles.linkCard} onPress={() => router.push('/(tabs)/products')}>
          <View style={styles.linkIcon}>
            <Ionicons name="cube-outline" size={18} color={theme.delivery} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Manage products</Text>
            <Text style={styles.bodyMuted}>Update prices and availability</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>

        <Pressable style={styles.linkCard} onPress={() => router.push('/(tabs)/earnings')}>
          <View style={styles.linkIcon}>
            <Ionicons name="wallet-outline" size={18} color={theme.delivery} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>View earnings</Text>
            <Text style={styles.bodyMuted}>Week, month, and all-time payouts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
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
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  statLabel: { fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase' },
  statValue: { marginTop: 6, fontSize: 28, fontWeight: '900', color: theme.text },
  statHint: { marginTop: 4, fontSize: 12, color: theme.delivery, fontWeight: '600' },
  linkCard: {
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
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  warningCard: { backgroundColor: theme.warningSoft, borderColor: '#E5D2B8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  bodyMuted: { fontSize: 13, lineHeight: 19, color: theme.muted },
  errorTitle: {
    marginTop: spacing.md,
    fontWeight: '800',
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
  },
  retryText: { color: theme.onPrimary, fontWeight: '800' },
});
