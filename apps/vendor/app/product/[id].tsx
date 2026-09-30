import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Row = {
  id: string;
  name: string;
  sellingPrice: number;
  mrp?: number;
  isActive: boolean;
  imageUrl?: string;
  variantName?: string;
};

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
  });

  const product = list.data?.find((p) => p.id === id);

  useEffect(() => {
    if (product) setPriceText(String(product.sellingPrice));
  }, [product?.id, product?.sellingPrice]);

  const save = useMutation({
    mutationFn: (body: { sellingPrice?: number; isActive?: boolean }) =>
      apiRequest(`/vendor/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      router.back();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (list.isLoading && !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Product" onBack={() => router.back()} />
        <View style={{ padding: spacing.xl }}>
          <Text style={styles.errorText}>Product not found</Text>
        </View>
      </View>
    );
  }

  const parsed = Number(priceText);
  const canSavePrice = Number.isFinite(parsed) && parsed >= 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit product" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroCard}>
            <View style={styles.thumb}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.thumbImg} />
              ) : (
                <Ionicons name="image-outline" size={28} color={theme.muted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{product.name}</Text>
              {product.variantName ? <Text style={styles.variant}>{product.variantName}</Text> : null}
              <View
                style={[
                  styles.badge,
                  product.isActive ? styles.badgeOn : styles.badgeOff,
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: product.isActive ? theme.success : theme.muted,
                  }}
                >
                  {product.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Selling price (₹)</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={priceText}
              onChangeText={setPriceText}
              style={styles.input}
              placeholder="0"
              placeholderTextColor={theme.muted}
            />
            {product.mrp != null ? (
              <Text style={styles.hint}>MRP {money(product.mrp)} · update selling price only</Text>
            ) : (
              <Text style={styles.hint}>Assigned by Admin — price and availability only</Text>
            )}
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => save.mutate({ sellingPrice: parsed })}
            disabled={save.isPending || !canSavePrice}
            style={[styles.primaryBtn, (!canSavePrice || save.isPending) && { opacity: 0.6 }]}
          >
            <Text style={styles.primaryText}>{save.isPending ? 'Saving…' : 'Save price'}</Text>
          </Pressable>

          <Pressable
            onPress={() => save.mutate({ isActive: !product.isActive })}
            disabled={save.isPending}
            style={[
              styles.secondaryBtn,
              product.isActive ? styles.secondaryDanger : styles.secondarySuccess,
              save.isPending && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.secondaryText,
                { color: product.isActive ? theme.danger : theme.success },
              ]}
            >
              {product.isActive ? 'Set inactive' : 'Set active'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  heroCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontSize: 17, fontWeight: '900', color: theme.text },
  variant: { marginTop: 4, fontSize: 13, color: theme.muted, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeOn: { backgroundColor: theme.successSoft },
  badgeOff: { backgroundColor: theme.surface },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  hint: { marginTop: 8, fontSize: 12, color: theme.muted, fontWeight: '600' },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: theme.onPrimary, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryDanger: { backgroundColor: theme.dangerSoft, borderColor: '#E8C5C0' },
  secondarySuccess: { backgroundColor: theme.successSoft, borderColor: '#B9D6C6' },
  secondaryText: { fontWeight: '800', fontSize: 15 },
  errorBanner: {
    backgroundColor: theme.dangerSoft,
    borderRadius: radius.sm,
    padding: 12,
  },
  errorText: { color: theme.danger, fontWeight: '600', textAlign: 'center' },
});
