import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { VendorLoginForm } from '../components/VendorLoginForm';
import { useVendorSession } from '../lib/useVendorSession';
import { theme } from '../lib/theme';

export default function LoginScreen() {
  const session = useVendorSession();

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

  return <VendorLoginForm />;
}
