import { useRef, useEffect } from 'react';
import { Pressable, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { theme, radius, spacing } from '../../lib/theme';

type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
};

export function OtpPinInput({ length, value, onChange, error, autoFocus }: Props) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) {
      refs.current[0]?.focus();
    }
  }, [autoFocus]);

  function updateAt(index: number, char: string) {
    const clean = char.replace(/\D/g, '');
    const arr = value.split('');
    if (clean.length > 1) {
      const pasted = clean.slice(0, length);
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
      return;
    }
    arr[index] = clean;
    const next = arr.join('').slice(0, length);
    onChange(next.replace(/\s/g, ''));
    if (clean && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onKeyPress(index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl }}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          value={digits[i]?.trim() ? digits[i] : ''}
          onChangeText={(t) => updateAt(i, t)}
          onKeyPress={(e) => onKeyPress(i, e)}
          keyboardType="number-pad"
          maxLength={length}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          selectTextOnFocus
          accessibilityLabel={`OTP digit ${i + 1}`}
          style={{
            width: 52,
            height: 56,
            borderWidth: 2,
            borderColor: error ? theme.discount : value.length === length ? theme.primary : theme.border,
            borderRadius: radius.md,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: '800',
            color: theme.text,
            backgroundColor: theme.surface,
          }}
        />
      ))}
    </View>
  );
}

/** Hidden input for full OTP paste on Android */
export function OtpHiddenCapture({
  onPaste,
  length,
}: {
  onPaste: (otp: string) => void;
  length: number;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Paste OTP">
      <TextInput
        style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, length);
          if (d.length >= length) onPaste(d);
        }}
      />
    </Pressable>
  );
}
