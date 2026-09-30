import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, setTokens } from '../lib/api';
import { invalidateAuthSession } from '../lib/authSession';
import { afterAuthNavigate } from '../lib/openLogin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, spacing, radius } from '../lib/theme';
import { OtpPinInput } from '../components/auth/OtpPinInput';

type Step = 'phone' | 'otp';

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LoginScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLength, setOtpLength] = useState(4);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return;
    const t = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
      setExpiresIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn, expiresIn]);

  const digits = phoneDigits.replace(/\D/g, '');
  const canContinuePhone = digits.length === 10;

  const sendOtp = useCallback(async () => {
    setMessage(null);
    setPhoneError(null);
    if (digits.length !== 10) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{
        phone: string;
        maskedPhone: string;
        resendInSeconds: number;
        expirySeconds: number;
        otpLength: number;
      }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: digits }),
      });
      setNormalizedPhone(data.phone);
      setMaskedPhone(data.maskedPhone);
      setResendIn(data.resendInSeconds);
      setExpiresIn(data.expirySeconds);
      setOtpLength(data.otpLength);
      setStep('otp');
      setOtp('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send OTP. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [digits, loading]);

  async function verifyOtp() {
    setMessage(null);
    if (expiresIn <= 0) {
      setMessage('OTP expired. Request a new code.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{
        tokens: { accessToken: string; refreshToken: string };
        needsAddress: boolean;
      }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          phone: normalizedPhone,
          otp: otp.trim(),
        }),
      });
      await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await invalidateAuthSession(queryClient);
      afterAuthNavigate(data.needsAddress, typeof returnTo === 'string' ? returnTo : undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setMessage(msg.toLowerCase().includes('invalid') ? 'Incorrect OTP. Try again.' : msg);
    } finally {
      setLoading(false);
    }
  }

  const autoVerifyOtp = useRef('');
  useEffect(() => {
    if (step !== 'otp' || otp.length !== otpLength || loading || expiresIn <= 0) return;
    if (autoVerifyOtp.current === otp) return;
    autoVerifyOtp.current = otp;
    void verifyOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, otpLength, step, expiresIn]);

  const canVerify = otp.length === otpLength;
  const primaryEnabled =
    step === 'phone' ? canContinuePhone && !loading : canVerify && expiresIn > 0 && !loading;

  function goBackToPhone() {
    setStep('phone');
    setOtp('');
    setMessage(null);
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm }]}
        >
          <View style={styles.topActions}>
            <Pressable
              onPress={step === 'phone' ? () => router.back() : goBackToPhone}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={step === 'phone' ? 'Close' : 'Go back'}
            >
              <Ionicons
                name={step === 'phone' ? 'close' : 'arrow-back'}
                size={22}
                color={theme.text}
              />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.mark}>
              <Text style={styles.mono}>DF</Text>
            </View>
            {step === 'phone' ? (
              <>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>
                  Enter your mobile number to sign in and continue ordering.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Enter the code</Text>
                <Text style={styles.subtitle}>
                  Sent to{' '}
                  <Text style={styles.phoneEmphasis}>{maskedPhone || normalizedPhone}</Text>
                </Text>
              </>
            )}
          </View>

          {step === 'phone' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Mobile number</Text>
              <View
                style={[
                  styles.phoneRow,
                  phoneError ? styles.phoneRowError : null,
                ]}
              >
                <View style={styles.ccChip}>
                  <Text style={styles.ccText}>+91</Text>
                </View>
                <TextInput
                  value={formatPhoneDisplay(phoneDigits)}
                  onChangeText={(t) => {
                    setPhoneDigits(t.replace(/\D/g, '').slice(0, 10));
                    setPhoneError(null);
                  }}
                  placeholder="98765 43210"
                  placeholderTextColor={theme.muted}
                  keyboardType="number-pad"
                  maxLength={11}
                  accessibilityLabel="Mobile number"
                  style={styles.phoneInput}
                />
              </View>
              {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

              <Pressable
                onPress={sendOtp}
                disabled={!primaryEnabled}
                style={({ pressed }) => [
                  styles.cta,
                  !primaryEnabled && styles.ctaDisabled,
                  pressed && primaryEnabled && styles.ctaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                {loading ? (
                  <ActivityIndicator color={theme.onHeader} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color={theme.onHeader} />
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <OtpPinInput
                length={otpLength}
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setMessage(null);
                }}
                error={Boolean(message)}
                autoFocus
              />

              <View style={styles.metaRow}>
                <Ionicons
                  name={expiresIn > 0 ? 'time-outline' : 'alert-circle-outline'}
                  size={14}
                  color={expiresIn > 0 ? theme.muted : theme.discount}
                />
                <Text style={[styles.metaText, expiresIn <= 0 && { color: theme.discount }]}>
                  {expiresIn > 0 ? `Expires in ${formatCountdown(expiresIn)}` : 'Code expired'}
                </Text>
              </View>

              <View style={styles.resendBlock}>
                <Text style={styles.resendHint}>Didn&apos;t get the code?</Text>
                <Pressable
                  onPress={sendOtp}
                  disabled={resendIn > 0 || loading}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Resend OTP"
                >
                  <Text style={[styles.resendAction, (resendIn > 0 || loading) && styles.resendDisabled]}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={verifyOtp}
                disabled={!primaryEnabled}
                style={({ pressed }) => [
                  styles.cta,
                  !primaryEnabled && styles.ctaDisabled,
                  pressed && primaryEnabled && styles.ctaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Verify OTP"
              >
                {loading ? (
                  <ActivityIndicator color={theme.onHeader} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Verify</Text>
                    <Ionicons name="checkmark" size={18} color={theme.onHeader} />
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={goBackToPhone}
                style={styles.changeNumber}
                accessibilityRole="button"
                accessibilityLabel="Change mobile number"
              >
                <Ionicons name="create-outline" size={15} color={theme.muted} />
                <Text style={styles.changeNumberText}>Change number</Text>
              </Pressable>
            </View>
          )}

          {message ? (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={16} color={theme.discount} />
              <Text style={styles.errorBannerText}>{message}</Text>
            </View>
          ) : null}

          <SafeAreaView edges={['bottom']} style={styles.legalWrap}>
            <Text style={styles.legal}>
              By continuing, you agree to Dream Food Terms and Privacy Policy.
            </Text>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  topActions: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  mono: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  phoneEmphasis: {
    fontWeight: '800',
    color: theme.text,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingLeft: 6,
    paddingRight: 14,
    minHeight: 54,
  },
  phoneRowError: {
    borderColor: theme.discount,
  },
  ccChip: {
    backgroundColor: theme.primaryMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  ccText: {
    fontWeight: '800',
    fontSize: 14,
    color: theme.primary,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: 0.3,
  },
  fieldError: {
    color: theme.discount,
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  cta: {
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: theme.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaDisabled: {
    backgroundColor: theme.border,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaText: {
    color: theme.onHeader,
    fontWeight: '800',
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
  },
  resendBlock: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 4,
  },
  resendHint: {
    fontSize: 13,
    color: theme.muted,
  },
  resendAction: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.delivery,
  },
  resendDisabled: {
    color: theme.muted,
    fontWeight: '600',
  },
  changeNumber: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  changeNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.muted,
  },
  errorBanner: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8E8E6',
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E8C5C0',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.discount,
    lineHeight: 18,
  },
  legalWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  legal: {
    textAlign: 'center',
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
