export type ProductDietType = 'veg' | 'nonveg';
export type VendorDietType = 'veg' | 'nonveg' | 'both';

const NONVEG_HINT =
  /\b(chicken|mutton|fish|egg|eggs|meat|prawn|non[\s-]?veg|keema|shawarma|biryani|bacon|pepperoni)\b/i;

/** Infer product diet from name when dietType is not set. */
export function inferProductDietType(name: string | undefined | null): ProductDietType {
  if (name && NONVEG_HINT.test(name)) return 'nonveg';
  return 'veg';
}

export function resolveProductDietType(input: {
  dietType?: string | null;
  name?: string | null;
}): ProductDietType {
  if (input.dietType === 'veg' || input.dietType === 'nonveg') return input.dietType;
  return inferProductDietType(input.name);
}

/** Vendor matches a customer diet filter. */
export function vendorMatchesDietFilter(
  vendorDiet: VendorDietType | string | undefined | null,
  filter: 'veg' | 'nonveg',
): boolean {
  const d = vendorDiet === 'veg' || vendorDiet === 'nonveg' || vendorDiet === 'both' ? vendorDiet : 'both';
  if (d === 'both') return true;
  return d === filter;
}

/** Product matches a customer diet filter. */
export function productMatchesDietFilter(
  productDiet: ProductDietType | string | undefined | null,
  filter: 'veg' | 'nonveg',
  productName?: string,
): boolean {
  const d = resolveProductDietType({ dietType: productDiet, name: productName });
  return d === filter;
}
