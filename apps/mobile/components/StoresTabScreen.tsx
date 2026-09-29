import { VendorStoresList } from './VendorStoresList';
import { useStoresAvailability } from '../lib/useStoresAvailability';

/**
 * Stores tab: inline empty state when blocked; alerts fire on tab/menu press (see openStoresMenu).
 */
export function StoresTabScreen() {
  const vendors = useStoresAvailability();
  return <VendorStoresList vendorsQuery={vendors} blockStoreNavigation />;
}
