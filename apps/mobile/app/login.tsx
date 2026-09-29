import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { theme, spacing, radius } from '../lib/theme';
import { ScreenHeader } from '../components/ScreenHeader';
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <ScreenHeader
        title={step === 'phone' ? 'Sign in' : 'Verify number'}
        layout="centered"
        showBack
        backVariant={step === 'phone' ? 'close' : 'back'}
        onBack={
          step === 'phone'
            ? () => router.back()
            : () => {
                setStep('phone');
                setOtp('');
                setMessage(null);
              }
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
        >
          <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: theme.successSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="leaf" size={32} color={theme.primary} />
            </View>
          </View>

          {step === 'phone' ? (
            <>
              <Text style={{ marginTop: spacing.xl, fontWeight: '800', fontSize: 26, color: theme.text, textAlign: 'center' }}>
                Welcome back 👋
              </Text>
              <Text style={{ marginTop: spacing.sm, color: theme.muted, fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
                Sign in to continue shopping with us.
              </Text>

              <Text style={{ marginTop: spacing.xl, fontSize: 13, fontWeight: '600', color: theme.text }}>Mobile number</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                  borderWidth: 1.5,
                  borderColor: phoneError ? theme.discount : theme.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  backgroundColor: theme.surface,
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 6 }}>🇮🇳</Text>
                <Text style={{ fontWeight: '700', fontSize: 16, color: theme.text, marginRight: 10 }}>+91</Text>
                <TextInput
                  value={formatPhoneDisplay(phoneDigits)}
                  onChangeText={(t) => {
                    setPhoneDigits(t.replace(/\D/g, '').slice(0, 10));
                    setPhoneError(null);
                  }}
                  placeholder="98765 43210"
                  keyboardType="number-pad"
                  maxLength={11}
                  accessibilityLabel="Mobile number"
                  style={{ flex: 1, paddingVertical: 16, fontSize: 17, fontWeight: '600', color: theme.text }}
                />
              </View>
              {phoneError ? <Text style={{ color: theme.discount, marginTop: 6, fontSize: 13 }}>{phoneError}</Text> : null}

              <Pressable
                onPress={sendOtp}
                disabled={!canContinuePhone || loading}
                style={{
                  marginTop: spacing.xl,
                  backgroundColor: canContinuePhone && !loading ? theme.primaryDark : theme.border,
                  paddingVertical: 16,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Continue</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ marginTop: spacing.lg, fontWeight: '800', fontSize: 24, color: theme.text, textAlign: 'center' }}>
                Verify your number
              </Text>
              <Text style={{ marginTop: spacing.sm, color: theme.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                We sent a verification code to{'\n'}
                <Text style={{ fontWeight: '700', color: theme.text }}>{maskedPhone || normalizedPhone}</Text>
              </Text>

              <OtpPinInput
                length={otpLength}
                value={otp}
                onChange={setOtp}
                error={Boolean(message)}
                autoFocus
              />

              <Text style={{ textAlign: 'center', color: theme.muted, marginTop: spacing.lg, fontSize: 13 }}>
                {expiresIn > 0 ? `OTP expires in ${formatCountdown(expiresIn)}` : 'OTP expired'}
              </Text>

              <Text style={{ textAlign: 'center', color: theme.muted, marginTop: spacing.md, fontSize: 14 }}>
                Didn&apos;t receive it?
              </Text>
              <Pressable onPress={sendOtp} disabled={resendIn > 0 || loading} style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: resendIn > 0 ? theme.muted : theme.primary, fontWeight: '700' }}>
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
                </Text>
              </Pressable>

              <Pressable
                onPress={verifyOtp}
                disabled={!canVerify || loading || expiresIn <= 0}
                style={{
                  marginTop: spacing.xl,
                  backgroundColor: canVerify && expiresIn > 0 ? theme.primaryDark : theme.border,
                  paddingVertical: 16,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Verify OTP</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setMessage(null);
                }}
                style={{ marginTop: spacing.lg, alignItems: 'center' }}
              >
                <Text style={{ color: theme.primary, fontWeight: '600' }}>Change mobile number</Text>
              </Pressable>
            </>
          )}

          {message ? (
            <Text style={{ textAlign: 'center', color: theme.discount, marginTop: spacing.md, fontSize: 14 }}>{message}</Text>
          ) : null}

          <Text style={{ textAlign: 'center', color: theme.muted, fontSize: 12, marginTop: 'auto', paddingTop: spacing.xl, lineHeight: 18 }}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
