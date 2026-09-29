import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenHeaderStyles as h } from '../lib/screenHeaderStyles';
import { spacing } from '../lib/theme';
import { HeaderCartButton } from './HeaderCartButton';

type Props = {
  title: string;
  /** Tab-style: title left, cart right. Stack-style: back + centered title. */
  layout?: 'leading' | 'centered';
  showBack?: boolean;
  /** Close (×) for modal-style screens; default is arrow back. */
  backVariant?: 'back' | 'close';
  showCart?: boolean;
  right?: ReactNode;
  onBack?: () => void;
};

export function ScreenHeader({
  title,
  layout = 'leading',
  showBack = false,
  backVariant = 'back',
  showCart = false,
  right,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const back = () => (onBack ? onBack() : router.back());

  function BackButton() {
    if (!showBack) return null;
    if (backVariant === 'close') {
      return (
        <Pressable onPress={back} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={h.dismissIconSize} color={h.dismissIconColor} />
        </Pressable>
      );
    }
    return (
      <Pressable onPress={back} hitSlop={12} accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={h.backIconSize} color={h.backIconColor} />
      </Pressable>
    );
  }

  function Trailing() {
    if (right) return <>{right}</>;
    if (showCart) return <HeaderCartButton />;
    return null;
  }

  const hasTrailing = Boolean(right || showCart);

  const containerStyle = [h.container, { paddingTop: insets.top + spacing.xs }];

  if (layout === 'centered' || showBack) {
    return (
      <View style={containerStyle}>
        <View style={h.row}>
          <View style={h.backButtonSlot}>
            <BackButton />
          </View>
          <Text style={[h.title, h.titleCenter]} numberOfLines={1}>
            {title}
          </Text>
          <View style={h.cartSlot}>{hasTrailing ? <Trailing /> : null}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={[h.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[h.title, h.titleLeading, { paddingRight: spacing.sm }]} numberOfLines={1}>
          {title}
        </Text>
        {hasTrailing ? (
          <View style={h.cartSlot}>
            <Trailing />
          </View>
        ) : null}
      </View>
    </View>
  );
}
