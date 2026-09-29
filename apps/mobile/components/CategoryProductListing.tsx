import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AppHeader } from './AppHeader';
import { CategoryHierarchyBrowser } from './CategoryHierarchyBrowser';
import { globalSearchPlaceholder } from '../lib/searchUi';
import { usePublicConfig } from '../lib/usePublicConfig';
import { useQuickAddToCart } from '../lib/useQuickAddToCart';
import { theme, spacing } from '../lib/theme';

type Props = {
  initialCategoryId?: string;
  initialCategorySlug?: string;
  showBack?: boolean;
  autoFocusSearch?: boolean;
  vendorId?: string;
};

export function CategoryProductListing({
  initialCategoryId,
  initialCategorySlug,
  showBack,
  autoFocusSearch,
  vendorId,
}: Props) {
  const quickAdd = useQuickAddToCart(vendorId);
  const config = usePublicConfig();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const categoryIcons =
    (config.data?.['mobile.categoryIcons'] as Record<string, string> | undefined) ?? {};
  const categoryLabels =
    (config.data?.['mobile.categoryLabels'] as Record<string, string> | undefined) ?? {};
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';

  const searchPlaceholder = globalSearchPlaceholder();

  function clearSearch() {
    setSearchInput('');
    setSearchQuery('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        showLocation={!showBack}
        showBack={showBack}
        search={{
          value: searchInput,
          onChangeText: setSearchInput,
          placeholder: searchPlaceholder,
          onClear: clearSearch,
          onSubmit: () => setSearchQuery(searchInput.trim()),
          autoFocus: autoFocusSearch,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing.xs }}>
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
          />
        </View>
      </ScrollView>
    </View>
  );
}
