import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { theme, spacing, radius, shadow } from '../../lib/theme';
import { screenHeaderStyles as h } from '../../lib/screenHeaderStyles';
import { useAppLocation, usePublicConfig } from '../../lib/usePublicConfig';
import { useAuthSession } from '../../lib/useAuthSession';
import { openLogin } from '../../lib/openLogin';
import { invalidateAuthSession } from '../../lib/authSession';
import { useQueryClient } from '@tanstack/react-query';
import { text } from '../../lib/locale';

const MENU = [
  { icon: 'cube-outline' as const, label: 'Your Orders', href: '/(tabs)/orders', tint: theme.successSoft, color: theme.primary },
  { icon: 'location-outline' as const, label: 'Saved Addresses', href: '/(tabs)/account', tint: theme.neutralSoft, color: theme.primary },
  { icon: 'wallet-outline' as const, label: 'Refunds & Payments', href: '/(tabs)/account', tint: theme.neutralSoft, color: theme.primary },
  { icon: 'notifications-outline' as const, label: 'Notifications', href: '/(tabs)/account', tint: theme.neutralSoft, color: theme.muted },
  { icon: 'help-circle-outline' as const, label: 'Help & Support', href: '/(tabs)/account', tint: theme.neutralSoft, color: theme.muted },
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Profile" showCart layout="leading" />

      <ScrollView contentContainerStyle={h.bodyPadding}>
        {signedIn ? (
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: theme.surface,
              padding: spacing.lg,
              borderRadius: radius.md,
              marginBottom: spacing.lg,
              ...shadow.card,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: theme.neutralSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={28} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 17 }}>
                {auth.greetingName !== 'Guest' ? auth.greetingName : text(profile?.displayName, 'FreshMart Customer')}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 2 }}>
                {auth.me.data?.phone ?? location.label}
              </Text>
              <Text style={{ color: theme.primary, marginTop: 4, fontWeight: '600' }}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openLogin('/(tabs)/account')}
            style={{
              backgroundColor: theme.primary,
              padding: spacing.lg,
              borderRadius: radius.md,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800', textAlign: 'center' }}>Sign in</Text>
          </Pressable>
        )}

        {MENU.slice(0, 3).map((item) => (
          <Pressable
            key={item.label}
            onPress={() => {
              if (!signedIn) {
                openLogin(item.href === '/(tabs)/orders' ? '/(tabs)/orders' : '/(tabs)/account');
                return;
              }
              router.push(item.href as '/(tabs)/orders');
            }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                padding: spacing.lg,
                borderRadius: radius.md,
                marginBottom: spacing.sm,
                ...shadow.card,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: item.tint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={{ flex: 1, marginLeft: spacing.md, fontWeight: '600' }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.muted} />
            </Pressable>
        ))}

        <View style={{ height: spacing.md }} />

        {MENU.slice(3).map((item) => (
          <Pressable
            key={item.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surface,
              padding: spacing.lg,
              borderRadius: radius.md,
              marginBottom: spacing.sm,
              ...shadow.card,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: item.tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={{ flex: 1, marginLeft: spacing.md, fontWeight: '600' }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.muted} />
          </Pressable>
        ))}

        {signedIn ? (
          <Pressable
            onPress={logout}
            style={{
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: theme.discount,
              backgroundColor: theme.surface,
            }}
          >
            <Text style={{ color: theme.discount, fontWeight: '800', textAlign: 'center' }}>Log Out</Text>
          </Pressable>
        ) : null}

        <Text style={{ textAlign: 'center', color: theme.muted, fontSize: 12, marginTop: spacing.xl }}>
          {profile?.appVersion ?? 'FreshMart App v2.4.1'}
        </Text>
      </ScrollView>
    </View>
  );
}
