import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { CancelReasonForm } from '../../components/CancelReasonForm';
import { OrderMoney } from '../../components/OrderMoney';
import { OrderTicketHeader } from '../../components/OrderTicketHeader';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';
import { kitchenActionLabel } from '../../lib/orderActions';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type QueueOrder = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  vendorPayoutAmount: number;
  itemCount: number;
  items: Array<{ quantity: number; name: string; lineTotal?: number }>;
  createdAt: string;
  allowedNextStatuses: string[];
};

const homeTabs = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
] as const;

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
  const qc = useQueryClient();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [bucket, setBucket] = useState<(typeof homeTabs)[number]['key']>('new');
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    refetchInterval: 8000,
  });

  const toggleOrders = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiRequest('/vendor/me/accepting-orders', {
        method: 'POST',
        body: JSON.stringify({ acceptingOrders }),
      }),
    onSuccess: () => {
      setToggleError(null);
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
    },
    onError: (err: Error) => setToggleError(err.message),
  });

  const queue = useQuery({
    queryKey: ['vendor-orders', bucket],
    queryFn: () => apiRequest<QueueOrder[]>(`/vendor/orders?bucket=${bucket}`),
    enabled: me.data?.approvalStatus === 'APPROVED',
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string; reason?: string }) =>
      apiRequest(`/vendor/orders/${input.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status, reason: input.reason }),
      }),
    onSuccess: () => {
      setActionError(null);
      setCancelId(null);
      setCancelReason('');
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      qc.invalidateQueries({ queryKey: ['vendor-earnings'] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const data = me.data;
  const vendorActive = data?.vendor?.status === 'ACTIVE';
  const shopOpen = Boolean(data?.acceptingOrders && vendorActive);
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

  function onToggleShop() {
    if (!data) return;
    if (!vendorActive) {
      setToggleError('This shop is inactive, so the switch stays off. Ask admin to set the shop to Active.');
      return;
    }
    setToggleError(null);
    toggleOrders.mutate(!shopOpen);
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
          <RefreshControl
            refreshing={(me.isFetching && !me.isLoading) || (queue.isFetching && !queue.isLoading)}
            onRefresh={() => {
              void me.refetch();
              void queue.refetch();
            }}
          />
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

        <View style={styles.availability}>
          <View style={styles.statusDotWrap}>
            <View style={[styles.statusDot, shopOpen ? styles.statusDotOn : styles.statusDotOff]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.availabilityTitle}>{shopOpen ? 'Open for orders' : 'Closed'}</Text>
            <Text style={styles.availabilityHint}>
              {shopOpen
                ? 'Customers can order from this shop'
                : vendorActive
                  ? 'New orders are paused'
                  : 'Shop is inactive, so it stays closed'}
            </Text>
          </View>
          <Pressable
            onPress={onToggleShop}
            disabled={!data || toggleOrders.isPending || !approved}
            accessibilityRole="switch"
            accessibilityState={{ checked: shopOpen }}
            accessibilityLabel={shopOpen ? 'Close shop' : 'Open shop'}
            style={[styles.switch, shopOpen && styles.switchOn, (!approved || toggleOrders.isPending) && { opacity: 0.55 }]}
          >
            <View style={[styles.knob, shopOpen && styles.knobOn]} />
          </Pressable>
        </View>
        {toggleError ? <Text style={styles.toggleError}>{toggleError}</Text> : null}

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Today’s earnings</Text>
            <Text style={styles.heroMeta}>
              {data?.stats.todayOrderCount ?? 0} orders · Sales {money(data?.stats.todaySales ?? 0)}
            </Text>
          </View>
          <Text style={styles.heroValue}>{money(data?.stats.todayEarnings ?? 0)}</Text>
        </View>

        {approved ? (
          <View style={styles.queue}>
            <View style={styles.tabs}>
              {homeTabs.map((tab) => {
                const selected = bucket === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      setCancelId(null);
                      setCancelReason('');
                      setBucket(tab.key);
                    }}
                    style={[styles.tab, selected && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, selected && styles.tabTextOn]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {actionError ? <Text style={styles.toggleError}>{actionError}</Text> : null}
            {queue.isLoading && !queue.data ? <ActivityIndicator color={theme.primary} /> : null}
            {queue.isError && !queue.data ? (
              <Pressable onPress={() => queue.refetch()}>
                <Text style={styles.toggleError}>{(queue.error as Error).message || 'Could not load orders'}</Text>
              </Pressable>
            ) : null}
            {(queue.data ?? []).length === 0 && !queue.isLoading ? (
              <Text style={styles.queueEmpty}>
                {bucket === 'new'
                  ? 'No new orders'
                  : bucket === 'active'
                    ? 'No orders in the kitchen'
                    : 'No finished orders'}
              </Text>
            ) : null}
            {(queue.data ?? []).map((order) => {
              const forward =
                bucket === 'new'
                  ? order.allowedNextStatuses.filter((status) => status === 'PROCESSING')
                  : bucket === 'active'
                    ? order.allowedNextStatuses.filter((status) => status !== 'CANCELLED')
                    : [];
              const canCancel = bucket !== 'completed' && order.allowedNextStatuses.includes('CANCELLED');
              const cancelling = cancelId === order.id;
              const busy = updateStatus.isPending && updateStatus.variables?.id === order.id;
              const lines = order.items?.length
                ? order.items
                : [{ quantity: order.itemCount, name: order.itemCount === 1 ? 'Item' : 'Items' }];
              const hasActions = !cancelling && (forward.length > 0 || canCancel);
              return (
                <View key={order.id} style={styles.orderCard}>
                  <Pressable onPress={() => router.push(`/order/${order.id}`)}>
                    <OrderTicketHeader
                      orderNumber={order.orderNumber}
                      status={order.status}
                      createdAt={order.createdAt}
                    />
                    <View style={styles.ticketBody}>
                      {lines.map((item, index) => (
                        <View key={`${order.id}-${index}`} style={styles.itemRow}>
                          <Text style={styles.itemQty}>{item.quantity}</Text>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.lineTotal != null ? (
                            <Text style={styles.itemPrice}>{money(item.lineTotal)}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </Pressable>
                  {cancelling ? (
                    <View style={styles.ticketActions}>
                      <CancelReasonForm
                        value={cancelReason}
                        onChange={setCancelReason}
                        pending={busy}
                        onClose={() => {
                          setCancelId(null);
                          setCancelReason('');
                        }}
                        onConfirm={() => {
                          const reason = cancelReason.trim();
                          if (!reason) return;
                          updateStatus.mutate({ id: order.id, status: 'CANCELLED', reason });
                        }}
                      />
                    </View>
                  ) : (
                    <View style={styles.orderActions}>
                      {hasActions ? (
                        <View style={styles.buttonRow}>
                          {forward.map((status) => (
                            <Pressable
                              key={status}
                              disabled={updateStatus.isPending}
                              onPress={() => updateStatus.mutate({ id: order.id, status })}
                              style={[
                                status === 'PACKED' ? styles.packedBtn : styles.acceptBtn,
                                busy && { opacity: 0.6 },
                              ]}
                            >
                              <Text style={styles.acceptText}>{busy ? 'Updating…' : kitchenActionLabel(status)}</Text>
                            </Pressable>
                          ))}
                          {canCancel ? (
                            <Pressable
                              disabled={updateStatus.isPending}
                              onPress={() => {
                                setActionError(null);
                                setCancelReason('');
                                setCancelId(order.id);
                              }}
                              style={styles.cancelBtn}
                            >
                              <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.buttonRow} />
                      )}
                      <OrderMoney bill={order.subtotal} earnings={order.vendorPayoutAmount} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#B7A892',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statusDotWrap: { width: 10, alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotOn: { backgroundColor: theme.success },
  statusDotOff: { backgroundColor: theme.muted },
  availabilityTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  availabilityHint: { marginTop: 2, fontSize: 12, fontWeight: '500', color: theme.muted },
  switch: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    backgroundColor: theme.border,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: theme.success },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.white,
    alignSelf: 'flex-start',
  },
  knobOn: { alignSelf: 'flex-end' },
  toggleError: { marginTop: 8, color: theme.danger, fontWeight: '600', fontSize: 12 },
  queue: { gap: spacing.sm },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.tabBarBg,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: theme.white, ...shadow.card },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.tabInactive },
  tabTextOn: { color: theme.primaryDark },
  queueEmpty: { fontSize: 13, fontWeight: '600', color: theme.muted, paddingVertical: 8 },
  orderCard: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  ticketBody: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, gap: 3 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQty: { width: 16, fontSize: 13, fontWeight: '800', color: theme.primaryDark },
  itemName: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.text },
  itemPrice: { fontSize: 12, fontWeight: '700', color: theme.text },
  ticketActions: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 12 },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  acceptBtn: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packedBtn: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: theme.white, fontWeight: '600', fontSize: 12, letterSpacing: 0.2 },
  cancelBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: theme.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: theme.danger, fontWeight: '600', fontSize: 12 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.primaryDark,
    letterSpacing: -0.4,
  },
  heroMeta: { marginTop: 2, color: theme.muted, fontSize: 12, fontWeight: '600' },
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
  bodyMuted: { marginTop: 6, fontSize: 13, lineHeight: 19, color: theme.muted },
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
