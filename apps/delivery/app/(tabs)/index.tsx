import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeliverySplash } from '../../components/DeliverySplash';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { greetingForNow, money, orderSerial } from '../../lib/format';
import { readCurrentCoordinates } from '../../lib/riderLocation';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Offer = {
  id: string;
  expiresAt: string;
  order: {
    orderNumber: string;
    earning: number;
    collectAmount: number;
    paymentMethod: string;
    currency: string;
    pickupNames: string[];
    pickups?: Pickup[];
    items?: Array<{ quantity: number; name: string }>;
  };
};

type Drop = {
  name: string;
  phone?: string | null;
  address: string;
  note?: string | null;
  coordinates?: number[] | null;
};

type Pickup = {
  name: string;
  phone?: string | null;
  address: string;
  lng?: number | null;
  lat?: number | null;
};

type ActiveOrder = {
  _id: string;
  orderNumber: string;
  status: string;
  drop?: Drop | null;
  deliveryEarning?: number;
  shippingTotal: number;
  collectAmount?: number;
  paymentMethod?: string;
  earning?: number;
  currency: string;
  pickups?: Pickup[];
};

type Me = {
  availability: 'ONLINE' | 'OFFLINE';
  approvalStatus: string;
  onboardingComplete: boolean;
  vehicleType?: string | null;
  rejectionReason?: string | null;
  offer: Offer | null;
  activeOrder: ActiveOrder | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
};

function statusLabel(status: string): string {
  if (status === 'PROCESSING') return 'Preparing';
  if (status === 'PACKED') return 'Packed';
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'OUT_FOR_DELIVERY') return 'On the way';
  if (status === 'DELIVERED') return 'Delivered';
  return 'Assigned';
}

function PayLines({
  currency,
  collectAmount,
  earning,
  paymentMethod,
}: {
  currency: string;
  collectAmount: number;
  earning: number;
  paymentMethod?: string;
}) {
  const cod = !paymentMethod || paymentMethod === 'COD';
  return (
    <View style={styles.payBox}>
      <View style={styles.payCol}>
        <Text style={styles.payLabel}>{cod ? 'Collect' : 'Paid'}</Text>
        <Text style={styles.collectValue}>{cod ? money(currency, collectAmount) : 'Online'}</Text>
      </View>
      <View style={styles.payRule} />
      <View style={styles.payCol}>
        <Text style={styles.payLabel}>Earning</Text>
        <Text style={styles.earnValue}>{money(currency, earning)}</Text>
      </View>
    </View>
  );
}

function mapsQuery(line1: string, city: string, coordinates?: number[]) {
  if (coordinates && coordinates.length >= 2) {
    return `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;
  }
  const q = encodeURIComponent([line1, city].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function pickupMapsUrl(pickup: Pickup) {
  if (pickup.lat != null && pickup.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${pickup.lat},${pickup.lng}`;
  }
  return mapsQuery(pickup.address || pickup.name, '');
}

