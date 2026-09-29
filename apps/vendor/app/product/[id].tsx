import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../../lib/api';
import { radius, spacing, theme } from '../../lib/theme';

type Row = {
  id: string;
  name: string;
  sellingPrice: number;
  isActive: boolean;
};

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
  });

  const product = list.data?.find((p) => p.id === id);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { sellingPrice?: number; isActive?: boolean }) =>
      apiRequest(`/vendor/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      router.back();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (list.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, paddingTop: insets.top }}>
        <Text>Product not found</Text>
      </View>
    );
  }

  const priceNum = Number(price || product.sellingPrice);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + spacing.lg, padding: spacing.lg }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: theme.primary, fontWeight: '700' }}>← Back</Text>
      </Pressable>
      <Text style={{ fontSize: 22, fontWeight: '800', marginTop: spacing.md }}>{product.name}</Text>
      <Text style={{ color: theme.muted, marginBottom: spacing.lg }}>Update price or availability only.</Text>

      <Text style={{ fontWeight: '700', marginBottom: spacing.sm }}>Selling price (₹)</Text>
      <TextInput
        keyboardType="decimal-pad"
        defaultValue={String(product.sellingPrice)}
        onChangeText={setPrice}
        style={input}
      />

      {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}

      <Pressable
        onPress={() => save.mutate({ sellingPrice: priceNum })}
        disabled={save.isPending}
        style={{ backgroundColor: theme.primary, padding: 14, borderRadius: radius.md, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>Save price</Text>
      </Pressable>

      <Pressable
        onPress={() => save.mutate({ isActive: !product.isActive })}
        disabled={save.isPending}
        style={{
          marginTop: spacing.md,
          backgroundColor: product.isActive ? theme.border : theme.primary,
          padding: 14,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontWeight: '800' }}>{product.isActive ? 'Set inactive' : 'Set active'}</Text>
      </Pressable>
    </View>
  );
}

const input = {
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: radius.md,
  padding: spacing.md,
  marginBottom: spacing.lg,
};
