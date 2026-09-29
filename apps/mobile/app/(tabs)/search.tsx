import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import type { ProductSummary } from '../../components/ProductCardHorizontal';
import { AddToCartButtonPulse } from '../../components/AddToCartButtonPulse';
import { useAddToCartFlow } from '../../components/AddToCartFlowProvider';
import { useQuickAddToCart } from '../../lib/useQuickAddToCart';
import { useAppLocation } from '../../lib/usePublicConfig';
import { globalSearchPlaceholder } from '../../lib/searchUi';
import { formatMoney } from '../../lib/format';
import { theme, spacing } from '../../lib/theme';

export default function SearchTab() {
  const [q, setQ] = useState('');
  const location = useAppLocation();
  const quickAdd = useQuickAddToCart();
  const { isAddingProduct } = useAddToCartFlow();
  const placeholder = globalSearchPlaceholder();

  const suggest = useQuery({
    queryKey: ['mobile-suggest', q],
    queryFn: () => apiRequest<{ popular: string[] }>(`/catalog/search-suggest?q=${encodeURIComponent(q)}`),
  });

  const products = useQuery({
    queryKey: ['mobile-search-products', q],
    queryFn: () =>
      apiRequest<ProductSummary[]>(
        `/catalog/product-summaries?limit=20&q=${encodeURIComponent(q)}&lng=${location.lng}&lat=${location.lat}`,
      ),
    enabled: q.trim().length >= 2,
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={placeholder}
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: spacing.lg,
        }}
      />
      {q.trim().length < 2 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(suggest.data?.popular ?? []).map((term) => (
            <Pressable
              key={term}
              onPress={() => setQ(term)}
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <Text>{term}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {(products.data ?? []).map((p) => {
        const adding = isAddingProduct(p.productId);
        const add = () => quickAdd.mutate(p as ProductSummary & { productId: string });
        return (
          <View
            key={p.productId}
            style={{
              backgroundColor: theme.surface,
              padding: spacing.lg,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Pressable onPress={add} disabled={adding}>
              <Text style={{ fontWeight: '600' }}>{p.name.en}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
              <Pressable onPress={add} disabled={adding} style={{ flex: 1 }}>
                {p.finalUnitPrice != null ? (
                  <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 16 }}>
                    {formatMoney('₹', p.finalUnitPrice)}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable onPress={add} disabled={adding} hitSlop={8}>
                <AddToCartButtonPulse productId={p.productId} loading={adding} size={30} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
