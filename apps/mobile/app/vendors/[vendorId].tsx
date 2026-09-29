import { useLocalSearchParams } from 'expo-router';
import { CategoryProductListing } from '../../components/CategoryProductListing';

export default function VendorStoreScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const id = typeof vendorId === 'string' ? vendorId : undefined;

  if (!id) return null;

  return <CategoryProductListing vendorId={id} showBack />;
}
