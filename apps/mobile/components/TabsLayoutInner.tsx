import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AnimatedTabIcon } from './AnimatedTabIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openLogin } from '../lib/openLogin';
import { useAuthSession } from '../lib/useAuthSession';
import { theme } from '../lib/theme';

export function TabsLayoutInner() {
  const insets = useSafeAreaInsets();
  const { hasToken } = useAuthSession();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.headerBg,
        tabBarInactiveTintColor: theme.tabInactive,
        sceneContainerStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          height: 58 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.tabBarBorder,
          backgroundColor: theme.tabBarBg,
          elevation: 12,
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
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="home" outlineName="home-outline" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              name="pricetag"
              outlineName="pricetag-outline"
              label="Offers"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="cart" outlineName="cart-outline" label="Cart" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        listeners={{
          tabPress: (e) => {
            if (hasToken === false) {
              e.preventDefault();
              openLogin('/(tabs)/orders');
            }
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="receipt" outlineName="receipt-outline" label="Orders" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="person" outlineName="person-outline" label="Account" focused={focused} />
          ),
        }}
      />
      {/* Keep route for deep links / View all restaurants — hidden from footer */}
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
