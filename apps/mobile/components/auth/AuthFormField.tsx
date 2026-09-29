import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme, radius, spacing } from '../../lib/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

export function AuthFormField({ label, error, style, ...rest }: Props) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.muted}
        {...rest}
        style={[
          {
            borderWidth: 1.5,
            borderColor: error ? theme.discount : theme.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 14,
            fontSize: 16,
            color: theme.text,
            backgroundColor: theme.surface,
          },
          style,
        ]}
      />
      {error ? <Text style={{ color: theme.discount, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}
