import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openCategoryProductListing } from '../lib/mobileNavigation';
import { theme, spacing, radius } from '../lib/theme';
import { categoryIdFromDoc } from '../lib/categoryId';
import { categoryIcon, chipLabel, type CategoryDoc } from './categoryHierarchyUi';

type Props = {
  parents: CategoryDoc[];
  categoryIcons: Record<string, string>;
  categoryLabels: Record<string, string>;
  defaultSubcategorySlugByParent?: Record<string, string>;
};

/** Parent categories only — tap opens full listing with subcategories + products. */
export function HomeCategoryShortcuts({
  parents,
  categoryIcons,
  categoryLabels,
  defaultSubcategorySlugByParent = {},
}: Props) {
  if (!parents.length) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: spacing.sm,
        marginBottom: spacing.md,
      }}
    >
      {parents.map((p) => {
        const id = categoryIdFromDoc(p);
        return (
          <Pressable
            key={id}
            onPress={() => {
              const subSlug = defaultSubcategorySlugByParent[p.slug];
              openCategoryProductListing(subSlug ?? p.slug);
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 2 }}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${p.name.en}`}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.full,
                backgroundColor: '#EEF0F3',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={categoryIcon(p.slug, categoryIcons)} size={22} color={theme.primary} />
            </View>
            <Text
              numberOfLines={2}
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: '600',
                color: theme.text,
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
  );
}
