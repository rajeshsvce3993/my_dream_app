import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

const queryClient = new QueryClient();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.primaryDark },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
