import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLocation, usePublicConfig } from '../lib/usePublicConfig';
import { useAuthSession } from '../lib/useAuthSession';
import { text } from '../lib/locale';
import { screenHeaderStyles as h } from '../lib/screenHeaderStyles';
import { theme, spacing, radius } from '../lib/theme';
import { HeaderCartButton } from './HeaderCartButton';

export type HeaderSearchProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
};

type Props = {
  title?: string;
  showLocation?: boolean;
  showBack?: boolean;
  search?: HeaderSearchProps;
  greeting?: boolean;
  /** @deprecated — headers are always transparent */
  transparent?: boolean;
};

export function AppHeader({
  title,
  showLocation = true,
  showBack,
  search,
  greeting,
}: Props) {
  const insets = useSafeAreaInsets();
  const location = useAppLocation();
  const config = usePublicConfig();
  const auth = useAuthSession();
  const guestSubtext = text(
    config.data?.['mobile.home.greetingSubtextGuest'] as { en: string } | undefined,
    'Sign in for faster checkout and order tracking',
  );
  const signedInSubtext = text(
    config.data?.['mobile.home.greetingSubtextSignedIn'] as { en: string } | undefined,
    text(
      config.data?.['home.greetingTemplate'] as { en: string } | undefined,
      'What do you need today?',
    ),
  );

  const searchInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!search?.autoFocus) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [search?.autoFocus]);

  return (
    <View style={[h.container, { paddingTop: insets.top + spacing.xs }]}>
      {search ? (
        <View style={[h.row, { gap: spacing.sm }]}>
          {showBack ? (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={h.backIconSize} color={h.backIconColor} />
            </Pressable>
          ) : showLocation ? (
            <Pressable
              onPress={() => router.push('/(tabs)/account')}
              style={{ maxWidth: 88 }}
              hitSlop={8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-sharp" size={16} color={theme.primary} />
                <Text numberOfLines={1} style={{ fontWeight: '700', color: h.backIconColor, fontSize: 11 }}>
                  {location.label}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: radius.full,
              paddingHorizontal: 12,
              height: 40,
            }}
          >
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              ref={searchInputRef}
              value={search.value}
              onChangeText={search.onChangeText}
              onSubmitEditing={() => search.onSubmit?.()}
              placeholder={search.placeholder}
              placeholderTextColor={theme.muted}
              returnKeyType="search"
              style={{
                flex: 1,
                fontSize: 14,
                color: theme.text,
                paddingVertical: 0,
                margin: 0,
                ...(Platform.OS === 'android'
                  ? { includeFontPadding: false, textAlignVertical: 'center', height: 40 }
                  : { lineHeight: 18, paddingTop: 0, paddingBottom: 0 }),
              }}
              accessibilityLabel="Search all products"
            />
            {search.value.length > 0 ? (
              <Pressable onPress={search.onClear} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={h.cartSlot}>
            <HeaderCartButton />
          </View>
        </View>
      ) : (
        <>
          <View
            style={[
              h.row,
              {
                justifyContent: 'space-between',
                alignItems: greeting ? 'flex-start' : 'center',
              },
            ]}
          >
            {showBack ? (
              <Pressable onPress={() => router.back()} hitSlop={12} style={h.backButtonSlot}>
                <Ionicons name="arrow-back" size={h.backIconSize} color={h.backIconColor} />
              </Pressable>
            ) : greeting ? (
              <Pressable
                style={{ flex: 1, paddingRight: spacing.sm, minHeight: 44, justifyContent: 'center' }}
                onPress={() => {
                  if (!auth.signedIn) router.push('/login');
                  else router.push('/(tabs)/account');
                }}
              >
                <Text style={h.title}>Welcome, {auth.greetingName}</Text>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
                  {auth.signedIn ? signedInSubtext : guestSubtext}
                </Text>
              </Pressable>
            ) : showLocation ? (
              <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/account')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="location-sharp" size={18} color={theme.primary} />
                  <View>
                    <Text style={[h.title, { fontSize: 15 }]}>Delivery to Home</Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>{location.label}</Text>
                  </View>
                </View>
              </Pressable>
            ) : title ? (
              <Text style={[h.title, h.titleLeading]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            <View style={[h.cartSlot, greeting ? { paddingTop: 2 } : undefined]}>
              <HeaderCartButton />
            </View>
          </View>
          {title && showLocation ? (
            <Text style={[h.title, { marginTop: spacing.sm }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