function RouteStop({
  label,
  title,
  detail,
  phone,
  onMaps,
  last,
}: {
  label: string;
  title: string;
  detail?: string;
  phone?: string | null;
  onMaps: () => void;
  last?: boolean;
}) {
  return (
    <View style={styles.stop}>
      <View style={styles.stopRail}>
        <View style={[styles.stopDot, last ? styles.stopDotDrop : styles.stopDotPickup]} />
        {last ? null : <View style={styles.stopLine} />}
      </View>
      <View style={styles.stopBody}>
        <Text style={styles.stopLabel}>{label}</Text>
        <Text style={styles.stopTitle}>{title}</Text>
        {detail ? <Text style={styles.stopDetail}>{detail}</Text> : null}
        {phone ? <Text style={styles.stopPhone}>{phone}</Text> : null}
        <View style={styles.stopActions}>
          {phone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${phone}`)}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={`Call ${title}`}
            >
              <Ionicons name="call-outline" size={14} color={theme.primaryDark} />
              <Text style={styles.chipText}>Call</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onMaps} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Open ${label} in Maps`}>
            <Ionicons name="navigate-outline" size={14} color={theme.primaryDark} />
            <Text style={styles.chipText}>Maps</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StatusAction({
  status,
  busy,
  onPickup,
  onDeliver,
}: {
  status: string;
  busy: boolean;
  onPickup: () => void;
  onDeliver: () => void;
}) {
  const ready = status === 'READY_FOR_PICKUP';
  const enRoute = status === 'OUT_FOR_DELIVERY';
  const enabled = ready || enRoute;
  const hint = enRoute
    ? 'Confirm when the customer has the order.'
    : ready
      ? 'Food is ready. Confirm once you have picked it up.'
      : status === 'PACKED'
        ? 'Packed at the restaurant. Pickup opens when they mark it ready.'
        : 'The restaurant is still preparing this order.';
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusHint}>{hint}</Text>
      <Pressable
        disabled={!enabled || busy}
        onPress={enRoute ? onDeliver : onPickup}
        style={[styles.statusBtn, enRoute ? styles.statusBtnDeliver : enabled ? styles.statusBtnOn : styles.statusBtnOff]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled || busy }}
      >
        <Text style={[styles.statusBtnText, !enabled && styles.statusBtnTextOff]}>
          {busy ? 'Updating…' : enRoute ? 'Mark delivered' : enabled ? 'Mark picked up' : 'Waiting for restaurant'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [banner, setBanner] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['delivery-me'],
    queryFn: () => apiRequest<Me>('/delivery/me'),
    refetchInterval: 4000,
    retry: 1,
  });

  const earnings = useQuery({
    queryKey: ['delivery-earnings'],
    queryFn: () => apiRequest<{ currency: string; today: number; todayOrders: number }>('/delivery/me/earnings'),
    refetchInterval: 15000,
  });

  const data = me.data;
  const online = data?.availability === 'ONLINE';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    async function ping() {
      try {
        const coords = await readCurrentCoordinates();
        if (cancelled) return;
        await apiRequest('/delivery/me/location', {
          method: 'POST',
          body: JSON.stringify(coords),
        });
      } catch {
        /* next tick retries; offers pause if location goes stale */
      }
    }
    void ping();
    const t = setInterval(() => void ping(), 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [online]);

  const availability = useMutation({
    mutationFn: async (next: 'ONLINE' | 'OFFLINE') => {
      if (next === 'OFFLINE') {
        return apiRequest('/delivery/me/availability', {
          method: 'POST',
          body: JSON.stringify({ availability: 'OFFLINE' }),
        });
      }
      const coords = await readCurrentCoordinates();
      return apiRequest('/delivery/me/availability', {
        method: 'POST',
        body: JSON.stringify({
          availability: 'ONLINE',
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
    },
    onSuccess: () => {
      setBanner(null);
      qc.invalidateQueries({ queryKey: ['delivery-me'] });
    },
    onError: (err: Error) => setBanner(err.message),
  });

  const accept = useMutation({
    mutationFn: (offerId: string) => apiRequest(`/delivery/offers/${offerId}/accept`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => {
      setBanner(err.message);
      qc.invalidateQueries({ queryKey: ['delivery-me'] });
    },
  });

  const reject = useMutation({
    mutationFn: (offerId: string) => apiRequest(`/delivery/offers/${offerId}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => setBanner(err.message),
  });

  const pickup = useMutation({
    mutationFn: () => apiRequest('/delivery/me/pickup', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-me'] }),
    onError: (err: Error) => setBanner(err.message),
  });

  const deliver = useMutation({
    mutationFn: () => apiRequest('/delivery/me/deliver', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-me'] });
      qc.invalidateQueries({ queryKey: ['delivery-earnings'] });
      qc.invalidateQueries({ queryKey: ['delivery-history'] });
    },
    onError: (err: Error) => setBanner(err.message),
  });

  const approved = data?.approvalStatus === 'APPROVED' && data?.onboardingComplete;
  const secondsLeft = data?.offer
    ? Math.max(0, Math.ceil((new Date(data.offer.expiresAt).getTime() - now) / 1000))
    : 0;
  const offerProgress = useMemo(() => {
    if (!data?.offer) return 0;
    // Assume ~30s TTL from offer creation window shown as remaining ratio capped
    return Math.min(1, secondsLeft / 30);
  }, [data?.offer, secondsLeft]);

  const riderName = data?.profile?.firstName?.trim() || 'Rider';

  if (me.isLoading && !data) {
    return <DeliverySplash />;
  }

  if (me.isError && !data) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.muted} />
        <Text style={styles.errorTitle}>
          {(me.error as Error).message || 'Could not connect'}
        </Text>
        <Pressable onPress={() => me.refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${greetingForNow()}, ${riderName}`}
        subtitle="Dream Delivery"
        statusOnline={Boolean(online)}
        statusLabel={online ? 'Online' : 'Offline'}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={(me.isFetching && !me.isLoading) || (earnings.isFetching && !earnings.isLoading)}
            onRefresh={() => {
              void me.refetch();
              void earnings.refetch();
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
              {data?.approvalStatus === 'REJECTED'
                ? data.rejectionReason || 'Your delivery account was not approved. Contact Admin.'
                : 'Admin still needs to approve your account before you can go online.'}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => availability.mutate(online ? 'OFFLINE' : 'ONLINE')}
            disabled={availability.isPending}
            accessibilityRole="switch"
            accessibilityState={{ checked: online }}
            accessibilityLabel={online ? 'Go offline' : 'Go online'}
            style={[styles.duty, availability.isPending && { opacity: 0.7 }]}
          >
            <View style={[styles.statusDot, online ? styles.statusDotOn : styles.statusDotOff]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dutyTitle}>{online ? 'On duty' : 'Off duty'}</Text>
              <Text style={styles.dutyHint}>
                {online ? 'Offers follow your live location' : 'Go online to receive nearby orders'}
              </Text>
            </View>
            <View style={[styles.toggle, online && styles.toggleOn]}>
              <View style={[styles.toggleKnob, online && styles.toggleKnobOn]} />
            </View>
          </Pressable>
        )}

        <View style={styles.summary}>
          <Text style={styles.summaryEyebrow}>Today</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryValue}>{earnings.data?.todayOrders ?? 0}</Text>
              <Text style={styles.summaryLabel}>Orders</Text>
            </View>
            <View style={styles.summaryRule} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryValue}>{money(earnings.data?.currency, earnings.data?.today ?? 0)}</Text>
              <Text style={styles.summaryLabel}>Earnings</Text>
            </View>
          </View>
        </View>

        {banner ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorBannerText}>{banner}</Text>
          </View>
        ) : null}

        {data?.activeOrder ? (
          <View style={styles.ticket}>
            <View style={styles.ticketHead}>
              <Text style={styles.ticketNo}>{orderSerial(data.activeOrder.orderNumber)}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{statusLabel(data.activeOrder.status)}</Text>
              </View>
            </View>
            <View style={styles.ticketBody}>
              <PayLines
                currency={data.activeOrder.currency}
                collectAmount={data.activeOrder.collectAmount ?? 0}
                earning={data.activeOrder.earning ?? data.activeOrder.deliveryEarning ?? 0}
                paymentMethod={data.activeOrder.paymentMethod}
              />
              <View style={styles.route}>
                {data.activeOrder.drop ? (
                  <RouteStop
                    label="Deliver to"
                    title={data.activeOrder.drop.name}
                    detail={[data.activeOrder.drop.address, data.activeOrder.drop.note].filter(Boolean).join('\n')}
                    phone={data.activeOrder.drop.phone}
                    last
                    onMaps={() =>
                      void Linking.openURL(
                        mapsQuery(
                          data.activeOrder!.drop!.address,
                          '',
                          data.activeOrder!.drop!.coordinates ?? undefined,
                        ),
                      )
                    }
                  />
                ) : (
                  (data.activeOrder.pickups ?? []).map((stop, index, list) => (
                    <RouteStop
                      key={`${stop.name}-${stop.address}`}
                      label="Pickup"
                      title={stop.name}
                      detail={stop.address}
                      phone={stop.phone}
                      last={index === list.length - 1}
                      onMaps={() => void Linking.openURL(pickupMapsUrl(stop))}
                    />
                  ))
                )}
              </View>
              <StatusAction
                status={data.activeOrder.status}
                busy={pickup.isPending || deliver.isPending}
                onPickup={() => pickup.mutate()}
                onDeliver={() => deliver.mutate()}
              />
            </View>
          </View>
        ) : null}

        {!data?.activeOrder && data?.offer && online ? (
          <View style={[styles.card, styles.offerCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.offerEyebrow}>New offer</Text>
              <View style={styles.countdownChip}>
                <Ionicons name="timer-outline" size={14} color={secondsLeft <= 10 ? theme.danger : theme.warning} />
                <Text
                  style={[
                    styles.countdownText,
                    secondsLeft <= 10 && { color: theme.danger },
                  ]}
                >
                  {secondsLeft}s
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(4, offerProgress * 100)}%` }]} />
            </View>
            <Text style={styles.offerOrderDark}>{orderSerial(data.offer.order.orderNumber)}</Text>
            <PayLines
              currency={data.offer.order.currency}
              collectAmount={data.offer.order.collectAmount}
              earning={data.offer.order.earning}
              paymentMethod={data.offer.order.paymentMethod}
            />
            <View style={styles.route}>
              {(data.offer.order.pickups?.length
                ? data.offer.order.pickups
                : [{ name: data.offer.order.pickupNames.join(', ') || 'Restaurant', address: '', phone: null }]
              ).map((stop, index, list) => (
                <RouteStop
                  key={`${stop.name}-${stop.address}`}
                  label="Pickup"
                  title={stop.name}
                  detail={stop.address}
                  phone={stop.phone}
                  last={index === list.length - 1}
                  onMaps={() => void Linking.openURL(pickupMapsUrl(stop))}
                />
              ))}
            </View>
            {data.offer.order.items?.length ? (
              <View style={styles.itemList}>
                {data.offer.order.items.map((item, index) => (
                  <Text key={`${item.name}-${index}`} style={styles.itemLine}>
                    {item.quantity}  {item.name}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.offerActions}>
              <Pressable
                onPress={() => reject.mutate(data.offer!.id)}
                disabled={reject.isPending}
                style={styles.rejectBtn}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => accept.mutate(data.offer!.id)}
                disabled={accept.isPending || secondsLeft <= 0}
                style={[styles.acceptBtn, (accept.isPending || secondsLeft <= 0) && { opacity: 0.6 }]}
              >
                <Text style={styles.primaryBtnText}>
                  {accept.isPending ? 'Accepting…' : 'Accept'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!data?.activeOrder && !data?.offer ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bicycle-outline" size={26} color={theme.delivery} />
            </View>
            <Text style={styles.emptyTitle}>{online ? 'Waiting for offers' : 'You are off duty'}</Text>
            <Text style={styles.emptyHint}>
              {online
                ? 'Stay nearby. The next order will appear here.'
                : 'Switch on duty when you are ready to pick up.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  duty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#B7A892',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotOn: { backgroundColor: theme.success },
  statusDotOff: { backgroundColor: theme.muted },
  dutyTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  dutyHint: { marginTop: 2, fontSize: 12, fontWeight: '500', color: theme.text },
  summary: {
    backgroundColor: theme.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingTop: 6,
    paddingBottom: 7,
    paddingHorizontal: 8,
  },
  summaryEyebrow: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B70',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryRule: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: theme.border },
  summaryValue: { fontSize: 15, fontWeight: '800', color: '#1A5563', letterSpacing: -0.2 },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: theme.muted },
  offerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  offerBanner: {
    marginTop: spacing.sm,
    backgroundColor: theme.bannerBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  offerOrder: { fontSize: 13, fontWeight: '700', color: theme.onHeaderMuted },
  offerOrderDark: { fontSize: 15, fontWeight: '800', color: theme.text },
  offerEarn: { marginTop: 4, fontSize: 28, fontWeight: '900', color: theme.onHeader, letterSpacing: -0.6 },
  payBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EF',
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  payCol: { flex: 1, gap: 2 },
  payRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.border, marginHorizontal: 12 },
  payLabel: { fontSize: 10, fontWeight: '700', color: '#8A7B70', letterSpacing: 0.4, textTransform: 'uppercase' },
  collectValue: { fontSize: 18, fontWeight: '800', color: theme.primaryDark },
  earnValue: { fontSize: 18, fontWeight: '800', color: '#1A5563' },
  ticket: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  ticketHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F7F4EF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  ticketNo: { fontSize: 16, fontWeight: '800', color: '#1A5563', letterSpacing: 0.2 },
  statusPill: { backgroundColor: '#E4F1F4', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#1A5563' },
  ticketBody: { padding: 12, gap: 12 },
  route: { gap: 0 },
  stop: { flexDirection: 'row', gap: 10 },
  stopRail: { width: 16, alignItems: 'center' },
  stopDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  stopDotPickup: { backgroundColor: theme.accent },
  stopDotDrop: { backgroundColor: theme.bannerBg },
  stopLine: { width: 1, flex: 1, backgroundColor: theme.border, marginVertical: 3 },
  stopBody: { flex: 1, paddingBottom: 12 },
  stopLabel: { fontSize: 10, fontWeight: '700', color: '#8A7B70', letterSpacing: 0.4, textTransform: 'uppercase' },
  stopTitle: { marginTop: 2, fontSize: 15, fontWeight: '800', color: theme.text },
  stopDetail: { marginTop: 2, fontSize: 13, lineHeight: 18, fontWeight: '500', color: theme.muted },
  stopPhone: { marginTop: 4, fontSize: 14, fontWeight: '800', color: theme.text, letterSpacing: 0.2 },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAE3DA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.primaryDark },
  statusBox: { gap: 8 },
  statusHint: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: theme.muted },
  statusBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusBtnOn: { backgroundColor: theme.primaryDark },
  statusBtnDeliver: { backgroundColor: theme.accent },
  statusBtnOff: { backgroundColor: '#EAE3DA' },
  statusBtnText: { color: theme.onPrimary, fontSize: 14, fontWeight: '700' },
  statusBtnTextOff: { color: '#6B5E54' },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  offerCard: {
    borderColor: theme.delivery,
  },
  warningCard: {
    backgroundColor: theme.warningSoft,
    borderColor: '#E5D2B8',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  bodyMuted: { marginTop: 6, fontSize: 13, lineHeight: 19, color: theme.muted },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    justifyContent: 'center',
    backgroundColor: theme.border,
  },
  toggleOn: { backgroundColor: theme.success },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.white,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  primaryBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: theme.onPrimary, fontWeight: '800', fontSize: 15 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.dangerSoft,
    borderRadius: radius.sm,
    padding: 12,
  },
  errorBannerText: { flex: 1, color: theme.danger, fontWeight: '600', fontSize: 13 },
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
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  countdownText: { fontSize: 12, fontWeight: '800', color: theme.warning },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  progressFill: {
    height: 4,
    backgroundColor: theme.delivery,
    borderRadius: 2,
  },
  itemList: { gap: 2, paddingTop: 2 },
  itemLine: { fontSize: 13, fontWeight: '600', color: theme.text },
  offerActions: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.white,
  },
  rejectText: { fontWeight: '800', color: theme.text },
  acceptBtn: {
    flex: 2,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  emptyHint: { marginTop: 6, fontSize: 13, lineHeight: 19, color: theme.muted, textAlign: 'center' },
});
