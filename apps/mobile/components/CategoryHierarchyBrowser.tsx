import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { categoryIdFromDoc } from '../lib/categoryId';
import { text } from '../lib/locale';
import { useAppLocation } from '../lib/usePublicConfig';
import { useCategoryBrowse } from '../lib/useCategoryBrowse';
import { productGridMetrics } from '../lib/productGridLayout';
import { theme, spacing, radius } from '../lib/theme';
import { ProductGridCard } from './ProductGridCard';
import type { ProductSummary } from './ProductCardHorizontal';
import { categoryIcon, chipLabel, parentIdFromDoc, type CategoryDoc } from './categoryHierarchyUi';

type Props = {
  parents?: CategoryDoc[];
  categoryIcons: Record<string, string>;
  categoryLabels: Record<string, string>;
  currency: string;
  onAddProduct: (product: ProductSummary) => void;
  productLimit?: number;
  subcategoryLimit?: number;
  /** When set, search is controlled by the parent (e.g. header search bar). */
  searchQuery?: string;
  onActiveSubChange?: (sub: CategoryDoc | undefined) => void;
  onSearchReset?: () => void;
  initialCategoryId?: string;
  initialCategorySlug?: string;
  /** When set, products come from this vendor’s catalog (same category UI). */
  vendorId?: string;
};

type VendorProductsPayload = {
  products: ProductSummary[];
};

