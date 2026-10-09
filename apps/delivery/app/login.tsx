import { useEffect } from 'react';
import { router } from 'expo-router';
import { DeliveryLoginForm } from '../components/DeliveryLoginForm';
import { DeliverySplash } from '../components/DeliverySplash';
import { useDeliverySession } from '../lib/useDeliverySession';

export default function LoginScreen() {
  const session = useDeliverySession();

  useEffect(() => {
    if (session.ready && session.signedIn) {
      router.replace('/(tabs)');
    }
  }, [session.ready, session.signedIn]);

  if (!session.ready || session.signedIn) {
    return <DeliverySplash />;
  }

  return <DeliveryLoginForm />;
}
