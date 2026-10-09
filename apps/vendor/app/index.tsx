import { useEffect } from 'react';
import { router } from 'expo-router';
import { VendorSplash } from '../components/VendorSplash';
import { useVendorSession } from '../lib/useVendorSession';

const MIN_SPLASH_MS = 900;

/** Opens the app on the splash, then the shop or the sign-in screen. */
export default function BootScreen() {
  const session = useVendorSession();

  useEffect(() => {
    if (!session.ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      router.replace(session.signedIn ? '/(tabs)' : '/login');
    }, MIN_SPLASH_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session.ready, session.signedIn]);

  return <VendorSplash />;
}
