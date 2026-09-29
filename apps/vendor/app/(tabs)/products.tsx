import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, hasSession } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Row = {
  id: string;
  name: string;
  sellingPrice: number;
  isActive: boolean;
  imageUrl?: string;
};

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    hasSession().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const products = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
    enabled: authed === true,
  });

  if (authed === null || products.isLoading) {
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg }}>My products</Text>
      <Text style={{ color: theme.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        Assigned by Admin — update price and availability only.
      </Text>
      {products.isError ? <Text style={{ padding: spacing.lg }}>{(products.error as Error).message}</Text> : null}
      <FlatList
        data={products.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center' }}>No products assigned yet</Text>}
        renderItem={({ item }) => (
          <Link href={`/product/${item.id}`} asChild>
            <Pressable style={card}>
              <Text style={{ fontWeight: '800' }}>{item.name}</Text>
              <Text style={{ marginTop: 4 }}>₹{Math.round(item.sellingPrice)}</Text>
              <Text style={{ color: item.isActive ? theme.primary : theme.muted, marginTop: 4, fontWeight: '700' }}>
                {item.isActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const card = {
  backgroundColor: theme.surface,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginBottom: spacing.md,
  borderWidth: 1,
  borderColor: theme.border,
};
