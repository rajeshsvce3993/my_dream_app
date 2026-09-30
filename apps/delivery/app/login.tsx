import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { DeliveryLoginForm } from '../components/DeliveryLoginForm';
import { useDeliverySession } from '../lib/useDeliverySession';
import { theme } from '../lib/theme';

export default function LoginScreen() {
  const session = useDeliverySession();

  useEffect(() => {
    if (session.ready && session.signedIn) {
      router.replace('/(tabs)');
    }
  }, [session.ready, session.signedIn]);

  if (!session.ready || session.signedIn) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return <DeliveryLoginForm />;
}
