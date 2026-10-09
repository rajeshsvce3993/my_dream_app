import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { apiRequest, apiRequestWithToken, clearTokens, setTokens } from '../lib/api';
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function revealField() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await clearTokens();
      const data = await apiRequest<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await apiRequestWithToken('/vendor/me', data.tokens.accessToken);
      await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await session.refresh();
      onSignedIn?.();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  const keypadOpen = keyboardHeight > 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingBottom:
            Platform.OS === 'android' && keypadOpen
              ? keyboardHeight + spacing.lg
              : insets.bottom + spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
    >
      {keypadOpen ? (
        <View style={{ height: insets.top + 8 }} />
      ) : (
        <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <View style={styles.mark}>
            <Text style={styles.mono}>DV</Text>
          </View>
          <Text style={styles.brand}>Dream Vendor</Text>
          <Text style={styles.tagline}>Accept orders, set prices, and hand off pickup.</Text>
        </View>
      )}

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Shop sign in</Text>
        <Text style={styles.sheetLead}>Use the login your admin created for this restaurant.</Text>

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
            onFocus={revealField}
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
            onFocus={revealField}
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
            <Text style={styles.ctaText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: 28 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(240,247,250,0.2)',
  },
  mono: { fontSize: 24, fontWeight: '900', color: theme.onHeader, letterSpacing: 1 },
  brand: { fontSize: 28, fontWeight: '900', color: theme.onHeader, letterSpacing: -0.5 },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.onHeaderMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  sheetLead: { marginTop: 6, marginBottom: spacing.lg, fontSize: 14, lineHeight: 20, color: theme.muted },
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
