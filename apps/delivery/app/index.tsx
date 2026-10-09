import { useEffect } from 'react';
import { router } from 'expo-router';
import { DeliverySplash } from '../components/DeliverySplash';
import { useDeliverySession } from '../lib/useDeliverySession';

const MIN_SPLASH_MS = 900;

/** Opens the app on the splash, then home or sign-in. */
export default function BootScreen() {
  const session = useDeliverySession();

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

  return <DeliverySplash />;
}
