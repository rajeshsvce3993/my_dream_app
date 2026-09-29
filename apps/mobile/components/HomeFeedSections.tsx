import { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCardHorizontal, type ProductSummary } from './ProductCardHorizontal';
import { ProductGridCard } from './ProductGridCard';
import { text } from '../lib/locale';
import { globalSearchPlaceholder } from '../lib/searchUi';
import {
  isProductListingCta,
  openCategoryProductListing,
  openConfiguredPath,
} from '../lib/mobileNavigation';
import { HomeCategoryShortcuts } from './HomeCategoryShortcuts';
import { productGridMetrics } from '../lib/productGridLayout';
import { theme, spacing, radius, shadow } from '../lib/theme';
import { useAppLocation } from '../lib/usePublicConfig';

type HomeFeedSection = {
  id: string;
  type: string;
  title?: { en: string; ta?: string };
  data: unknown;
};

type PromoSlide = {
  label: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  ctaLabel?: { en: string; ta?: string };
  ctaPath?: string;
  imageUrl?: string;
  backgroundColor?: string;
};

type Props = {
  sections: HomeFeedSection[];
  currency: string;
  categoryIcons: Record<string, string>;
  categoryLabels: Record<string, string>;
  onAddProduct: (product: ProductSummary) => void;
};

const SECTION_ORDER: Record<string, number> = {
  promo_strip: 0,
  category_shortcuts: 1,
  product_row: 2,
};

