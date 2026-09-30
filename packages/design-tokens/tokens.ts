/** Dream Food — Harbor Night + warm parchment (shared). */
export const brandColors = {
  primary: '#163447',
  secondary: '#0F2430',
  accent: '#3E8A9A',
  bg: '#FCFAF7',
  headerBg: '#0F2430',
  footerBg: '#E8E0D6',
  surface: '#EAE3DA',
} as const;

export type HomeSectionType =
  | 'delivery_promise'
  | 'hero_banner'
  | 'category_shortcuts'
  | 'product_row'
  | 'vendor_row'
  | 'promo_strip'
  | 'value_props'
  | 'top_picks';
