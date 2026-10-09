import { describe, expect, it } from 'vitest';
import {
  foodGstPercent,
  isFoodCategorySlug,
  parseFoodCharges,
  quoteCustomerFoodDeliveryCharge,
  quoteFoodDeliveryCharge,
  vendorMenuGstPercent,
  type FoodCharges,
} from '../src/modules/pricing/foodCharges.service.js';

const charges: FoodCharges = {
  baseKm: 3,
  baseDeliveryCharge: 30,
  perKmCharge: 10,
  platformFee: 6,
  gstEnabled: true,
  gstPercent: 5,
};

describe('food charges', () => {
  it('treats food catalog slugs as food', () => {
    expect(isFoodCategorySlug('food')).toBe(true);
    expect(isFoodCategorySlug('food-south-indian')).toBe(true);
    expect(isFoodCategorySlug('groceries')).toBe(false);
  });

  it('charges the base amount through the base distance, then each extra kilometre', () => {
    expect(quoteFoodDeliveryCharge(charges, 2.4)).toBe(30);
    expect(quoteFoodDeliveryCharge(charges, 3)).toBe(30);
    expect(quoteFoodDeliveryCharge(charges, 3.1)).toBe(40);
    expect(quoteFoodDeliveryCharge(charges, 5)).toBe(50);
    expect(quoteFoodDeliveryCharge(charges, null)).toBe(30);
    expect(quoteCustomerFoodDeliveryCharge(charges, 2.4)).toBe(36);
    expect(quoteCustomerFoodDeliveryCharge(charges, 5)).toBe(56);
  });

  it('uses each restaurant GST only when that shop turns it on', () => {
    expect(vendorMenuGstPercent({ gstEnabled: true, gstPercent: 5 })).toBe(5);
    expect(vendorMenuGstPercent({ gstEnabled: false, gstPercent: 18 })).toBe(0);
    expect(vendorMenuGstPercent(null)).toBe(0);
    expect(foodGstPercent(charges)).toBe(5);
    expect(foodGstPercent({ ...charges, gstEnabled: false })).toBe(0);
  });

  it('parses the admin form and older flat delivery values', () => {
    expect(
      parseFoodCharges({
        baseKm: '3',
        baseDeliveryCharge: 30,
        perKmCharge: 10,
        platformFee: 6,
        gstEnabled: false,
        gstPercent: 5,
      }),
    ).toEqual({
      baseKm: 3,
      baseDeliveryCharge: 30,
      perKmCharge: 10,
      platformFee: 6,
      gstEnabled: false,
      gstPercent: 5,
    });
    expect(parseFoodCharges({ deliveryCharge: 25, gstEnabled: false, gstPercent: 5 }).baseDeliveryCharge).toBe(
      25,
    );
  });
});
