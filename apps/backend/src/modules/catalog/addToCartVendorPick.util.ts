/** Minimal fields needed to decide compare vs direct add. */
export type VendorPickQuote = {
  vendorId: string;
  finalUnitPrice: number;
};

export type VendorPickDecision = {
  showVendorCompare: boolean;
  autoVendorId: string | null;
  /**
   * - `cheaper`: browsing a restaurant; other stores are cheaper
   * - `choose`: search / top picks; multiple restaurants sell this dish
   * - `none`: add directly with autoVendorId
   */
  mode: 'none' | 'cheaper' | 'choose';
};

/**
 * Decide whether to auto-add or show a restaurant picker.
 * - In a restaurant menu: only prompt if another store is cheaper.
 * - From search / top picks: prompt when 2+ restaurants offer the dish.
 */
export function resolveVendorPickDecision(input: {
  vendors: VendorPickQuote[];
  contextVendorId?: string;
  cheapestVendorId?: string | null;
}): VendorPickDecision {
  const { vendors, contextVendorId, cheapestVendorId } = input;
  if (!vendors.length) return { showVendorCompare: false, autoVendorId: null, mode: 'none' };
  if (vendors.length === 1) {
    return { showVendorCompare: false, autoVendorId: vendors[0]!.vendorId, mode: 'none' };
  }

  const cheapest =
    vendors.find((v) => v.vendorId === cheapestVendorId) ??
    [...vendors].sort((a, b) => a.finalUnitPrice - b.finalUnitPrice)[0]!;

  // Top picks / search / home: customer chooses which restaurant
  if (!contextVendorId) {
    return {
      showVendorCompare: true,
      autoVendorId: cheapest.vendorId,
      mode: 'choose',
    };
  }

  const reference = vendors.find((v) => v.vendorId === contextVendorId) ?? cheapest;

  const hasCheaperElsewhere = vendors.some(
    (v) => v.vendorId !== reference.vendorId && v.finalUnitPrice < reference.finalUnitPrice - 0.001,
  );

  if (!hasCheaperElsewhere) {
    return { showVendorCompare: false, autoVendorId: reference.vendorId, mode: 'none' };
  }

  return { showVendorCompare: true, autoVendorId: reference.vendorId, mode: 'cheaper' };
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
