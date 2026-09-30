import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { formatWhen, money, statusLabel } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Detail = {
  vendorOrder: {
    _id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    vendorPayoutAmount: number;
  };
  parentOrder: {
    orderNumber: string;
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

function labelFor(status: string) {
  if (status === 'PROCESSING') return 'Accept & start preparing';
  if (status === 'PACKED') return 'Mark packed';
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'CANCELLED') return 'Cancel order';
  return statusLabel(status);
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['vendor-order', id],
    queryFn: () => apiRequest<Detail>(`/vendor/orders/${id}`),
    enabled: Boolean(id),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/vendor/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      setBanner(null);
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

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`#${d.vendorOrder.orderNumber}`}
        subtitle={statusLabel(d.vendorOrder.status)}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
      >
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Payment</Text>
            <Text style={styles.payment}>
              {d.parentOrder?.paymentStatus ? statusLabel(d.parentOrder.paymentStatus) : '—'}
            </Text>
          </View>
          {d.parentOrder?.createdAt ? (
            <Text style={styles.meta}>{formatWhen(d.parentOrder.createdAt)}</Text>
          ) : null}
          {d.parentOrder?.deliveryLine1 ? (
            <Text style={styles.address}>
              Deliver to {d.parentOrder.deliveryLine1}
              {d.parentOrder.deliveryCity ? `, ${d.parentOrder.deliveryCity}` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Items</Text>
          {d.items.map((item, i) => (
            <View key={i} style={[styles.itemRow, i > 0 && styles.itemBorder]}>
              <View style={styles.thumb}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                ) : (
                  <Text style={styles.qtyBubble}>{item.quantity}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.quantity}× {item.productName ?? 'Item'}
                </Text>
                {item.variantName ? <Text style={styles.variant}>{item.variantName}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>{money(item.lineTotal, currency)}</Text>
            </View>
          ))}
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Your payout</Text>
            <Text style={styles.payoutValue}>{money(d.vendorOrder.vendorPayoutAmount, currency)}</Text>
          </View>
        </View>

        {banner ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{banner}</Text>
          </View>
        ) : null}

        {d.allowedNextStatuses.map((status) => {
          const isCancel = status === 'CANCELLED';
          return (
            <Pressable
              key={status}
              onPress={() => updateStatus.mutate(status)}
              disabled={updateStatus.isPending}
              style={[
                styles.actionBtn,
                isCancel ? styles.cancelBtn : styles.primaryBtn,
                updateStatus.isPending && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionText, isCancel && styles.cancelText]}>
                {updateStatus.isPending ? 'Updating…' : labelFor(status)}
              </Text>
            </Pressable>
          );
        })}
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  payment: { fontSize: 13, fontWeight: '800', color: theme.success },
  meta: { fontSize: 12, color: theme.muted, fontWeight: '600' },
  address: { marginTop: 8, fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  qtyBubble: { fontWeight: '900', color: theme.primary },
  itemName: { fontSize: 14, fontWeight: '700', color: theme.text },
  variant: { marginTop: 2, fontSize: 12, color: theme.muted },
  itemPrice: { fontSize: 14, fontWeight: '800', color: theme.text },
  payoutRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payoutLabel: { fontWeight: '700', color: theme.muted },
  payoutValue: { fontWeight: '900', fontSize: 16, color: theme.success },
  actionBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: { backgroundColor: theme.primaryDark },
  cancelBtn: {
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: '#E8C5C0',
  },
  actionText: { color: theme.onPrimary, fontWeight: '800', fontSize: 15 },
  cancelText: { color: theme.danger },
  errorBanner: {
    backgroundColor: theme.dangerSoft,
    borderRadius: radius.sm,
    padding: 12,
  },
  errorText: { color: theme.danger, fontWeight: '600', textAlign: 'center' },
});
