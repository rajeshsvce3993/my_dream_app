import { useLocalSearchParams } from 'expo-router';
import { CategoryProductListing } from '../../components/CategoryProductListing';
import { normalizeRouteId } from '../../lib/categoryId';

export default function CategoryBrowseScreen() {
  const { id, slug, focusSearch } = useLocalSearchParams<{
    id: string;
    slug?: string;
    focusSearch?: string;
  }>();
  const routeId = normalizeRouteId(id);
  const routeSlug = typeof slug === 'string' ? slug : undefined;
  const isObjectId = Boolean(routeId && /^[a-f0-9]{24}$/i.test(routeId));

  return (
    <CategoryProductListing
      initialCategoryId={isObjectId ? routeId : undefined}
      initialCategorySlug={routeSlug ?? (!isObjectId ? routeId : undefined)}
      showBack
      autoFocusSearch={focusSearch === '1' || focusSearch === 'true'}
    />
  );
}
