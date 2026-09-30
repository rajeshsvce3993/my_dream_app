import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { useDeliverySession } from '../../lib/useDeliverySession';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Me = {
  availability: 'ONLINE' | 'OFFLINE';
  approvalStatus: string;
  onboardingComplete: boolean;
  vehicleType?: string | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const session = useDeliverySession();
  const me = useQuery({
    queryKey: ['delivery-me'],
    queryFn: () => apiRequest<Me>('/delivery/me'),
  });

  const profile = me.data?.profile;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Delivery partner';
  const initial = (profile?.firstName?.[0] ?? 'D').toUpperCase();

  return (
    <View style={styles.root}>
      <ScreenHeader title="Account" subtitle="Your delivery profile" />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {me.isLoading && !me.data ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={styles.name}>{name}</Text>
              {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
            </View>

            <View style={styles.card}>
              <InfoRow
                icon="shield-checkmark-outline"
                label="Approval"
                value={me.data?.approvalStatus === 'APPROVED' ? 'Approved' : me.data?.approvalStatus ?? '—'}
              />
              <InfoRow
                icon="bicycle-outline"
                label="Vehicle"
                value={me.data?.vehicleType?.trim() || 'Not set'}
              />
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={profile?.phone?.trim() || 'Not set'}
              />
              <InfoRow
                icon="radio-outline"
                label="Status"
                value={me.data?.availability === 'ONLINE' ? 'Online' : 'Offline'}
                last
              />
            </View>

            <Pressable
              onPress={() => void session.signOut()}
              style={styles.signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={theme.delivery} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: theme.onHeader },
  name: { fontSize: 20, fontWeight: '900', color: theme.text },
  email: { marginTop: 4, fontSize: 13, color: theme.muted, fontWeight: '600' },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  infoBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
  infoValue: { fontSize: 13, fontWeight: '600', color: theme.muted, maxWidth: '45%' },
  signOut: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E8C5C0',
    backgroundColor: theme.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: { fontWeight: '800', color: theme.danger, fontSize: 15 },
});
