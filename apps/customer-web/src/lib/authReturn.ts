export function loginPath(returnTo?: string): string {
  if (!returnTo) return '/login';
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function afterAuthNavigate(
  navigate: (path: string) => void,
  needsAddress: boolean,
  returnTo?: string | null,
): void {
  const target = returnTo && returnTo.startsWith('/') ? returnTo : '/profile';
  if (needsAddress) {
    navigate(`/delivery-address?returnTo=${encodeURIComponent(target)}`);
    return;
  }
  navigate(target);
}
