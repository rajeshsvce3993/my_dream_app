import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { text } from '../lib/locale';
import { openConfiguredPath } from '../lib/mobileNavigation';
import { useAppLocation } from '../lib/usePublicConfig';
import { theme, spacing } from '../lib/theme';

export type HomeVertical = {
  id: string;
  label: { en: string; ta?: string };
  icon: string;
  status: 'live' | 'coming_soon';
  resolvedHref: string;
  mobileHref: string;
  tileBg?: string;
  iconColor?: string;
};

type Props = {
  verticals: HomeVertical[];
};

const DEFAULT_TILE: Record<string, { tileBg: string; iconColor: string }> = {
  food: { tileBg: '#FEE2E2', iconColor: '#DC2626' },
  groceries: { tileBg: '#D1FAE5', iconColor: '#059669' },
  grocery: { tileBg: '#D1FAE5', iconColor: '#059669' },
  gifts: { tileBg: '#FFEDD5', iconColor: '#EA580C' },
  toys: { tileBg: '#DBEAFE', iconColor: '#2563EB' },
  'toys-gifts': { tileBg: '#FFEDD5', iconColor: '#EA580C' },
  fashion: { tileBg: '#EDE9FE', iconColor: '#7C3AED' },
  electronics: { tileBg: '#E0E7FF', iconColor: '#4F46E5' },
  'home-living': { tileBg: '#FCE7F3', iconColor: '#DB2777' },
  more: { tileBg: '#F3F4F6', iconColor: '#6B7280' },
};

function ionName(raw: string): keyof typeof Ionicons.glyphMap {
  const name = raw.trim() as keyof typeof Ionicons.glyphMap;
  if (name in Ionicons.glyphMap) return name;
  return 'ellipse-outline';
}

function tileStyle(v: HomeVertical) {
  const preset = DEFAULT_TILE[v.id];
  return {
    tileBg: v.tileBg ?? preset?.tileBg ?? '#F1F5F9',
    iconColor: v.iconColor ?? preset?.iconColor ?? theme.primary,
  };
}

export function HomeVerticalShortcuts({ verticals }: Props) {
  const location = useAppLocation();
  if (!verticals.length) return null;

  const cols = 4;
  const rows: HomeVertical[][] = [];
  for (let i = 0; i < verticals.length; i += cols) {
    rows.push(verticals.slice(i, i + cols));
  }

  function onPress(v: HomeVertical) {
    if (v.id === 'more') {
      router.push('/(tabs)/categories');
      return;
    }
    if (v.status === 'coming_soon') {
      Alert.alert(
        text(v.label),
        text(
          {
            en: 'Coming soon! Food and grocery are available now.',
            ta: 'விரைவில்! உணவு மற்றும் மளிகை இப்போது கிடைக்கின்றன.',
          },
          'Coming soon! Food and grocery are available now.',
        ),
      );
      return;
    }
    openConfiguredPath(v.mobileHref || v.resolvedHref, { location });
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md }}>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: rowIdx < rows.length - 1 ? spacing.md : 0,
          }}
        >
          {row.map((v) => {
            const { tileBg, iconColor } = tileStyle(v);
            const label = text(v.label);
            return (
              <Pressable
                key={v.id}
                onPress={() => onPress(v)}
                style={{ width: '23%', alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: tileBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={ionName(v.icon)} size={26} color={iconColor} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: '600',
                    color: theme.text,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {row.length < cols
            ? Array.from({ length: cols - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={{ width: '23%' }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}
