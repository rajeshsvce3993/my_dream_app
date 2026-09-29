import { Ionicons } from '@expo/vector-icons';

export type CategoryDoc = {
  _id: string;
  slug: string;
  name: { en: string; ta?: string };
  parentId?: string | null;
};

const ionNames = new Set<string>([
  'water-outline',
  'cafe-outline',
  'nutrition-outline',
  'leaf-outline',
  'basket-outline',
  'fast-food-outline',
  'wine-outline',
  'grid-outline',
  'gift-outline',
  'restaurant-outline',
  'cart-outline',
]);

export function categoryIcon(slug: string, icons: Record<string, string>): keyof typeof Ionicons.glyphMap {
  const name = icons[slug] ?? 'grid-outline';
  return (ionNames.has(name) ? name : 'leaf-outline') as keyof typeof Ionicons.glyphMap;
}

export function chipLabel(slug: string, name: string, labels: Record<string, string>): string {
  if (labels[slug]) return labels[slug];
  return name.split(' ')[0] ?? name;
}

export function parentIdFromDoc(doc: CategoryDoc | undefined): string {
  if (!doc?.parentId) return '';
  return typeof doc.parentId === 'string' ? doc.parentId : String(doc.parentId);
}
