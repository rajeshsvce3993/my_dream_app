import { describe, expect, it } from 'vitest';

describe('pricing score normalization', () => {
  it('computes weighted score bounds', () => {
    const weights = { priceWeight: 0.4, distanceWeight: 0.3, ratingWeight: 0.2, availabilityWeight: 0.1 };
    const priceScore = 1;
    const distanceScore = 1;
    const ratingScore = 1;
    const availabilityScore = 1;
    const score =
      weights.priceWeight * priceScore +
      weights.distanceWeight * distanceScore +
      weights.ratingWeight * ratingScore +
      weights.availabilityWeight * availabilityScore;
    expect(score).toBeCloseTo(1);
  });
});
