import { spacing } from './theme';

/** Two-column product grid width + gap (aligned rows, no trailing hole from space-between). */
export function productGridMetrics(screenWidth: number) {
  const gap = spacing.sm;
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - gap) / 2);
  return { gap, cardWidth };
}
