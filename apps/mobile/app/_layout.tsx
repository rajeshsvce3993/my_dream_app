import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';
import { AddToCartFlowProvider } from '../components/AddToCartFlowProvider';
import { CartFeedbackProvider } from '../lib/cartFeedback';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <CartFeedbackProvider>
        <AddToCartFlowProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.primary,
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="orders/details/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="vendors/[vendorId]" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="login-address" options={{ headerShown: false, presentation: 'card' }} />
        </Stack>
        </AddToCartFlowProvider>
        </CartFeedbackProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
