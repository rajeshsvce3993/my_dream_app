import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { OrderMoney } from '../../components/OrderMoney';
import { OrderTicketHeader } from '../../components/OrderTicketHeader';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Row = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  vendorPayoutAmount: number;
  itemCount: number;
  items?: Array<{ quantity: number; name: string; lineTotal?: number }>;
  createdAt: string;
};

const periods = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Dates' },
] as const;

type Period = (typeof periods)[number]['key'];
const PAGE_SIZE = 8;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function periodRange(period: Period, from: Date, to: Date): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'all') return {};
  if (period === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (period === 'week') {
    const day = now.getDay();
    const start = startOfDay(now);
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { from: start.toISOString(), to: endOfDay(now).toISOString() };
  }
  if (period === 'month') {
    return {
      from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }
  const lo = startOfDay(from <= to ? from : to);
  const hi = endOfDay(from <= to ? to : from);
  return { from: lo.toISOString(), to: hi.toISOString() };
}

function dayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function DayPicker({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  const [cursor, setCursor] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <View style={styles.calendar}>
      <View style={styles.calHead}>
        <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={theme.primaryDark} />
        </Pressable>
        <Text style={styles.calTitle}>
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={theme.primaryDark} />
        </Pressable>
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`e-${index}`} style={styles.calCell} />;
          const selected =
            value.getFullYear() === year && value.getMonth() === month && value.getDate() === day;
          return (
            <Pressable
              key={day}
              onPress={() => onChange(new Date(year, month, day))}
              style={[styles.calCell, selected && styles.calCellOn]}
            >
              <Text style={[styles.calDay, selected && styles.calDayOn]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useOrderTotal(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['vendor-orders', 'count', range.from ?? '', range.to ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', limit: '1' });
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      return apiRequest<{ total: number }>(`/vendor/orders?${params.toString()}`);
    },
  });
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('all');
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState(() => startOfDay(new Date()));
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const range = useMemo(() => periodRange(period, fromDate, toDate), [period, fromDate, toDate]);
  const allTotal = useOrderTotal(periodRange('all', fromDate, toDate));
  const todayTotal = useOrderTotal(periodRange('today', fromDate, toDate));
  const weekTotal = useOrderTotal(periodRange('week', fromDate, toDate));
  const monthTotal = useOrderTotal(periodRange('month', fromDate, toDate));
  const totals: Record<Exclude<Period, 'custom'>, number | undefined> = {
    all: allTotal.data?.total,
    today: todayTotal.data?.total,
    week: weekTotal.data?.total,
    month: monthTotal.data?.total,
  };

  const orders = useQuery({
    queryKey: ['vendor-orders', 'history', period, range.from ?? '', range.to ?? '', page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      return apiRequest<{ items: Row[]; page: number; total: number; totalPages: number }>(
        `/vendor/orders?${params.toString()}`,
      );
    },
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Orders" subtitle="History" />
      <View style={styles.tabs}>
        {periods.map((tab) => {
          const selected = period === tab.key;
          const count = tab.key === 'custom' ? undefined : totals[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setPeriod(tab.key);
                setPage(1);
                setPicking(null);
              }}
              accessibilityLabel={tab.key === 'custom' ? 'Date range' : tab.label}
              style={[styles.tab, selected && styles.tabOn]}
            >
              {tab.key === 'custom' ? (
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={selected ? theme.primaryDark : theme.tabInactive}
                />
              ) : (
                <>
                  <Text style={[styles.tabCount, selected && styles.tabCountOn]}>{count ?? '–'}</Text>
                  <Text style={[styles.tabLabel, selected && styles.tabLabelOn]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
      {period === 'custom' ? (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <Pressable onPress={() => setPicking(picking === 'from' ? null : 'from')} style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>From</Text>
              <Text style={styles.dateFieldValue}>{dayLabel(fromDate)}</Text>
            </Pressable>
            <Pressable onPress={() => setPicking(picking === 'to' ? null : 'to')} style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>To</Text>
              <Text style={styles.dateFieldValue}>{dayLabel(toDate)}</Text>
            </Pressable>
          </View>
          {picking ? (
            <DayPicker
              value={picking === 'from' ? fromDate : toDate}
              onChange={(next) => {
                if (picking === 'from') setFromDate(startOfDay(next));
                else setToDate(startOfDay(next));
                setPage(1);
                setPicking(null);
              }}
            />
          ) : null}
        </View>
      ) : null}

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
        data={orders.data?.items ?? []}
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
        ListFooterComponent={
          orders.data && orders.data.total > 0 ? (
            <View style={styles.pager}>
              <Pressable
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.pageLabel}>
                {page} / {orders.data.totalPages}
              </Text>
              <Pressable
                disabled={page >= orders.data.totalPages}
                onPress={() => setPage((current) => current + 1)}
                style={[styles.pageBtn, page >= orders.data.totalPages && styles.pageBtnOff]}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !orders.isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={28} color={theme.muted} />
              </View>
              <Text style={styles.emptyTitle}>No orders</Text>
              <Text style={styles.emptyBody}>Nothing matches this status and date.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const lines = item.items?.length
            ? item.items
            : [{ quantity: item.itemCount, name: item.itemCount === 1 ? 'Item' : 'Items' }];
          return (
            <Link href={`/order/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <OrderTicketHeader orderNumber={item.orderNumber} status={item.status} createdAt={item.createdAt} />
                <View style={styles.cardBody}>
                  {lines.map((line, index) => (
                    <View key={`${item.id}-${index}`} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{line.quantity}</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {line.name}
                      </Text>
                      {line.lineTotal != null ? (
                        <Text style={styles.itemPrice}>{money(line.lineTotal)}</Text>
                      ) : null}
                    </View>
                  ))}
                  <View style={styles.money}>
                    <OrderMoney bill={item.subtotal} earnings={item.vendorPayoutAmount} />
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: theme.tabBarBg,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.tabBarBorder,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 11,
    minWidth: 0,
  },
  tabOn: { backgroundColor: theme.white, ...shadow.card },
  tabCount: { fontSize: 14, fontWeight: '800', color: theme.primaryDark },
  tabCountOn: { color: theme.primaryDark },
  tabLabel: { marginTop: 1, fontSize: 11, fontWeight: '700', color: theme.tabInactive },
  tabLabelOn: { color: theme.primaryDark },
  customBox: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 10 },
  customRow: { flexDirection: 'row', gap: 8 },
  dateField: {
    flex: 1,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dateFieldLabel: { fontSize: 11, fontWeight: '700', color: theme.muted },
  dateFieldValue: { marginTop: 2, fontSize: 14, fontWeight: '800', color: theme.text },
  calendar: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellOn: { backgroundColor: theme.primaryDark },
  calDay: { fontSize: 13, fontWeight: '700', color: theme.text },
  calDayOn: { color: theme.onPrimary },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardBody: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8, gap: 3 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQty: { width: 16, fontSize: 13, fontWeight: '800', color: theme.primaryDark },
  itemName: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.text },
  itemPrice: { fontSize: 12, fontWeight: '700', color: theme.text },
  money: { marginTop: 4, alignItems: 'flex-end' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  pageBtn: {
    minWidth: 92,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnOff: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: '800', color: theme.primaryDark },
  pageLabel: { fontSize: 13, fontWeight: '700', color: theme.muted },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
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
