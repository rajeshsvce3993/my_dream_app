export type LocalizedText = { en: string; ta?: string };

export function text(value: LocalizedText | string | undefined, fallback = ''): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.en ?? fallback;
}
