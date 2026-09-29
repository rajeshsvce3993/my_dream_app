import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, setTokens } from '../lib/api';
import { radius, spacing, theme } from '../lib/theme';

type Props = { onSignedIn?: () => void };

export function VendorLoginForm({ onSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await apiRequest('/vendor/me');
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + spacing.xl, padding: spacing.xl }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: theme.primaryDark }}>Dream Vendor</Text>
      <Text style={{ color: theme.muted, marginTop: spacing.sm, marginBottom: spacing.xl }}>
        Sign in with the account created in Admin → Vendor app accounts.
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={input}
      />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={input} />
      {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={loading}
        style={{ backgroundColor: theme.primary, padding: 16, borderRadius: radius.md, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

const input = {
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: radius.md,
  padding: spacing.md,
  marginBottom: spacing.md,
};
