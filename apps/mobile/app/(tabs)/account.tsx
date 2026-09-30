import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenHeader } from '../../components/ScreenHeader';
import { theme, spacing, radius } from '../../lib/theme';
import { useAppLocation, usePublicConfig } from '../../lib/usePublicConfig';
import { useAuthSession } from '../../lib/useAuthSession';
import { openLogin } from '../../lib/openLogin';
import { invalidateAuthSession } from '../../lib/authSession';
import { text } from '../../lib/locale';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href?: Href;
  requiresAuth?: boolean;
};

const ACCOUNT_MENU: MenuItem[] = [
  { icon: 'receipt-outline', label: 'Your orders', href: '/(tabs)/orders', requiresAuth: true },
  { icon: 'location-outline', label: 'Saved addresses', href: '/login-address', requiresAuth: true },
  { icon: 'wallet-outline', label: 'Wallet', href: '/wallet', requiresAuth: true },
];

const SUPPORT_MENU: MenuItem[] = [
  { icon: 'card-outline', label: 'Refunds & payments' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'help-circle-outline', label: 'Help & support' },
];

export default function ProfileScreen() {
  const location = useAppLocation();
  const config = usePublicConfig();
  const profile = config.data?.['mobile.profile'] as
    | { appVersion?: string; displayName?: { en: string } }
    | undefined;
  const auth = useAuthSession();
  const signedIn = auth.signedIn;
  const queryClient = useQueryClient();

  const displayName =
    auth.greetingName !== 'Guest'
      ? auth.greetingName
      : text(profile?.displayName, 'Dream Food guest');

  async function logout() {
    try {
      const { apiRequest } = await import('../../lib/api');
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // clear local session even if API fails
    }
    const { clearTokens } = await import('../../lib/api');
    await clearTokens();
    await invalidateAuthSession(queryClient);
    router.replace('/(tabs)/account');
  }

  function openItem(item: MenuItem) {
    if (item.requiresAuth && !signedIn) {
      openLogin(typeof item.href === 'string' ? item.href : '/(tabs)/account');
      return;
    }
    if (item.href === '/login-address') {
      router.push({ pathname: '/login-address', params: { returnTo: '/(tabs)/account' } });
      return;
    }
    if (item.href) router.push(item.href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Account" showCart layout="leading" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
          gap: spacing.sm,
        }}
      >
        {signedIn ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.bannerBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: theme.white, fontWeight: '800', fontSize: 18 }}>
                  {(displayName.trim()[0] ?? 'U').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '800', fontSize: 15, color: theme.text }} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {auth.me.data?.phone ?? location.label}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: theme.text }}>Welcome</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
              Sign in for faster checkout and order tracking.
            </Text>
            <Pressable
              onPress={() => openLogin('/(tabs)/account')}
              style={{
                marginTop: 12,
                backgroundColor: theme.bannerBg,
                paddingVertical: 11,
                borderRadius: radius.sm,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.white, fontWeight: '700', fontSize: 13 }}>Sign in</Text>
            </Pressable>
          </View>
        )}

        <SectionLabel>Account</SectionLabel>
        <MenuGroup items={ACCOUNT_MENU} onPress={openItem} />

        <SectionLabel>More</SectionLabel>
        <MenuGroup items={SUPPORT_MENU} onPress={openItem} />

        {signedIn ? (
          <Pressable
            onPress={logout}
            style={{
              marginTop: spacing.sm,
              backgroundColor: theme.white,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.discount, fontWeight: '700', fontSize: 13 }}>Log out</Text>
          </Pressable>
        ) : null}

        <Text
          style={{
            textAlign: 'center',
            color: theme.muted,
            fontSize: 11,
            marginTop: spacing.md,
          }}
        >
          {profile?.appVersion ?? 'Dream Food'}
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: theme.muted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 6,
        marginBottom: 2,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

function MenuGroup({
  items,
  onPress,
}: {
  items: MenuItem[];
  onPress: (item: MenuItem) => void;
}) {
  return (
    <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
      {items.map((item, index) => (
        <Pressable
          key={item.label}
          onPress={() => onPress(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: theme.neutralSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={item.icon} size={18} color={theme.primary} />
          </View>
          <Text style={{ flex: 1, fontWeight: '600', fontSize: 13, color: theme.text }}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
