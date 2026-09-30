import { router, type Href } from 'expo-router';
import type { AppLocation } from './location';
import { fetchStoresAvailability } from './useStoresAvailability';
import { isStoresTabBlocked, showStoresTabUnavailableAlert } from './storesTabAlerts';

const STORES_TAB_HREF = '/restaurants' as Href;

/** Restaurant list — alert in place when blocked; opens with back navigation. */
export async function openStoresMenuOrAlert(
  location: Pick<AppLocation, 'lng' | 'lat'>,
): Promise<boolean> {
  const snapshot = await fetchStoresAvailability(location.lng, location.lat);
  if (isStoresTabBlocked(snapshot.location, snapshot.items.length)) {
    showStoresTabUnavailableAlert(snapshot.location);
    return false;
  }
  router.push(STORES_TAB_HREF);
  return true;
}

export function isStoresTabHref(path?: string | null): boolean {
  const raw = path?.trim();
  if (!raw) return true;
  return raw === '/(tabs)/categories' || raw === '/products' || raw.startsWith('/products?');
}
