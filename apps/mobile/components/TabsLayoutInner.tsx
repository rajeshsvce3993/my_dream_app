import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openLogin } from '../lib/openLogin';
import { useAuthSession } from '../lib/useAuthSession';
import { theme } from '../lib/theme';
import { useStoresAvailability } from '../lib/useStoresAvailability';
import { isStoresTabBlocked, showStoresTabUnavailableAlert } from '../lib/storesTabAlerts';

function TabIcon({
  name,
  outlineName,
  label,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) {
  const color = focused ? theme.primary : theme.muted;
  return (
    <View style={styles.tabItem}>
      <Ionicons name={focused ? name : outlineName} size={24} color={color} />
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '600' }]}>{label}</Text>
    </View>
  );
}

export function TabsLayoutInner() {
  const insets = useSafeAreaInsets();
  const { hasToken } = useAuthSession();
  const storesAvailability = useStoresAvailability();
  const bottomInset = insets.bottom;

  function onStoresTabPress(e: { preventDefault: () => void }) {
    const snapshot = storesAvailability.data;
    if (snapshot) {
      if (isStoresTabBlocked(snapshot.location, snapshot.items.length)) {
        e.preventDefault();
        showStoresTabUnavailableAlert(snapshot.location);
      }
      return;
    }
    e.preventDefault();
    void storesAvailability.refetch().then((res) => {
      const data = res.data;
      if (!data) {
        router.push('/(tabs)/categories');
        return;
      }
      if (isStoresTabBlocked(data.location, data.items.length)) {
        showStoresTabUnavailableAlert(data.location);
        return;
      }
      router.push('/(tabs)/categories');
    });
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" outlineName="home-outline" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        listeners={{
          tabPress: onStoresTabPress,
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="storefront" outlineName="storefront-outline" label="Stores" focused={focused} />
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
            <TabIcon name="receipt" outlineName="receipt-outline" label="Orders" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" outlineName="person-outline" label="Profile" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingTop: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 3,
  },
});
