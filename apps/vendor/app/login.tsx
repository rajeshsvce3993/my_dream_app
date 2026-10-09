import { useEffect } from 'react';
import { router } from 'expo-router';
import { VendorLoginForm } from '../components/VendorLoginForm';
import { VendorSplash } from '../components/VendorSplash';
import { useVendorSession } from '../lib/useVendorSession';

export default function LoginScreen() {
  const session = useVendorSession();

  useEffect(() => {
    if (session.ready && session.signedIn) {
      router.replace('/(tabs)');
    }
  }, [session.ready, session.signedIn]);

  if (!session.ready || session.signedIn) {
    return <VendorSplash />;
  }

  return <VendorLoginForm />;
}
