import { useEffect } from 'react';
import { router } from 'expo-router';
import { AppSplashScreen } from '../components/AppSplashScreen';
import { readOnboardingComplete } from '../lib/onboardingStorage';

const MIN_SPLASH_MS = 1600;

/**
 * Boot gate: branded splash, then onboarding (first run) or home.
 */
export default function BootScreen() {
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    (async () => {
      const done = await readOnboardingComplete();
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      router.replace(done ? '/(tabs)' : '/onboarding');
    })().catch(() => {
      if (!cancelled) router.replace('/(tabs)');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AppSplashScreen />;
}
