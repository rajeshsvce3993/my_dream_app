import { z } from 'zod';

export const homeVerticalSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.object({ en: z.string().min(1), ta: z.string().optional() }),
  subtitle: z.object({ en: z.string(), ta: z.string().optional() }).optional(),
  icon: z.string().min(1),
  webIcon: z.string().optional(),
  enabled: z.boolean(),
  isPrimary: z.boolean().optional(),
  status: z.enum(['live', 'coming_soon']),
  href: z.string().min(1),
  categorySlug: z.string().optional(),
  sortOrder: z.number().int(),
  tileBg: z.string().optional(),
  iconColor: z.string().optional(),
});

export type HomeVertical = z.infer<typeof homeVerticalSchema>;

export const homeVerticalsSchema = z.array(homeVerticalSchema);

export function parseHomeVerticals(value: unknown): HomeVertical[] {
  const parsed = homeVerticalsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('home.verticals must be an array of vertical objects (id, label, icon, enabled, status, href, sortOrder)');
  }
  return parsed.data;
}