export function CategoryHierarchyBrowser({
  parents: parentsProp,
  categoryIcons,
  categoryLabels,
  currency,
  onAddProduct,
  productLimit: productLimitProp,
  subcategoryLimit: subcategoryLimitProp,
  searchQuery: searchQueryProp,
  onActiveSubChange,
  onSearchReset,
  initialCategoryId,
  initialCategorySlug,
  vendorId,
}: Props) {
  const location = useAppLocation();
  const [parentId, setParentId] = useState('');
  const [subId, setSubId] = useState('');
  const [initialApplied, setInitialApplied] = useState(false);
  const appliedSearchQuery = searchQueryProp ?? '';
  const isGlobalSearch = appliedSearchQuery.trim().length >= 2;

  const browseQuery = useCategoryBrowse(!parentsProp?.length);
  const parents = parentsProp?.length ? parentsProp : (browseQuery.data?.categories ?? []);
  const productLimit = productLimitProp ?? browseQuery.data?.productLimit ?? 10;
  const subcategoryLimit = subcategoryLimitProp ?? browseQuery.data?.subcategoryLimit ?? 20;

  const initialCat = useQuery({
    queryKey: ['category-by-id', initialCategoryId],
    queryFn: () => apiRequest<CategoryDoc>(`/categories/${initialCategoryId}`),
    enabled: Boolean(initialCategoryId && /^[a-f0-9]{24}$/i.test(initialCategoryId) && !initialApplied),
  });

  const initialBySlug = useQuery({
    queryKey: ['category-by-slug', initialCategorySlug],
    queryFn: async () => {
      const items = await apiRequest<CategoryDoc[]>(
        `/categories?active=true&slug=${encodeURIComponent(initialCategorySlug!)}&limit=1`,
      );
      return items[0];
    },
    enabled: Boolean(initialCategorySlug && !initialApplied && !initialCat.data),
  });

  const subs = useQuery({
    queryKey: ['category-subs', parentId, subcategoryLimit],
    queryFn: () =>
      apiRequest<CategoryDoc[]>(
        `/categories?parentId=${encodeURIComponent(parentId)}&active=true&limit=${subcategoryLimit}`,
      ),
    enabled: Boolean(parentId),
  });

  useEffect(() => {
    if (!parents.length || initialApplied) return;

    const slug = initialCategorySlug?.trim();
    const id = initialCategoryId?.trim();

    if (initialCat.data) {
      const cat = initialCat.data;
      const catId = categoryIdFromDoc(cat);
      const pId = parentIdFromDoc(cat);
      if (pId) {
        setParentId(pId);
        setSubId(catId);
      } else {
        setParentId(catId);
      }
      setInitialApplied(true);
      return;
    }

    if (initialBySlug.data) {
      const cat = initialBySlug.data;
      const catId = categoryIdFromDoc(cat);
      const pId = parentIdFromDoc(cat);
      if (pId) {
        setParentId(pId);
        setSubId(catId);
      } else {
        setParentId(catId);
      }
      setInitialApplied(true);
      return;
    }

    if (slug) {
      const asParent = parents.find((p) => p.slug === slug);
      if (asParent) {
        setParentId(categoryIdFromDoc(asParent));
        setInitialApplied(true);
        return;
      }
    }

    if (!slug && !id) {
      setParentId(categoryIdFromDoc(parents[0]));
      setInitialApplied(true);
    }
  }, [parents, initialCategorySlug, initialCategoryId, initialCat.data, initialBySlug.data, initialApplied]);

  useEffect(() => {
    if (initialCategorySlug?.trim() || initialCategoryId?.trim()) return;
    if (parents.length && !parentId) {
      setParentId(categoryIdFromDoc(parents[0]));
    }
  }, [parents, parentId, initialCategorySlug, initialCategoryId]);

  useEffect(() => {
    const list = subs.data ?? [];
    if (!list.length) {
      setSubId('');
      return;
    }
    if (!list.some((s) => categoryIdFromDoc(s) === subId)) {
      setSubId(categoryIdFromDoc(list[0]));
    }
  }, [subs.data, subId]);

  const activeSub = subs.data?.find((s) => categoryIdFromDoc(s) === subId);

  useEffect(() => {
    onActiveSubChange?.(activeSub);
  }, [activeSub, onActiveSubChange]);

  const products = useQuery({
    queryKey: [
      'category-hierarchy-products',
      vendorId ?? 'catalog',
      isGlobalSearch ? 'global' : subId,
      appliedSearchQuery,
      location.lng,
      location.lat,
      productLimit,
    ],
    queryFn: async () => {
      if (vendorId) {
        const qs = new URLSearchParams({
          page: '1',
          limit: String(productLimit),
          lng: String(location.lng),
          lat: String(location.lat),
        });
        if (isGlobalSearch) qs.set('search', appliedSearchQuery.trim());
        else if (subId) qs.set('categoryId', subId);
        const payload = await apiRequest<VendorProductsPayload>(`/vendors/${vendorId}/products?${qs}`);
        return payload.products ?? [];
      }

      const qs = new URLSearchParams({
        limit: String(productLimit),
        lng: String(location.lng),
        lat: String(location.lat),
      });
      if (isGlobalSearch) {
        qs.set('q', appliedSearchQuery.trim());
      } else if (subId) {
        qs.set('categoryId', subId);
      }
      return apiRequest<ProductSummary[]>(`/catalog/product-summaries?${qs}`);
    },
    enabled: isGlobalSearch || Boolean(subId),
    staleTime: 60_000,
  });

  if (!parents.length && browseQuery.isLoading) {
    return <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />;
  }
  if (!parents.length) return null;

  const screenW = Dimensions.get('window').width;
  const { gap: productGap, cardWidth } = productGridMetrics(screenW);
  const listing = products.data ?? [];

  function selectParent(id: string) {
    setParentId(id);
    onSearchReset?.();
  }

  function selectSub(id: string) {
    setSubId(id);
    onSearchReset?.();
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {parents.map((p) => {
          const id = categoryIdFromDoc(p);
          const selected = id === parentId;
          return (
            <Pressable
              key={id}
              onPress={() => selectParent(id)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 2 }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.full,
                  backgroundColor: selected ? theme.primary : '#EEF0F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 2 : 0,
                  borderColor: theme.primaryDark,
                }}
              >
                <Ionicons
                  name={categoryIcon(p.slug, categoryIcons)}
                  size={22}
                  color={selected ? '#FFFFFF' : theme.primary}
                />
              </View>
              <Text
                numberOfLines={2}
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: selected ? '800' : '600',
                  color: selected ? theme.primaryDark : theme.text,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {chipLabel(p.slug, p.name.en, categoryLabels)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subs.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} color={theme.primary} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.xs,
            marginTop: spacing.sm,
          }}
        >
          {(subs.data ?? []).map((s) => {
            const id = categoryIdFromDoc(s);
            const selected = id === subId;
            return (
              <Pressable
                key={id}
                onPress={() => selectSub(id)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderWidth: 1,
                  borderColor: selected ? theme.primary : theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: selected ? '#FFFFFF' : theme.text,
                  }}
                >
                  {text(s.name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {products.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={theme.primary} />
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: productGap,
            rowGap: productGap,
            paddingHorizontal: spacing.lg,
            marginTop: spacing.md,
            paddingBottom: spacing.xl,
            minHeight: 120,
          }}
        >
          {listing.map((p) => (
            <ProductGridCard
              key={p.productId}
              product={p}
              currency={currency}
              width={cardWidth}
              onAdd={() => onAddProduct(p)}
            />
          ))}
          {listing.length === 0 && !products.isLoading ? (
            <Text style={{ width: '100%', textAlign: 'center', color: theme.muted, marginTop: spacing.lg }}>
              {isGlobalSearch
                ? `No results for “${appliedSearchQuery.trim()}”.`
                : vendorId
                  ? `No products in ${activeSub?.name.en ?? 'this category'} at this store.`
                  : `No products in ${activeSub?.name.en ?? 'this category'} yet.`}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
