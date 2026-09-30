import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const products = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Products" subtitle="Price & availability" />
      {products.isLoading && !products.data ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
      ) : null}
      {products.isError && !products.data ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{(products.error as Error).message}</Text>
          <Pressable onPress={() => products.refetch()}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={products.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
          gap: spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={products.isFetching && !products.isLoading}
            onRefresh={() => products.refetch()}
          />
        }
        ListEmptyComponent={
          products.isSuccess ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={28} color={theme.muted} />
              </View>
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptyBody}>Admin assigns products to this shop.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Link href={`/product/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.thumb}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                ) : (
                  <Ionicons name="image-outline" size={22} color={theme.muted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.variantName ? (
                  <Text style={styles.variant} numberOfLines={1}>
                    {item.variantName}
                  </Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{money(item.sellingPrice)}</Text>
                  {item.mrp && item.mrp > item.sellingPrice ? (
                    <Text style={styles.mrp}>{money(item.mrp)}</Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.badge, item.isActive ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeText, { color: item.isActive ? theme.success : theme.muted }]}>
                  {item.isActive ? 'Active' : 'Off'}
                </Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.card,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontSize: 14, fontWeight: '800', color: theme.text },
  variant: { marginTop: 2, fontSize: 12, color: theme.muted, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 15, fontWeight: '900', color: theme.primaryDark },
  mrp: {
    fontSize: 12,
    color: theme.muted,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeOn: { backgroundColor: theme.successSoft },
  badgeOff: { backgroundColor: theme.surface },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  emptyBody: { marginTop: 6, fontSize: 13, color: theme.muted, textAlign: 'center' },
  errorBox: { padding: spacing.xl, alignItems: 'center', gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontWeight: '600' },
  retry: { color: theme.delivery, fontWeight: '800' },
});
