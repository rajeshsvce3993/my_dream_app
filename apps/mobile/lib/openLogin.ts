import { router } from 'expo-router';

export function openLogin(returnTo?: string): void {
  if (returnTo) {
    router.push({ pathname: '/login', params: { returnTo } });
  } else {
    router.push('/login');
  }
}

export function afterAuthNavigate(needsAddress: boolean, returnTo?: string): void {
  if (needsAddress) {
    router.replace({
      pathname: '/login-address',
      params: returnTo ? { returnTo } : {},
    });
    return;
  }
  if (returnTo && returnTo.startsWith('/')) {
    router.replace(returnTo as '/checkout');
    return;
  }
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}
