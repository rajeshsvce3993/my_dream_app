export function normalizeRouteId(id: string | string[] | undefined): string | undefined {
  if (id == null) return undefined;
  const raw = Array.isArray(id) ? id[0] : id;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function categoryIdFromDoc(doc: { _id?: string | { toString(): string } }): string {
  if (!doc._id) return '';
  return typeof doc._id === 'string' ? doc._id : doc._id.toString();
}
