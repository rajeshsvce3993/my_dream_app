/** FreshMart brand colors — shared across web apps. */
export const brandColors = {
  primary: '#0A7A52',
  secondary: '#0F172A',
  accent: '#FF5C35',
} as const;

export type HomeSectionType =
  | 'delivery_promise'
  | 'hero_banner'
  | 'category_shortcuts'
  | 'product_row'
  | 'vendor_row'
  | 'promo_strip'
  | 'value_props';
