import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Earnings = {
  today: { gross: number; commission: number; net: number; orders: number };
  thisWeek: { gross: number; commission: number; net: number; orders: number };
  thisMonth: { gross: number; commission: number; net: number; orders: number };
  total: { gross: number; commission: number; net: number; orders: number };
};

function Block({ title, row }: { title: string; row: Earnings['today'] }) {
  return (
    <View style={card}>
      <Text style={{ fontWeight: '800', fontSize: 16 }}>{title}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 8 }}>₹{Math.round(row.net)}</Text>
      <Text style={{ color: theme.muted, marginTop: 4 }}>
        Gross ₹{Math.round(row.gross)} · Commission ₹{Math.round(row.commission)} · {row.orders} orders
      </Text>
    </View>
  );
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const earnings = useQuery({
    queryKey: ['vendor-earnings'],
    queryFn: () => apiRequest<Earnings>('/vendor/me/earnings'),
    enabled: authed === true,
  });

  if (authed === null || earnings.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!authed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
        <Text style={{ textAlign: 'center', color: theme.muted }}>Sign in on the Home tab.</Text>
      </View>
    );
  }

  const e = earnings.data!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: 32 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: spacing.lg }}>Earnings</Text>
      {earnings.isError ? <Text>{(earnings.error as Error).message}</Text> : null}
      <Block title="Today" row={e.today} />
      <Block title="This week" row={e.thisWeek} />
      <Block title="This month" row={e.thisMonth} />
      <Block title="Total" row={e.total} />
    </ScrollView>
  );
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginBottom: spacing.lg,
  borderWidth: 1,
  borderColor: theme.border,
};
