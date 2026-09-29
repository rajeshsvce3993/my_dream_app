import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Detail = {
  vendorOrder: { _id: string; orderNumber: string; status: string; subtotal: number; vendorPayoutAmount: number };
  parentOrder: { orderNumber: string; paymentStatus: string; deliveryCity?: string; deliveryLine1?: string } | null;
  items: Array<{ quantity: number; unitPrice: number; lineTotal: number; productName?: string }>;
  allowedNextStatuses: string[];
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['vendor-order', id],
    queryFn: () => apiRequest<Detail>(`/vendor/orders/${id}`),
    enabled: Boolean(id),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/vendor/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-order', id] });
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
    },
  });

  if (detail.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, paddingTop: insets.top }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.primary }}>← Back</Text>
        </Pressable>
        <Text style={{ marginTop: spacing.lg }}>{(detail.error as Error)?.message ?? 'Not found'}</Text>
      </View>
    );
  }

  const d = detail.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: theme.primary, fontWeight: '700' }}>← Back</Text>
      </Pressable>
      <Text style={{ fontSize: 22, fontWeight: '800', marginTop: spacing.md }}>#{d.vendorOrder.orderNumber}</Text>
      <Text style={{ color: theme.muted }}>{d.vendorOrder.status}</Text>
      {d.parentOrder ? (
        <Text style={{ marginTop: spacing.sm, color: theme.muted }}>
          Deliver to {d.parentOrder.deliveryLine1}, {d.parentOrder.deliveryCity}
        </Text>
      ) : null}

      <View style={card}>
        {d.items.map((item, i) => (
          <Text key={i} style={{ marginBottom: 6 }}>
            {item.quantity}× {item.productName ?? 'Item'} — ₹{item.unitPrice} (line ₹{item.lineTotal})
          </Text>
        ))}
        <Text style={{ fontWeight: '800', marginTop: spacing.md }}>
          Payout ₹{Math.round(d.vendorOrder.vendorPayoutAmount)}
        </Text>
      </View>

      {d.allowedNextStatuses.map((status) => (
        <Pressable
          key={status}
          onPress={() => updateStatus.mutate(status)}
          disabled={updateStatus.isPending}
          style={{
            backgroundColor: theme.primary,
            padding: 14,
            borderRadius: radius.md,
            alignItems: 'center',
            marginTop: spacing.sm,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>{labelFor(status)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function labelFor(status: string) {
  if (status === 'PROCESSING') return 'Accept & start preparing';
  if (status === 'PACKED') return 'Mark packed';
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'CANCELLED') return 'Cancel order';
  return status;
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginTop: spacing.lg,
  borderWidth: 1,
  borderColor: theme.border,
};
