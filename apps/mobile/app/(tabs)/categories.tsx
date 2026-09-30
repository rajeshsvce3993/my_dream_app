import { useLocalSearchParams } from 'expo-router';
import { CategoryProductListing } from '../../components/CategoryProductListing';
import { RestaurantsScreen } from '../../components/RestaurantsScreen';
import { normalizeRouteId } from '../../lib/categoryId';

export default function StoreScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; slug?: string; vendorId?: string }>();
  const categoryId = normalizeRouteId(params.categoryId);
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const vendorId = typeof params.vendorId === 'string' ? params.vendorId : undefined;

  if (vendorId) {
    return <CategoryProductListing vendorId={vendorId} />;
  }

  if (categoryId || slug) {
    return <CategoryProductListing initialCategoryId={categoryId} initialCategorySlug={slug} />;
  }

  return <RestaurantsScreen showBack={false} />;
}
