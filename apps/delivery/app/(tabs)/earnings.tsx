import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Earnings = {
  currency: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
};

function money(currency: string, amount: number) {
  return `${currency === 'INR' ? '₹' : `${currency} `}${Math.round(amount)}`;
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession()
      .then(setSignedIn)
      .catch(() => setSignedIn(false));
  }, []);

  const earnings = useQuery({
    queryKey: ['delivery-earnings'],
    queryFn: () => apiRequest<Earnings>('/delivery/me/earnings'),
    enabled: signedIn === true,
  });

  if (signedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: theme.bg }}>
        <Text style={{ textAlign: 'center', color: theme.muted }}>Sign in on the Home tab to view earnings.</Text>
      </View>
    );
  }

  if (earnings.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (earnings.isError || !earnings.data) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, paddingTop: insets.top + spacing.xl }}>
        <Text>{(earnings.error as Error)?.message ?? 'Could not load earnings.'}</Text>
      </View>
    );
  }

  const rows = [
    ['Today', earnings.data.today],
    ['This week', earnings.data.thisWeek],
    ['This month', earnings.data.thisMonth],
    ['Total', earnings.data.total],
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: spacing.lg }}>Earnings</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={{ backgroundColor: theme.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ color: theme.muted }}>{label}</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.primaryDark }}>{money(earnings.data.currency, value)}</Text>
        </View>
      ))}
    </View>
  );
}
