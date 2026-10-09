import { describe, expect, it } from 'vitest';
import { dishMatchesTopPick } from '../src/modules/catalog/topPickAvailability.service.js';

const dosa = {
  name: { en: 'Ghee Roast Dosa' },
  dietType: 'veg',
  vendorDiet: 'both',
  searchKeywords: ['breakfast'],
};

describe('top pick dish match', () => {
  it('matches a dish sold by a restaurant when every search word is in the name', () => {
    expect(dishMatchesTopPick({ searchQuery: 'dosa', diet: 'veg' }, dosa)).toBe(true);
    expect(dishMatchesTopPick({ searchQuery: 'ghee dosa', diet: 'veg' }, dosa)).toBe(true);
  });

  it('rejects a dish the search or diet does not match', () => {
    expect(dishMatchesTopPick({ searchQuery: 'pizza', diet: 'veg' }, dosa)).toBe(false);
    expect(dishMatchesTopPick({ searchQuery: 'dosa', diet: 'nonveg' }, dosa)).toBe(false);
    expect(dishMatchesTopPick({ searchQuery: 'd', diet: 'veg' }, dosa)).toBe(false);
  });

  it('rejects a matching dish when the restaurant does not serve that diet', () => {
    expect(
      dishMatchesTopPick({ searchQuery: 'dosa', diet: 'veg' }, { ...dosa, vendorDiet: 'nonveg' }),
    ).toBe(false);
  });
});
