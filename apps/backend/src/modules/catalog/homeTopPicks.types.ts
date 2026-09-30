import { z } from 'zod';

export const homeTopPickSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.object({ en: z.string().min(1), ta: z.string().optional() }),
  imageUrl: z.string().optional(),
  searchQuery: z.string().min(1),
  diet: z.enum(['veg', 'nonveg', 'both']).optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
});

export type HomeTopPick = z.infer<typeof homeTopPickSchema>;

export const homeTopPicksSchema = z.array(homeTopPickSchema);

export function parseHomeTopPicks(value: unknown): HomeTopPick[] {
  const parsed = homeTopPicksSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      'home.topPicks must be an array of { id, label, searchQuery, enabled, sortOrder }',
    );
  }
  return parsed.data;
}
