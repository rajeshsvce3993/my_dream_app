import { Alert } from 'react-native';
import { serviceAreaCopy, type LocationAvailabilityMeta } from './locationMessages';

export function showStoresTabUnavailableAlert(location?: LocationAvailabilityMeta): void {
  if (location?.reason === 'OUTSIDE_SERVICE_AREA') {
    const { title, body } = serviceAreaCopy(location);
    Alert.alert(title, body);
    return;
  }
  Alert.alert(
    'No stores available nearby right now 🛍️',
    location?.vendorListEmptyMessage ??
      'We couldn’t find any stores delivering to your location right now. You can still shop from Home and add items to your cart.',
  );
}

export function isStoresTabBlocked(location?: LocationAvailabilityMeta, storeCount = 0): boolean {
  if (location?.reason === 'OUTSIDE_SERVICE_AREA') return true;
  if (storeCount === 0) return true;
  return false;
}
