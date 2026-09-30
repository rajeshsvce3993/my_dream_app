import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { greetingForNow, money } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Offer = {
  id: string;
  expiresAt: string;
  order: {
    orderNumber: string;
    earning: number;
    currency: string;
    pickupNames: string[];
    deliveryAddress: { line1: string; city: string };
  };
};

type ActiveOrder = {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: { line1: string; city: string };
  deliveryEarning?: number;
  shippingTotal: number;
  currency: string;
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

const STEPS = [
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'READY_FOR_PICKUP', label: 'Pickup' },
  { key: 'OUT_FOR_DELIVERY', label: 'En route' },
  { key: 'DELIVERED', label: 'Done' },
] as const;

function stepIndex(status: string): number {
  if (status === 'OUT_FOR_DELIVERY') return 2;
  if (status === 'READY_FOR_PICKUP' || status === 'PACKED') return 1;
  if (status === 'DELIVERED') return 3;
  return 0;
}

function mapsUrl(line1: string, city: string) {
  const q = encodeURIComponent(`${line1}, ${city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const availability = useMutation({
    mutationFn: (next: 'ONLINE' | 'OFFLINE') =>
      apiRequest('/delivery/me/availability', {
        method: 'POST',
        body: JSON.stringify({ availability: next }),
      }),
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

  const data = me.data;
  const online = data?.availability === 'ONLINE';
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
              {data?.approvalStatus === 'REJECTED'
                ? data.rejectionReason || 'Your delivery account was not approved. Contact Admin.'
                : 'Admin still needs to approve your account before you can go online.'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Availability</Text>
                <Text style={styles.cardTitle}>{online ? 'You’re online' : 'You’re offline'}</Text>
                <Text style={styles.bodyMuted}>
                  {online ? 'New delivery offers will appear here.' : 'Go online when you’re ready to deliver.'}
                </Text>
              </View>
              <Pressable
                onPress={() => availability.mutate(online ? 'OFFLINE' : 'ONLINE')}
                disabled={availability.isPending}
                style={[
                  styles.toggle,
                  online ? styles.toggleOn : styles.toggleOff,
                  availability.isPending && { opacity: 0.7 },
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: online }}
              >
                <View style={[styles.toggleKnob, online ? styles.toggleKnobOn : styles.toggleKnobOff]} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => availability.mutate(online ? 'OFFLINE' : 'ONLINE')}
              disabled={availability.isPending}
              style={[styles.primaryBtn, online && styles.secondaryBtn, availability.isPending && { opacity: 0.7 }]}
            >
              <Text style={[styles.primaryBtnText, online && styles.secondaryBtnText]}>
                {availability.isPending ? 'Updating…' : online ? 'Go offline' : 'Go online'}
              </Text>
            </Pressable>
          </View>
        )}

        {banner ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorBannerText}>{banner}</Text>
          </View>
        ) : null}

        {data?.activeOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Active delivery</Text>
            <Text style={styles.cardTitle}>#{data.activeOrder.orderNumber}</Text>
            <Text style={styles.earn}>
              {money(data.activeOrder.currency, data.activeOrder.deliveryEarning ?? data.activeOrder.shippingTotal)}
            </Text>

            <View style={styles.timeline}>
              {STEPS.map((step, i) => {
                const active = stepIndex(data.activeOrder!.status);
                const done = i <= active;
                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View
                      style={[
                        styles.timelineDot,
                        done && { backgroundColor: theme.success, borderColor: theme.success },
                      ]}
                    />
                    <Text style={[styles.timelineLabel, done && { color: theme.text, fontWeight: '700' }]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.addressBlock}>
              <Ionicons name="navigate-outline" size={16} color={theme.delivery} />
              <Text style={styles.addressText}>
                {data.activeOrder.deliveryAddress.line1}, {data.activeOrder.deliveryAddress.city}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                void Linking.openURL(
                  mapsUrl(data.activeOrder!.deliveryAddress.line1, data.activeOrder!.deliveryAddress.city),
                )
              }
              style={styles.linkBtn}
            >
              <Ionicons name="map-outline" size={16} color={theme.delivery} />
              <Text style={styles.linkBtnText}>Open in Maps</Text>
            </Pressable>

            {data.activeOrder.status === 'READY_FOR_PICKUP' || data.activeOrder.status === 'PACKED' ? (
              <Pressable
                onPress={() => pickup.mutate()}
                disabled={pickup.isPending}
                style={[styles.primaryBtn, pickup.isPending && { opacity: 0.7 }]}
              >
                <Text style={styles.primaryBtnText}>{pickup.isPending ? 'Updating…' : 'Mark picked up'}</Text>
              </Pressable>
            ) : null}

            {data.activeOrder.status === 'OUT_FOR_DELIVERY' ? (
              <Pressable
                onPress={() => deliver.mutate()}
                disabled={deliver.isPending}
                style={[styles.primaryBtn, deliver.isPending && { opacity: 0.7 }]}
              >
                <Text style={styles.primaryBtnText}>{deliver.isPending ? 'Updating…' : 'Mark delivered'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!data?.activeOrder && data?.offer && online ? (
          <View style={[styles.card, styles.offerCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>New offer</Text>
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
            <Text style={styles.cardTitle}>#{data.offer.order.orderNumber}</Text>
            <Text style={styles.earn}>{money(data.offer.order.currency, data.offer.order.earning)}</Text>

            <Text style={styles.metaLabel}>Pickup</Text>
            <Text style={styles.metaValue}>{data.offer.order.pickupNames.join(', ') || 'Restaurant'}</Text>
            <Text style={styles.metaLabel}>Deliver to</Text>
            <Text style={styles.metaValue}>
              {data.offer.order.deliveryAddress.line1}, {data.offer.order.deliveryAddress.city}
            </Text>

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
              <Ionicons name="bicycle-outline" size={28} color={theme.muted} />
            </View>
            <Text style={styles.emptyTitle}>
              {online ? 'Waiting for offers' : 'Ready when you are'}
            </Text>
            <Text style={styles.bodyMuted}>
              {online
                ? 'Stay nearby. New deliveries will show up automatically.'
                : 'Flip online to start receiving delivery offers.'}
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  bodyMuted: { marginTop: 6, fontSize: 13, lineHeight: 19, color: theme.muted },
  earn: { marginTop: 6, fontSize: 22, fontWeight: '900', color: theme.success },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: theme.success },
  toggleOff: { backgroundColor: theme.border },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.white,
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  toggleKnobOff: { alignSelf: 'flex-start' },
  primaryBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: theme.onPrimary, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryBtnText: { color: theme.text },
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
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  timelineStep: { alignItems: 'center', flex: 1 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.white,
    marginBottom: 6,
  },
  timelineLabel: { fontSize: 10, fontWeight: '600', color: theme.muted },
  addressBlock: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 20 },
  linkBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  linkBtnText: { color: theme.delivery, fontWeight: '700', fontSize: 13 },
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
  metaLabel: { marginTop: spacing.sm, fontSize: 11, fontWeight: '700', color: theme.muted },
  metaValue: { marginTop: 2, fontSize: 14, fontWeight: '700', color: theme.text },
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
  },
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
});
