import { randomInt } from 'crypto';

/** Server-side random pick. Callers must pass only eligible people. */
export function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[randomInt(0, items.length)] ?? null;
}

export const OFFER_TTL_MS = Number(process.env.DELIVERY_OFFER_TTL_SECONDS ?? 30) * 1000;

export const READY_FOR_DISPATCH = ['PACKED', 'READY_FOR_PICKUP'] as const;
