import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { usePublicConfig } from '../lib/usePublicConfig';
import { useAuthSession } from '../lib/useAuthSession';
import { openLogin } from '../lib/openLogin';
import { theme, spacing, radius } from '../lib/theme';
import { formatMoney } from '../lib/format';

type WalletConfig = {
  balance?: number;
  currencySymbol?: string;
  subtitle?: { en: string };
};

const ACTIONS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
}> = [
  { icon: 'add-circle-outline', label: 'Add money', hint: 'Coming soon' },
  { icon: 'arrow-down-circle-outline', label: 'Withdraw', hint: 'Coming soon' },
  { icon: 'receipt-outline', label: 'Transactions', hint: 'Coming soon' },
];

export default function WalletScreen() {
  const config = usePublicConfig();
  const auth = useAuthSession();
  const wallet = (config.data?.['mobile.wallet'] as WalletConfig | undefined) ?? {};
  const symbol = wallet.currencySymbol ?? ((config.data?.['currency.symbol'] as string) ?? '₹');
  const balance = typeof wallet.balance === 'number' ? wallet.balance : 0;

  if (auth.hasToken === false) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Wallet" showBack layout="centered" />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.white,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Ionicons name="wallet-outline" size={28} color={theme.muted} />
          </View>
          <Text style={{ fontWeight: '800', fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>
            Sign in to view wallet
          </Text>
          <Text
            style={{
              color: theme.muted,
              textAlign: 'center',
              marginTop: 6,
              fontSize: 13,
              lineHeight: 19,
              maxWidth: 260,
            }}
          >
            Your balance and transactions will show up here after you sign in.
          </Text>
          <Pressable
            onPress={() => openLogin('/wallet')}
            style={{
              marginTop: spacing.xl,
              backgroundColor: theme.bannerBg,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ color: theme.white, fontWeight: '700', fontSize: 13 }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Wallet" showBack showCart layout="centered" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            backgroundColor: theme.bannerBg,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 16,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
            AVAILABLE BALANCE
          </Text>
          <Text
            style={{
              color: theme.white,
              fontSize: 28,
              fontWeight: '800',
              marginTop: 6,
              letterSpacing: -0.4,
            }}
          >
            {formatMoney(symbol, balance)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 8, lineHeight: 17 }}>
            {wallet.subtitle?.en ?? 'Use wallet balance at checkout when available'}
          </Text>
        </View>

        <SectionLabel>Quick actions</SectionLabel>
        <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          {ACTIONS.map((item, index) => (
            <View
              key={item.label}
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.text }}>{item.label}</Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{item.hint}</Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radius.full,
                  backgroundColor: theme.neutralSoft,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>Soon</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons name="information-circle-outline" size={16} color={theme.muted} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: theme.muted, lineHeight: 17 }}>
              Wallet top-ups and withdrawals will be available in a future update. You can still pay with
              UPI, card, or cash on delivery.
            </Text>
          </View>
        </View>
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
        marginTop: 4,
        marginBottom: 2,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
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
