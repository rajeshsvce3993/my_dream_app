import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openLogin } from '../lib/openLogin';
import { useAuthSession } from '../lib/useAuthSession';
import { screenHeaderStyles } from '../lib/screenHeaderStyles';

const WALLET_RETURN = '/wallet';

export function HeaderWalletButton() {
  const { hasToken } = useAuthSession();

  function onPress() {
    if (hasToken === false) {
      openLogin(WALLET_RETURN);
      return;
    }
    router.push('/wallet');
  }

  return (
    <Pressable hitSlop={8} style={{ padding: 4 }} onPress={onPress} accessibilityLabel="Open wallet">
      <Ionicons
        name="wallet-outline"
        size={screenHeaderStyles.cartIconSize}
        color={screenHeaderStyles.cartIconColor}
      />
    </Pressable>
  );
}
