import { useRef, useEffect } from 'react';
import {
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
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
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const filled = Boolean(digits[i]?.trim());
        const borderColor = error
          ? theme.discount
          : filled
            ? theme.delivery
            : theme.border;
        return (
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
              width: 54,
              height: 58,
              borderWidth: 1.5,
              borderColor,
              borderRadius: radius.md,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: '800',
              color: theme.text,
              backgroundColor: theme.white,
            }}
          />
        );
      })}
    </View>
  );
}
