import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CancelReasonForm } from '../../components/CancelReasonForm';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { formatWhen, money } from '../../lib/format';
import { OrderMoney } from '../../components/OrderMoney';
import { kitchenActionLabel, orderSerial, queueStatusLabel, queueStatusTone } from '../../lib/orderActions';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Detail = {
  vendorOrder: {
    _id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    commissionRate?: number;
    commissionAmount?: number;
    vendorPayoutAmount: number;
  };
  parentOrder: {
    orderNumber: string;
    status?: string;
    paymentStatus: string;
    deliveryCity?: string;
    deliveryLine1?: string;
    createdAt?: string;
    currency?: string;
  } | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    productName?: string;
    variantName?: string;
    imageUrl?: string;
  }>;
  allowedNextStatuses: string[];
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const detail = useQuery({
    queryKey: ['vendor-order', id],
    queryFn: () => apiRequest<Detail>(`/vendor/orders/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: (input: { status: string; reason?: string }) =>
      apiRequest(`/vendor/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setBanner(null);
      setCancelling(false);
      setCancelReason('');
      qc.invalidateQueries({ queryKey: ['vendor-order', id] });
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      qc.invalidateQueries({ queryKey: ['vendor-earnings'] });
    },
    onError: (err: Error) => setBanner(err.message),
  });

  if (detail.isLoading && !detail.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Order" onBack={() => router.back()} />
        <View style={{ padding: spacing.xl }}>
          <Text style={styles.errorText}>{(detail.error as Error)?.message ?? 'Not found'}</Text>
        </View>
      </View>
    );
  }

  const d = detail.data;
  const currency = d.parentOrder?.currency ?? 'INR';
  const fullNumber = d.parentOrder?.orderNumber ?? d.vendorOrder.orderNumber;
  const tone = queueStatusTone(d.vendorOrder.status);
  const toneColor =
    tone === 'new' ? '#8A5A16' : tone === 'cancel' ? theme.danger : tone === 'done' ? theme.success : '#1A5563';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={fullNumber}
        subtitle={queueStatusLabel(d.vendorOrder.status)}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 28, gap: spacing.sm }}
      >
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.side}>
              <Text style={styles.serial} numberOfLines={1}>
                {orderSerial(fullNumber)}
              </Text>
            </View>
            <Text style={[styles.status, { color: toneColor }]} numberOfLines={1}>
              {queueStatusLabel(d.vendorOrder.status)}
            </Text>
            <View style={styles.sideEnd}>
              <Text style={styles.when} numberOfLines={1}>
                {d.parentOrder?.createdAt ? formatWhen(d.parentOrder.createdAt) : ''}
              </Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Payment</Text>
              <Text style={styles.factValue}>
                {d.parentOrder?.paymentStatus ? d.parentOrder.paymentStatus.replaceAll('_', ' ') : '—'}
              </Text>
            </View>
            {d.parentOrder?.deliveryLine1 ? (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Deliver to</Text>
                <Text style={[styles.factValue, styles.address]}>
                  {d.parentOrder.deliveryLine1}
                  {d.parentOrder.deliveryCity ? `, ${d.parentOrder.deliveryCity}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.headTitle}>Items</Text>
          </View>
          <View style={styles.cardBody}>
            {d.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.productName ?? 'Item'}
                  </Text>
                  {item.variantName ? <Text style={styles.variant}>{item.variantName}</Text> : null}
                </View>
                <Text style={styles.itemPrice}>{money(item.lineTotal, currency)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <OrderMoney bill={d.vendorOrder.subtotal} earnings={d.vendorOrder.vendorPayoutAmount} />
            </View>
          </View>
        </View>

        {banner ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{banner}</Text>
          </View>
        ) : null}

        {cancelling ? (
          <CancelReasonForm
            value={cancelReason}
            onChange={setCancelReason}
            pending={updateStatus.isPending}
            onClose={() => {
              setCancelling(false);
              setCancelReason('');
            }}
            onConfirm={() => {
              const reason = cancelReason.trim();
              if (!reason) return;
              updateStatus.mutate({ status: 'CANCELLED', reason });
            }}
          />
        ) : d.allowedNextStatuses.length ? (
          <View style={styles.actionRow}>
            {d.allowedNextStatuses.map((status) => {
              const isCancel = status === 'CANCELLED';
              return (
                <Pressable
                  key={status}
                  onPress={() => {
                    if (isCancel) {
                      setBanner(null);
                      setCancelReason('');
                      setCancelling(true);
                      return;
                    }
                    updateStatus.mutate({ status });
                  }}
                  disabled={updateStatus.isPending}
                  style={[
                    styles.actionBtn,
                    isCancel ? styles.cancelBtn : status === 'PACKED' ? styles.packedBtn : styles.primaryBtn,
                    updateStatus.isPending && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.actionText, isCancel && styles.cancelText]}>
                    {updateStatus.isPending ? 'Updating…' : kitchenActionLabel(status)}
                  </Text>
                </Pressable>
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
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F7F4EF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  side: { flex: 1 },
  sideEnd: { flex: 1, alignItems: 'flex-end' },
  cardBody: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  serial: { fontSize: 18, fontWeight: '800', color: '#1A5563', letterSpacing: 0.3 },
  status: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  when: { fontSize: 11, fontWeight: '600', color: theme.muted },
  headTitle: { fontSize: 12, fontWeight: '800', color: theme.primaryDark, letterSpacing: 0.4 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  factLabel: { fontSize: 12, fontWeight: '700', color: theme.muted },
  factValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700', color: theme.text },
  address: { lineHeight: 18 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemQty: { width: 18, fontSize: 15, fontWeight: '800', color: theme.primaryDark },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.text },
  variant: { marginTop: 1, fontSize: 12, color: theme.muted },
  itemPrice: { fontSize: 14, fontWeight: '700', color: theme.text },
  totalRow: {
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    alignItems: 'flex-end',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: { backgroundColor: theme.primaryDark },
  packedBtn: { backgroundColor: theme.accent },
  cancelBtn: {
    backgroundColor: theme.dangerSoft,
  },
  actionText: { color: theme.onPrimary, fontWeight: '600', fontSize: 14, letterSpacing: 0.2 },
  cancelText: { color: theme.danger },
  errorBanner: {
    backgroundColor: theme.dangerSoft,
    borderRadius: radius.sm,
    padding: 12,
  },
  errorText: { color: theme.danger, fontWeight: '600', textAlign: 'center' },
});
