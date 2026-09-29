/** Minimal fields needed to decide compare vs direct add. */
export type VendorPickQuote = {
  vendorId: string;
  finalUnitPrice: number;
};

/**
 * Show compare only when another store beats the reference price.
 * Reference = store user is browsing, or cheapest offer when adding from catalog.
 */
export function resolveVendorPickDecision(input: {
  vendors: VendorPickQuote[];
  contextVendorId?: string;
  cheapestVendorId?: string | null;
}): { showVendorCompare: boolean; autoVendorId: string | null } {
  const { vendors, contextVendorId, cheapestVendorId } = input;
  if (!vendors.length) return { showVendorCompare: false, autoVendorId: null };
  if (vendors.length === 1) {
    return { showVendorCompare: false, autoVendorId: vendors[0]!.vendorId };
  }

  const cheapest =
    vendors.find((v) => v.vendorId === cheapestVendorId) ??
    [...vendors].sort((a, b) => a.finalUnitPrice - b.finalUnitPrice)[0]!;

  const reference =
    (contextVendorId ? vendors.find((v) => v.vendorId === contextVendorId) : undefined) ?? cheapest;

  const hasCheaperElsewhere = vendors.some(
    (v) => v.vendorId !== reference.vendorId && v.finalUnitPrice < reference.finalUnitPrice - 0.001,
  );

  if (!hasCheaperElsewhere) {
    return { showVendorCompare: false, autoVendorId: reference.vendorId };
  }

  return { showVendorCompare: true, autoVendorId: reference.vendorId };
}

/** Compare sheet lists only stores cheaper than the reference (selected) store. */
export function filterCheaperVendorOffers<T extends VendorPickQuote>(
  vendors: T[],
  referenceVendorId: string,
): T[] {
  const reference = vendors.find((v) => v.vendorId === referenceVendorId);
  if (!reference) return [];
  return vendors
    .filter(
      (v) =>
        v.vendorId !== referenceVendorId && v.finalUnitPrice < reference.finalUnitPrice - 0.001,
    )
    .sort((a, b) => a.finalUnitPrice - b.finalUnitPrice);
}
