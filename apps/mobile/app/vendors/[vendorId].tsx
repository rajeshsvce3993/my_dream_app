import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { CategoryProductListing } from '../../components/CategoryProductListing';
import { apiRequest } from '../../lib/api';
import { useAppLocation } from '../../lib/usePublicConfig';
import { theme } from '../../lib/theme';

type VendorDetail = { name: string; cuisineTags?: string[] };

export default function VendorStoreScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const id = typeof vendorId === 'string' ? vendorId : undefined;
  const location = useAppLocation();

  const vendor = useQuery({
    queryKey: ['vendor-detail', id, location.lng, location.lat],
    queryFn: () =>
      apiRequest<VendorDetail>(`/vendors/${id}?lng=${location.lng}&lat=${location.lat}`),
    enabled: Boolean(id),
  });

  if (!id) return null;

  if (vendor.isLoading && !vendor.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const menuTitle = vendor.data?.name ? `${vendor.data.name}` : 'Menu';

  return (
    <CategoryProductListing
      vendorId={id}
      showBack
      vendorMenuTitle={menuTitle}
    />
  );
}