export function HomeFeedSections({ sections, currency, categoryIcons, categoryLabels, onAddProduct }: Props) {
  const [promoIndex, setPromoIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const location = useAppLocation();
  const searchPlaceholder = globalSearchPlaceholder();

  const categorySection = sections.find((s) => s.type === 'category_shortcuts');
  const homeCategories =
    (categorySection?.data as { categories: Array<{ _id: string; slug: string; name: { en: string } }> })
      ?.categories ?? [];
  const defaultListingSlug = homeCategories[0]?.slug;

  function openDefaultProductListing() {
    if (defaultListingSlug) openCategoryProductListing(defaultListingSlug);
    else openConfiguredPath('/(tabs)/categories', { location });
  }

  function openProductListingWithSearchFocus() {
    if (defaultListingSlug) openCategoryProductListing(defaultListingSlug, { focusSearch: true });
    else openConfiguredPath('/(tabs)/categories', { location });
  }

  const orderedSections = [...sections].sort(
    (a, b) => (SECTION_ORDER[a.type] ?? 99) - (SECTION_ORDER[b.type] ?? 99),
  );

  return (
    <>
      <Pressable
        onPress={openProductListingWithSearchFocus}
        style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs }}
        accessibilityRole="search"
        accessibilityLabel="Search products"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.full,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 42,
          }}
        >
          <Ionicons name="search" size={18} color={theme.muted} />
          <Text style={{ flex: 1, fontSize: 14, color: theme.muted }} numberOfLines={1}>
            {searchPlaceholder}
          </Text>
        </View>
      </Pressable>
      {orderedSections.map((section) => {
        if (section.type === 'promo_strip') {
          const promos = (section.data as { promos: PromoSlide[] }).promos ?? [];
          if (!promos.length) return null;
          return (
            <View key={section.id} style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={screenWidth}
                snapToAlignment="center"
                onMomentumScrollEnd={(e) => {
                  const i = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                  setPromoIndex(i);
                }}
              >
                {promos.map((slide, idx) => (
                  <View key={idx} style={{ width: screenWidth, paddingHorizontal: spacing.lg }}>
                    <View
                      style={{
                        backgroundColor: slide.backgroundColor ?? theme.primary,
                        borderRadius: radius.lg,
                        overflow: 'hidden',
                        flexDirection: 'row',
                        minHeight: 112,
                        ...shadow.card,
                      }}
                    >
                      <View style={{ flex: 1, padding: spacing.md, justifyContent: 'center', paddingRight: 6 }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 18, lineHeight: 22 }}>
                          {text(slide.label)}
                        </Text>
                        {slide.subtitle ? (
                          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                            {text(slide.subtitle)}
                          </Text>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            if (isProductListingCta(slide.ctaPath) && defaultListingSlug) {
                              openCategoryProductListing(defaultListingSlug);
                              return;
                            }
                            openConfiguredPath(slide.ctaPath, { location });
                          }}
                          style={{
                            marginTop: spacing.sm,
                            alignSelf: 'flex-start',
                            backgroundColor: 'white',
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: radius.full,
                          }}
                        >
                          <Text style={{ color: theme.primaryDark, fontWeight: '800', fontSize: 12 }}>
                            {text(slide.ctaLabel, 'Order Now')}
                          </Text>
                        </Pressable>
                      </View>
                      {slide.imageUrl ? (
                        <Image
                          source={{ uri: slide.imageUrl }}
                          style={{ width: 96, minHeight: 112 }}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.xs }}>
                {promos.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === promoIndex ? 8 : 6,
                      height: i === promoIndex ? 8 : 6,
                      borderRadius: 4,
                      backgroundColor: i === promoIndex ? theme.primary : '#CBD5E1',
                      opacity: i === promoIndex ? 1 : 0.7,
                    }}
                  />
                ))}
              </View>
            </View>
          );
        }

        if (section.type === 'category_shortcuts') {
          const browseData = section.data as {
            categories: Array<{ _id: string; slug: string; name: { en: string } }>;
            defaultSubcategorySlugByParent?: Record<string, string>;
          };
          return (
            <HomeCategoryShortcuts
              key={section.id}
              parents={browseData.categories}
              categoryIcons={categoryIcons}
              categoryLabels={categoryLabels}
              defaultSubcategorySlugByParent={browseData.defaultSubcategorySlugByParent}
            />
          );
        }

        if (section.type === 'product_row') {
          const rowData = section.data as {
            products: ProductSummary[];
            layout?: string;
            viewAllPath?: string;
            viewAllCategorySlug?: string;
            viewAllLabel?: { en: string; ta?: string } | string;
          };
          const { products, layout } = rowData;
          if (!products.length) return null;
          const sectionTitle = text(section.title, 'Frequently Bought Essentials');
          const viewAllLabelText =
            typeof rowData.viewAllLabel === 'string'
              ? rowData.viewAllLabel
              : text(rowData.viewAllLabel, 'View all');

          function onProductRowViewAll() {
            if (rowData.viewAllCategorySlug) openCategoryProductListing(rowData.viewAllCategorySlug);
            else if (rowData.viewAllPath) openConfiguredPath(rowData.viewAllPath, { location });
            else openDefaultProductListing();
          }

          const productRowHeader = (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text
                style={{ fontWeight: '800', fontSize: 18, color: theme.text, flex: 1 }}
                numberOfLines={1}
              >
                {sectionTitle}
              </Text>
              <Pressable onPress={onProductRowViewAll} hitSlop={8} accessibilityRole="link">
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>{viewAllLabelText}</Text>
              </Pressable>
            </View>
          );

          if (layout === 'grid') {
            const screenW = Dimensions.get('window').width;
            const { gap, cardWidth } = productGridMetrics(screenW);
            return (
              <View key={section.id} style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.lg }}>
                {productRowHeader}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: gap }}>
                  {products.map((p) => (
                    <ProductGridCard
                      key={p.productId}
                      product={p}
                      currency={currency}
                      width={cardWidth}
                      onAdd={() => onAddProduct(p)}
                    />
                  ))}
                </View>
              </View>
            );
          }

          return (
            <View key={section.id} style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.lg }}>
              {productRowHeader}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4, paddingRight: spacing.sm }}
              >
                {products.map((p) => (
                  <ProductCardHorizontal
                    key={p.productId}
                    product={p}
                    currency={currency}
                    onAdd={() => onAddProduct(p)}
                  />
                ))}
              </ScrollView>
            </View>
          );
        }

        return null;
      })}
    </>
  );
}
