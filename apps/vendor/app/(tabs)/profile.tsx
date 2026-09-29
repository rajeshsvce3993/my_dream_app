import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, clearTokens, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { name: string; code: string; status: string } | null;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    enabled: authed === true,
  });

  const toggleOrders = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiRequest('/vendor/me/accepting-orders', { method: 'POST', body: JSON.stringify({ acceptingOrders }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-me'] }),
  });

  if (authed === null || me.isLoading) {
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

  const data = me.data!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: 32 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800' }}>Profile</Text>
      <View style={card}>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>{data.vendor?.name}</Text>
        <Text style={{ color: theme.muted }}>{data.vendor?.code}</Text>
        <Text style={{ marginTop: 8 }}>Shop status: {data.vendor?.status}</Text>
        <Text style={{ marginTop: 4 }}>Account: {data.approvalStatus}</Text>
      </View>

      <Pressable
        onPress={() => toggleOrders.mutate(!data.acceptingOrders)}
        style={{
          backgroundColor: data.acceptingOrders ? theme.text : theme.primary,
          padding: 16,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>
          {data.acceptingOrders ? 'Close shop (pause orders)' : 'Open shop (accept orders)'}
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await clearTokens();
          setAuthed(false);
          qc.clear();
        }}
        style={{ marginTop: spacing.xl, alignItems: 'center' }}
      >
        <Text style={{ color: theme.muted }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginTop: spacing.lg,
  marginBottom: spacing.lg,
  borderWidth: 1,
  borderColor: theme.border,
};
