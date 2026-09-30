import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { text } from '../lib/locale';
import { theme, spacing, radius } from '../lib/theme';

export type DietFilter = 'all' | 'veg' | 'nonveg';

export type TopPickItem = {
  id: string;
  label: { en: string; ta?: string };
  imageUrl?: string;
  searchQuery: string;
  /** Optional — used by Veg / Non-veg chips */
  diet?: 'veg' | 'nonveg' | 'both';
};

type Props = {
  title?: { en: string; ta?: string };
  picks: TopPickItem[];
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=240&h=240&fit=crop',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=240&h=240&fit=crop',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=240&h=240&fit=crop',
];

/** Known-good sample images when config URLs are missing or broken. */
const SAMPLE_BY_ID: Record<string, string> = {
  dosa: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=240&h=240&fit=crop',
  noodles:
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=240&h=240&fit=crop',
};

const BROKEN_HOST_HINT = /photo-1630383248096|photo-1612929636598|photo-1668236543141/i;

function resolvePickImage(pick: TopPickItem, index: number): string {
  const sample = SAMPLE_BY_ID[pick.id];
  const raw = pick.imageUrl?.trim() ?? '';
  if (sample && (!raw || BROKEN_HOST_HINT.test(raw))) return sample;
  if (raw) return raw;
  if (sample) return sample;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!;
}

const NONVEG_HINT = /\b(chicken|mutton|fish|egg|meat|prawn|non[\s-]?veg|keema|shawarma)\b/i;
const VEG_HINT = /\b(dosa|idli|paneer|veg|vegetarian|pulao|curd)\b/i;

function resolveDiet(pick: TopPickItem): 'veg' | 'nonveg' | 'both' {
  if (pick.diet) return pick.diet;
  const hay = `${pick.label?.en ?? ''} ${pick.searchQuery ?? ''}`;
  if (NONVEG_HINT.test(hay)) return 'nonveg';
  if (VEG_HINT.test(hay)) return 'veg';
  return 'both';
}

function DietChip({
  kind,
  selected,
  onPress,
}: {
  kind: 'veg' | 'nonveg';
  selected: boolean;
  onPress: () => void;
}) {
  const isVeg = kind === 'veg';
  const mark = isVeg ? '#2F7D5C' : '#B83A3A';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.full,
        backgroundColor: selected ? (isVeg ? theme.successSoft : '#F5E0E0') : theme.white,
        borderWidth: 1,
        borderColor: selected ? mark : theme.border,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={isVeg ? 'Veg filter' : 'Non-veg filter'}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          borderWidth: 1.5,
          borderColor: mark,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.white,
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mark }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? mark : theme.text }}>
        {isVeg ? 'Veg' : 'Non-veg'}
      </Text>
    </Pressable>
  );
}

/** Horizontal dish chips + Veg / Non-veg filters on the title row. */
export function HomeTopPicks({ title, picks }: Props) {
  const [diet, setDiet] = useState<DietFilter>('all');

  const filtered = useMemo(() => {
    if (diet === 'all') return picks;
    return picks.filter((p) => {
      const d = resolveDiet(p);
      if (d === diet) return true;
      // Shared dishes (e.g. fried rice) show under either chip
      return d === 'both';
    });
  }, [picks, diet]);

  if (!picks.length) return null;

  function toggle(next: 'veg' | 'nonveg') {
    setDiet((prev) => (prev === next ? 'all' : next));
  }

  function openPick(pick: TopPickItem) {
    const q = pick.searchQuery.trim();
    const title = text(pick.label);
    const pickDiet = resolveDiet(pick);
    const dietParam =
      diet !== 'all' ? diet : pickDiet === 'both' ? undefined : pickDiet;
    router.push({
      pathname: '/(tabs)/search',
      params: {
        mode: 'topPick',
        q,
        title,
        ...(dietParam ? { diet: dietParam } : {}),
      },
    });
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: theme.text,
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {text(title, 'Top picks')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <DietChip kind="veg" selected={diet === 'veg'} onPress={() => toggle('veg')} />
          <DietChip kind="nonveg" selected={diet === 'nonveg'} onPress={() => toggle('nonveg')} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {filtered.length === 0 ? (
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', paddingVertical: 8 }}>
            No {diet === 'veg' ? 'veg' : 'non-veg'} picks here — try the other filter
          </Text>
        ) : (
          filtered.map((pick, i) => {
            const uri = resolvePickImage(pick, i);
            return (
              <Pressable
                key={pick.id}
                onPress={() => openPick(pick)}
                style={{ width: 52, alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={text(pick.label)}
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.white,
                  }}
                />
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: '600',
                    color: theme.text,
                    textAlign: 'center',
                  }}
                >
                  {text(pick.label)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
