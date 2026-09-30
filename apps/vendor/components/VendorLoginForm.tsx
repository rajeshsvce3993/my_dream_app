import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, setTokens } from '../lib/api';
import { useVendorSession } from '../lib/useVendorSession';
import { radius, spacing, theme } from '../lib/theme';

type Props = { onSignedIn?: () => void };

export function VendorLoginForm({ onSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const session = useVendorSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await apiRequest('/vendor/me');
      await session.refresh();
      onSignedIn?.();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.mark}>
              <Ionicons name="storefront" size={28} color={theme.onHeader} />
            </View>
            <Text style={styles.brand}>Dream Vendor</Text>
            <Text style={styles.tagline}>
              Sign in with the staff account created in Admin → Vendor app accounts.
            </Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={theme.muted} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="shop@example.com"
              placeholderTextColor={theme.muted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.muted} />
            <TextInput
              placeholder="Password"
              placeholderTextColor={theme.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.muted} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, (loading || pressed) && { opacity: 0.9 }]}
          >
            {loading ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <>
                <Text style={styles.ctaText}>Sign in</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: { fontSize: 26, fontWeight: '900', color: theme.text, letterSpacing: -0.4 },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: spacing.md,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text, paddingVertical: 12 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.dangerSoft,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.danger },
  cta: {
    marginTop: spacing.md,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: theme.onPrimary, fontWeight: '800', fontSize: 16 },
});
