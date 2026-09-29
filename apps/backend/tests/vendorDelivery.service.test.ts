import { describe, expect, it } from 'vitest';
import { isWithinVendorDeliveryRadius } from '../src/modules/vendors/vendorDelivery.service.js';

const vendor = {
  location: { coordinates: [80.27, 13.08] as [number, number] },
  deliveryRadiusKm: 5,
  serviceAreaWideDelivery: false,
};

describe('isWithinVendorDeliveryRadius', () => {
  it('respects delivery radius by default', () => {
    const near = isWithinVendorDeliveryRadius(80.271, 13.081, vendor);
    expect(near.ok).toBe(true);
    const far = isWithinVendorDeliveryRadius(80.5, 13.5, vendor);
    expect(far.ok).toBe(false);
  });

  it('allows any distance when serviceAreaWideDelivery is true', () => {
    const wide = { ...vendor, serviceAreaWideDelivery: true };
    const far = isWithinVendorDeliveryRadius(80.5, 13.5, wide);
    expect(far.ok).toBe(true);
  });
});
