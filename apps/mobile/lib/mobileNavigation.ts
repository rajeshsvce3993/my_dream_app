import { router, type Href } from 'expo-router';
import type { AppLocation } from './location';
import { isStoresTabHref, openStoresMenuOrAlert } from './openStoresMenu';

/** Same product listing screen as tapping a category shortcut on Home. */
export function openCategoryProductListing(
  categorySlug: string,
  options?: { focusSearch?: boolean },
) {
  const suffix = options?.focusSearch ? '?focusSearch=1' : '';
  router.push(`/category/${categorySlug}${suffix}` as Href);
}

export function isProductListingCta(path?: string | null): boolean {
  const raw = path?.trim();
  if (!raw) return false;
  return (
    raw === '/(tabs)/categories' ||
    raw === '/products' ||
    raw.startsWith('/products?') ||
    raw === '/cart'
  );
}

/** Maps admin / web paths from configuration to Expo Router routes. */
export function openConfiguredPath(
  path?: string | null,
  options?: { location?: Pick<AppLocation, 'lng' | 'lat'> },
) {
  const raw = path?.trim();
  if (!raw) {
    if (options?.location) void openStoresMenuOrAlert(options.location);
    else router.push('/(tabs)/categories');
    return;
  }

  if (raw.startsWith('/products/') && raw !== '/products') {
    router.push('/(tabs)/categories');
    return;
  }

  if (
    raw.startsWith('/(tabs)/') ||
    raw.startsWith('/category/') ||
    raw.startsWith('/checkout') ||
    raw.startsWith('/orders/')
  ) {
    router.push(raw as Href);
    return;
  }

  if (raw === '/search' || raw.startsWith('/search?')) {
    router.push('/(tabs)/search');
    return;
  }

  if (raw === '/cart') {
    router.push('/(tabs)/cart');
    return;
  }

  if (raw === '/products' || raw.startsWith('/products?')) {
    if (options?.location) void openStoresMenuOrAlert(options.location);
    else router.push('/(tabs)/categories');
    return;
  }

  if (raw === '/(tabs)/categories' || isStoresTabHref(raw)) {
    if (options?.location) void openStoresMenuOrAlert(options.location);
    else router.push('/(tabs)/categories');
    return;
  }

  if (raw.startsWith('/')) {
    if (options?.location) void openStoresMenuOrAlert(options.location);
    else router.push('/(tabs)/categories');
    return;
  }

  router.push(raw as Href);
}
