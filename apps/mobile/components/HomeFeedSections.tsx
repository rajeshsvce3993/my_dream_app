import { router } from 'expo-router';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCardHorizontal, type ProductSummary } from './ProductCardHorizontal';
import { ProductGridCard } from './ProductGridCard';
import { text } from '../lib/locale';
import { globalSearchPlaceholder } from '../lib/searchUi';
import { openCategoryProductListing, openConfiguredPath } from '../lib/mobileNavigation';
import { HomePromoBanner } from './HomePromoBanner';
import { HomeFoodModeTab, type FoodModeConfig, type HomeServiceTab } from './HomeFoodModeTab';
import { HomeTopPicks, type TopPickItem } from './HomeTopPicks';
import { HomeTopRestaurants, type TopRestaurantCard } from './HomeTopRestaurants';
import { productGridMetrics } from '../lib/productGridLayout';
import { theme, spacing, radius, shadow } from '../lib/theme';
import { useAppLocation } from '../lib/usePublicConfig';

type HomeFeedSection = {
  id: string;
  type: string;
  title?: { en: string; ta?: string };
  data: unknown;
};

type Props = {
  sections: HomeFeedSection[];
  currency: string;
  searchPlaceholder?: string;
  foodMode?: FoodModeConfig;
  serviceTabs?: HomeServiceTab[];
  onAddProduct: (product: ProductSummary) => void;
};

const SECTION_ORDER: Record<string, number> = {
  promo_strip: 0,
  top_picks: 1,
  vendor_row: 2,
  product_row: 3,
};

export function HomeFeedSections({
  sections,
  currency,
  searchPlaceholder: searchPlaceholderProp,
  foodMode,
  serviceTabs,
  onAddProduct,
}: Props) {
  const location = useAppLocation();
  const searchPlaceholder = searchPlaceholderProp ?? globalSearchPlaceholder();

  function openDefaultProductListing() {
    openConfiguredPath('/(tabs)/categories', { location });
  }

  const orderedSections = [...sections].sort(
    (a, b) => (SECTION_ORDER[a.type] ?? 99) - (SECTION_ORDER[b.type] ?? 99),
  );

  return (
    <>
      <View style={{ backgroundColor: theme.headerBg, paddingTop: spacing.sm }}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/search',
              params: { mode: 'search' },
            })
          }
          style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
          accessibilityRole="search"
          accessibilityLabel="Search"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.white,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.35)',
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 48,
              shadowColor: theme.headerBg,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.22,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Ionicons name="search" size={18} color={theme.muted} />
            <Text style={{ flex: 1, fontSize: 14, color: theme.muted }} numberOfLines={1}>
              {searchPlaceholder}
            </Text>
          </View>
        </Pressable>
      </View>
      {/* Tab straddles header → body: top half header color, bottom half body */}
      <HomeFoodModeTab tabs={serviceTabs} config={foodMode} />
      {orderedSections.map((section) => {
        if (section.type === 'vertical_shortcuts' || section.type === 'category_shortcuts') {
          return null;
        }

        if (section.type === 'promo_strip') {
          const promos = (section.data as { promos: import('./HomePromoBanner').PromoSlide[] }).promos ?? [];
          return (
            <HomePromoBanner key={section.id} promos={promos} />
          );
        }

        if (section.type === 'top_picks') {
          const picks = (section.data as { picks: TopPickItem[] }).picks ?? [];
          return <HomeTopPicks key={section.id} title={section.title} picks={picks} />;
        }

        if (section.type === 'vendor_row') {
          const row = section.data as {
            vendors: TopRestaurantCard[];
            viewAllPath?: string;
            viewAllLabel?: { en: string; ta?: string } | string;
          };
          return (
            <HomeTopRestaurants
              key={section.id}
              title={section.title}
              vendors={row.vendors ?? []}
              viewAllPath={row.viewAllPath}
              viewAllLabel={row.viewAllLabel}
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
          const sectionTitle = text(section.title, 'Top Picks for You');
          const viewAllLabelText =
            typeof rowData.viewAllLabel === 'string'
              ? rowData.viewAllLabel
              : text(rowData.viewAllLabel, 'See all');

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
                <Text style={{ color: '#1B5E3B', fontWeight: '800', fontSize: 13 }}>
                  {viewAllLabelText} ›
                </Text>
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
                    cardWidth={168}
                    imageHeight={118}
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
