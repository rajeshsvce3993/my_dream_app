import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Row = {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryEarning?: number;
  shippingTotal: number;
  currency: string;
  deliveredAt?: string;
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession()
      .then(setSignedIn)
      .catch(() => setSignedIn(false));
  }, []);

  const history = useQuery({
    queryKey: ['delivery-history'],
    queryFn: () => apiRequest<Row[]>('/delivery/me/history'),
    enabled: signedIn === true,
  });

  if (signedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: theme.bg }}>
        <Text style={{ textAlign: 'center', color: theme.muted }}>Sign in on the Home tab to view history.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>History</Text>
      {history.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
      {history.isError ? <Text style={{ padding: spacing.lg }}>{(history.error as Error).message}</Text> : null}
      <FlatList
        data={history.data ?? []}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={
          history.isSuccess ? <Text style={{ color: theme.muted, padding: spacing.lg }}>No completed deliveries yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: theme.surface,
              borderRadius: radius.md,
              padding: spacing.lg,
            }}
          >
            <Text style={{ fontWeight: '800' }}>#{item.orderNumber}</Text>
            <Text style={{ color: theme.muted, marginTop: 4 }}>{item.status.replaceAll('_', ' ')}</Text>
            <Text style={{ marginTop: 6, fontWeight: '700' }}>
              ₹{Math.round(item.deliveryEarning ?? item.shippingTotal)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
