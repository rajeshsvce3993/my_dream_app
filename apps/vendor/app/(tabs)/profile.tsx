import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { apiRequest } from '../../lib/api';
import { useVendorSession } from '../../lib/useVendorSession';
import { radius, shadow, spacing, theme } from '../../lib/theme';

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { name: string; code: string; status: string } | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const session = useVendorSession();

  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
  });

  const toggleOrders = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiRequest('/vendor/me/accepting-orders', {
        method: 'POST',
        body: JSON.stringify({ acceptingOrders }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-me'] }),
  });

  const data = me.data;
  const shopOpen = Boolean(data?.acceptingOrders && data?.vendor?.status === 'ACTIVE');
  const profile = data?.profile;
  const staffName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Vendor staff';
  const initial = (profile?.firstName?.[0] ?? data?.vendor?.name?.[0] ?? 'V').toUpperCase();

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Profile"
        subtitle="Shop settings"
        statusOpen={shopOpen}
        statusLabel={shopOpen ? 'Open' : 'Closed'}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={me.isFetching && !me.isLoading} onRefresh={() => me.refetch()} />
        }
      >
        {me.isLoading && !data ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
        ) : null}

        {data ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={styles.name}>{data.vendor?.name ?? 'Shop'}</Text>
              <Text style={styles.email}>{staffName}</Text>
              {profile?.email ? <Text style={styles.meta}>{profile.email}</Text> : null}
            </View>

            <View style={styles.card}>
              <InfoRow icon="barcode-outline" label="Shop code" value={data.vendor?.code ?? '—'} />
              <InfoRow icon="storefront-outline" label="Shop status" value={data.vendor?.status ?? '—'} />
              <InfoRow icon="shield-checkmark-outline" label="Account" value={data.approvalStatus} />
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={profile?.phone?.trim() || 'Not set'}
                last
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Accepting orders</Text>
              <Text style={styles.bodyMuted}>
                {data.acceptingOrders
                  ? 'Customers can place new orders at your shop.'
                  : 'New orders are paused until you open again.'}
              </Text>
              <Pressable
                onPress={() => toggleOrders.mutate(!data.acceptingOrders)}
                disabled={toggleOrders.isPending || data.approvalStatus !== 'APPROVED'}
                style={[
                  styles.toggleBtn,
                  data.acceptingOrders ? styles.toggleOff : styles.toggleOn,
                  (toggleOrders.isPending || data.approvalStatus !== 'APPROVED') && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    data.acceptingOrders ? styles.toggleTextOff : styles.toggleTextOn,
                  ]}
                >
                  {toggleOrders.isPending
                    ? 'Updating…'
                    : data.acceptingOrders
                      ? 'Close shop'
                      : 'Open shop'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => void session.signOut()} style={styles.signOut}>
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
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
  hero: { alignItems: 'center', paddingVertical: spacing.md },
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
  email: { marginTop: 4, fontSize: 14, fontWeight: '700', color: theme.muted },
  meta: { marginTop: 2, fontSize: 12, color: theme.muted },
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bodyMuted: { marginTop: 6, marginBottom: spacing.md, fontSize: 13, color: theme.muted, lineHeight: 19 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
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
  toggleBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  toggleOn: { backgroundColor: theme.success },
  toggleOff: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleText: { fontWeight: '800', fontSize: 15 },
  toggleTextOn: { color: theme.onPrimary },
  toggleTextOff: { color: theme.text },
  signOut: {
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
