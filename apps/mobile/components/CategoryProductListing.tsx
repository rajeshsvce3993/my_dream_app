import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './AppHeader';
import { ScreenHeader } from './ScreenHeader';
import { CategoryHierarchyBrowser } from './CategoryHierarchyBrowser';
import { globalSearchPlaceholder } from '../lib/searchUi';
import { usePublicConfig } from '../lib/usePublicConfig';
import { useQuickAddToCart } from '../lib/useQuickAddToCart';
import { theme, spacing, radius } from '../lib/theme';

type Props = {
  initialCategoryId?: string;
  initialCategorySlug?: string;
  showBack?: boolean;
  autoFocusSearch?: boolean;
  vendorId?: string;
  /** Restaurant / store name when browsing a vendor menu. */
  vendorMenuTitle?: string;
};

export function CategoryProductListing({
  initialCategoryId,
  initialCategorySlug,
  showBack,
  autoFocusSearch,
  vendorId,
  vendorMenuTitle,
}: Props) {
  const insets = useSafeAreaInsets();
  const quickAdd = useQuickAddToCart(vendorId, vendorMenuTitle);
  const config = usePublicConfig();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryIcons =
    (config.data?.['mobile.categoryIcons'] as Record<string, string> | undefined) ?? {};
  const categoryLabels =
    (config.data?.['mobile.categoryLabels'] as Record<string, string> | undefined) ?? {};
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';

  const searchPlaceholder = vendorId ? 'Search menu' : globalSearchPlaceholder();

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function commitSearch(value: string) {
    setSearchQuery(value.trim());
  }

  function onChangeSearch(text: string) {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSearch(text), 280);
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    setSearchQuery('');
  }

  const pageBg = theme.bg;

  const vendorSearchBar = vendorId ? (
    <View
      style={{
        backgroundColor: pageBg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: theme.white,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          minHeight: 42,
        }}
      >
        <Ionicons name="search" size={16} color={theme.muted} />
        <TextInput
          value={searchInput}
          onChangeText={onChangeSearch}
          onSubmitEditing={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            commitSearch(searchInput);
          }}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.muted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          underlineColorAndroid="transparent"
          style={{
            flex: 1,
            fontSize: 13,
            color: theme.text,
            paddingVertical: 8,
            backgroundColor: theme.white,
          }}
        />
        {searchInput.length > 0 ? (
          <Pressable onPress={clearSearch} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'veg', label: 'Veg' },
            { id: 'nonveg', label: 'Non-veg' },
          ] as const
        ).map((chip) => {
          const selected = dietFilter === chip.id;
          const mark =
            chip.id === 'veg' ? '#2F7D5C' : chip.id === 'nonveg' ? '#B83A3A' : theme.white;
          const selectedBg =
            chip.id === 'veg'
              ? theme.successSoft
              : chip.id === 'nonveg'
                ? '#F5E0E0'
                : theme.bannerBg;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setDietFilter(chip.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: selected ? selectedBg : theme.tabChipBg,
                borderWidth: 1,
                borderColor: selected
                  ? chip.id === 'all'
                    ? theme.bannerBg
                    : mark
                  : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selected
                    ? chip.id === 'all'
                      ? theme.white
                      : mark
                    : theme.tabChipInk,
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      {vendorId && vendorMenuTitle ? (
        <ScreenHeader title={vendorMenuTitle} layout="centered" showBack showCart />
      ) : (
        <AppHeader
          showLocation={!showBack}
          showBack={showBack}
          search={{
            value: searchInput,
            onChangeText: onChangeSearch,
            placeholder: searchPlaceholder,
            onClear: clearSearch,
            onSubmit: () => commitSearch(searchInput),
            autoFocus: autoFocusSearch,
          }}
        />
      )}
      {vendorSearchBar}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1, backgroundColor: pageBg }}
        contentContainerStyle={{
          backgroundColor: pageBg,
          // Keep last menu row fully visible above home indicator / tab bar
          paddingBottom: Math.max(insets.bottom, 8) + (vendorId ? 48 : 72),
        }}
      >
        <View style={{ backgroundColor: pageBg, paddingTop: vendorId ? 0 : spacing.xs }}>
          <CategoryHierarchyBrowser
            key={`${vendorId ?? 'catalog'}-${initialCategorySlug ?? ''}-${initialCategoryId ?? ''}`}
            categoryIcons={categoryIcons}
            categoryLabels={categoryLabels}
            currency={currency}
            onAddProduct={(p) => quickAdd.mutate(p)}
            searchQuery={searchQuery}
            onSearchReset={clearSearch}
            initialCategoryId={initialCategoryId}
            initialCategorySlug={initialCategorySlug}
            vendorId={vendorId}
            dietFilter={vendorId ? dietFilter : 'all'}
          />
        </View>
      </ScrollView>
    </View>
  );
}
