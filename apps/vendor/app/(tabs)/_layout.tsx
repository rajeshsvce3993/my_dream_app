import { useQuery } from '@tanstack/react-query';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VendorSplash } from '../../components/VendorSplash';
import { apiRequest } from '../../lib/api';
import { useVendorSession } from '../../lib/useVendorSession';
import { theme } from '../../lib/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const session = useVendorSession();
  const bottomInset = Math.max(insets.bottom, 8);
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest('/vendor/me'),
    enabled: session.signedIn,
    retry: false,
  });

  useEffect(() => {
    const status = (me.error as (Error & { status?: number }) | null)?.status;
    if (status === 403) void session.signOut();
  }, [me.error, session.signOut]);

  if (!session.ready) {
    return <VendorSplash />;
  }

  if (!session.signedIn) {
    return <Redirect href={'/login' as Href} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryDark,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          height: 58 + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
          backgroundColor: theme.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.tabBarBorder,
          elevation: 10,
          shadowColor: theme.primaryDark,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
