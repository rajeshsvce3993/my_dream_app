import { describe, expect, it } from 'vitest';
import {
  filterCheaperVendorOffers,
  resolveVendorPickDecision,
} from '../src/modules/catalog/addToCartVendorPick.util.js';

describe('resolveVendorPickDecision', () => {
  const vendors = [
    { vendorId: 'cheap', finalUnitPrice: 90 },
    { vendorId: 'mid', finalUnitPrice: 100 },
    { vendorId: 'high', finalUnitPrice: 110 },
  ];

  it('direct add when browsing the cheapest store', () => {
    const r = resolveVendorPickDecision({ vendors, contextVendorId: 'cheap', cheapestVendorId: 'cheap' });
    expect(r.showVendorCompare).toBe(false);
    expect(r.autoVendorId).toBe('cheap');
  });

  it('shows compare when browsing a store with a cheaper alternative', () => {
    const r = resolveVendorPickDecision({ vendors, contextVendorId: 'high', cheapestVendorId: 'cheap' });
    expect(r.showVendorCompare).toBe(true);
    expect(r.autoVendorId).toBe('high');
  });

  it('direct add from catalog when cheapest is already best', () => {
    const r = resolveVendorPickDecision({ vendors, cheapestVendorId: 'cheap' });
    expect(r.showVendorCompare).toBe(false);
    expect(r.autoVendorId).toBe('cheap');
  });

  it('compare list includes only stores cheaper than reference', () => {
    const cheaper = filterCheaperVendorOffers(vendors, 'high');
    expect(cheaper.map((v) => v.vendorId)).toEqual(['cheap', 'mid']);
  });
});
