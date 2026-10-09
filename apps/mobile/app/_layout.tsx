import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';
import { AddToCartFlowProvider } from '../components/AddToCartFlowProvider';
import { CartFeedbackProvider } from '../lib/cartFeedback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={theme.headerBg} />
      <QueryClientProvider client={queryClient}>
        <CartFeedbackProvider>
        <AddToCartFlowProvider>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: theme.bg },
            headerStyle: { backgroundColor: theme.headerBg },
            headerTintColor: theme.onHeader,
            headerTitleStyle: { fontWeight: '700', color: theme.onHeader },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="orders/details/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="restaurants" options={{ headerShown: false }} />
          <Stack.Screen name="vendors/[vendorId]" options={{ headerShown: false }} />
          <Stack.Screen name="wallet" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="login-address" options={{ headerShown: false, presentation: 'card' }} />
        </Stack>
        </AddToCartFlowProvider>
        </CartFeedbackProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
