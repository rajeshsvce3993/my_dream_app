import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import type { ProductSummary } from '../../components/ProductCardHorizontal';
import { ProductMenuRow } from '../../components/ProductMenuRow';
import { useQuickAddToCart } from '../../lib/useQuickAddToCart';
import { useAppLocation } from '../../lib/usePublicConfig';
import { globalSearchPlaceholder } from '../../lib/searchUi';
import { theme, spacing, radius } from '../../lib/theme';
import { ScreenHeader } from '../../components/ScreenHeader';

type SuggestPayload = { popular?: string[]; suggestions?: string[] };

export default function SearchTab() {
  const params = useLocalSearchParams<{ q?: string; title?: string; mode?: string; diet?: string }>();
  const topPickMode =
    params.mode === 'topPick' ||
    (params.mode !== 'search' && typeof params.title === 'string' && Boolean(params.title.trim()));
  const paramQ = typeof params.q === 'string' ? params.q : '';
  const dietFilter =
    params.diet === 'veg' || params.diet === 'nonveg' ? params.diet : undefined;
  const pageTitle =
    topPickMode && typeof params.title === 'string' && params.title.trim()
      ? params.title.trim()
      : 'Search';

  const [q, setQ] = useState(topPickMode ? paramQ : '');
  const [committedQ, setCommittedQ] = useState(topPickMode ? paramQ.trim() : '');
  const location = useAppLocation();
  const quickAdd = useQuickAddToCart();
  const placeholder = globalSearchPlaceholder();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when navigating between home search and top-pick results.
  useEffect(() => {
    if (topPickMode) {
      setQ(paramQ);
      setCommittedQ(paramQ.trim());
      return;
    }
    setQ('');
    setCommittedQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [topPickMode, paramQ, params.mode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onChangeQuery(text: string) {
    setQ(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCommittedQ(text.trim());
    }, 350);
  }

  function runSearch(term?: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = (term ?? q).trim();
    setQ(next);
    setCommittedQ(next);
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ('');
    setCommittedQ('');
    inputRef.current?.focus();
  }

  const suggest = useQuery({
    queryKey: ['mobile-suggest', committedQ],
    queryFn: () =>
      apiRequest<SuggestPayload>(
        `/catalog/search-suggest?q=${encodeURIComponent(committedQ || q)}`,
      ),
    enabled: !topPickMode && committedQ.length < 2,
  });

  const products = useQuery({
    queryKey: ['mobile-dish-offers', committedQ, location.lng, location.lat, dietFilter],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: '60',
        q: committedQ,
        lng: String(location.lng),
        lat: String(location.lat),
      });
      if (dietFilter) qs.set('diet', dietFilter);
      return apiRequest<ProductSummary[]>(`/catalog/dish-offers?${qs}`);
    },
    enabled: committedQ.length >= 2,
  });

  const listing = products.data ?? [];
  const popular = suggest.data?.popular ?? [];
  const suggestions = suggest.data?.suggestions ?? [];

  async function onSelectOffer(p: ProductSummary) {
    const added = await quickAdd.mutate(p);
    if (!added) return;
    if (topPickMode && p.recommendedVendorId) {
      router.push(`/vendors/${p.recommendedVendorId}` as Href);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title={pageTitle} layout="leading" showBack showCart />

      {!topPickMode ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: theme.bg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.white,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: radius.md,
              paddingHorizontal: 12,
              minHeight: 44,
            }}
          >
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              ref={inputRef}
              value={q}
              onChangeText={onChangeQuery}
              onSubmitEditing={() => runSearch()}
              placeholder={placeholder}
              placeholderTextColor={theme.muted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              style={{
                flex: 1,
                fontSize: 14,
                color: theme.text,
                paddingVertical: 10,
              }}
            />
            {q.length > 0 ? (
              <Pressable onPress={clearSearch} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: theme.bg, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!topPickMode && committedQ.length < 2 ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
            {suggestions.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.2 }}>
                  SUGGESTIONS
                </Text>
                {suggestions.map((term) => (
                  <Pressable
                    key={`s-${term}`}
                    onPress={() => runSearch(term)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Ionicons name="arrow-forward" size={16} color={theme.muted} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.text }}>
                      {term}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: theme.muted,
                  letterSpacing: 0.2,
                  marginBottom: spacing.xs,
                }}
              >
                POPULAR
              </Text>
              {(popular.length ? popular : ['Dosa', 'Biryani', 'Idli', 'Fried rice', 'Pizza']).map(
                (term, index, arr) => (
                  <Pressable
                    key={`p-${term}`}
                    onPress={() => runSearch(term)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: index < arr.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Ionicons name="trending-up" size={16} color={theme.muted} />
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.text }}
                    >
                      {term}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.border} />
                  </Pressable>
                ),
              )}
            </View>
          </View>
        ) : null}

        {committedQ.length >= 2 && products.isLoading ? (
          <View style={{ paddingTop: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={theme.primary} />
            <Text style={{ fontSize: 12, color: theme.muted }}>Searching nearby restaurants…</Text>
          </View>
        ) : null}

        {committedQ.length >= 2 && !products.isLoading && listing.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={36} color={theme.border} />
            <Text
              style={{
                textAlign: 'center',
                color: theme.text,
                marginTop: spacing.md,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              No matches for “{committedQ}”
            </Text>
            <Text
              style={{
                textAlign: 'center',
                color: theme.muted,
                marginTop: spacing.xs,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Try another dish name from restaurants near you.
            </Text>
          </View>
        ) : null}

        {committedQ.length >= 2 && listing.length > 0 ? (
          <View style={{ paddingTop: spacing.xs }}>
            <Text
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.sm,
                fontSize: 12,
                fontWeight: '600',
                color: theme.muted,
              }}
            >
              {listing.length} from restaurants near you
            </Text>
            <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
              {listing.map((p, index) => (
                <ProductMenuRow
                  key={`${p.productId}:${p.recommendedVendorId ?? index}`}
                  product={p}
                  onAdd={() => {
                    void onSelectOffer(p);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
