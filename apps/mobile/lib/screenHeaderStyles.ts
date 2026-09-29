import { theme, spacing } from './theme';

/** Shared screen header typography & chrome — use on every top bar. */
export const screenHeaderStyles = {
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: 'transparent' as const,
  },
  /** Standard inset for ScrollView content directly under a header */
  bodyPadding: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 44,
  },
  backButtonSlot: {
    width: 44,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  sideSlot: {
    flex: 1,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  sideSlotEnd: {
    flex: 1,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  cartSlot: {
    width: 44,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: theme.primaryDark,
    letterSpacing: -0.2,
  },
  titleCenter: {
    flex: 1,
    textAlign: 'center' as const,
  },
  titleLeading: {
    flex: 1,
  },
  backIconSize: 24,
  backIconColor: theme.primaryDark,
  dismissIconSize: 26,
  dismissIconColor: theme.muted,
  cartIconSize: 26,
  cartIconColor: theme.primary,
};
