import { z } from 'zod';

export const localizedStringSchema = z.object({
  en: z.string().min(1),
  ta: z.string().optional(),
});

export type LocalizedString = z.infer<typeof localizedStringSchema>;

export function getLocalized(value: LocalizedString | undefined, locale: 'en' | 'ta'): string {
  if (!value) return '';
  if (locale === 'ta' && value.ta) return value.ta;
  return value.en;
}
