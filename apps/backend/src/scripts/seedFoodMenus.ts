import { CategoryModel } from '../modules/categories/category.model.js';
import { InventoryModel } from '../modules/inventory/inventory.model.js';
import { ProductModel } from '../modules/products/product.model.js';
import { ProductVariantModel } from '../modules/products/productVariant.model.js';
import { VendorProductModel } from '../modules/products/vendorProduct.model.js';
import { VendorModel } from '../modules/vendors/vendor.model.js';
import { normalizeSeedPrice } from '../common/money.util.js';
import { syncVariantListPriceFromVendors } from '../modules/products/variantListPrice.service.js';
import { logger } from '../infrastructure/logging/logger.js';

type Dish = {
  sku: string;
  name: { en: string; ta?: string };
  price: number;
  mrp: number;
  imageUrl: string;
  categorySlug: string;
  dietType: 'veg' | 'nonveg';
};

const FOOD_PARENT = {
  slug: 'food',
  name: { en: 'Food', ta: 'உணவு' },
  sortOrder: 10,
};

const FOOD_SUBS = [
  {
    slug: 'food-south-indian',
    name: { en: 'South Indian', ta: 'தென்னிந்திய' },
    sortOrder: 1,
    cuisine: 'south-indian',
  },
  {
    slug: 'food-chinese',
    name: { en: 'Chinese', ta: 'சீன' },
    sortOrder: 2,
    cuisine: 'chinese',
  },
  {
    slug: 'food-fast-food',
    name: { en: 'Fast Food', ta: 'Fast Food' },
    sortOrder: 3,
    cuisine: 'fast-food',
  },
] as const;

const MENUS_BY_CUISINE: Record<string, Dish[]> = {
  'south-indian': [
    {
      sku: 'FOOD-SI-IDLI',
      name: { en: 'Soft Idli (4 pcs)', ta: 'இட்லி' },
      price: 60,
      mrp: 80,
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-DOSA',
      name: { en: 'Ghee Roast Dosa', ta: 'தோசை' },
      price: 90,
      mrp: 120,
      imageUrl: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-MASALA',
      name: { en: 'Masala Dosa', ta: 'மசாலா தோசை' },
      price: 110,
      mrp: 140,
      imageUrl: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-VADA',
      name: { en: 'Medu Vada (2 pcs)', ta: 'வடை' },
      price: 50,
      mrp: 70,
      imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-SAMBAR',
      name: { en: 'Sambar Rice', ta: 'சாம்பார் சாதம்' },
      price: 100,
      mrp: 130,
      imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-PONGAL',
      name: { en: 'Ven Pongal', ta: 'பொங்கல்' },
      price: 80,
      mrp: 100,
      imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880017?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-FILTER',
      name: { en: 'Filter Coffee', ta: 'ஃபில்டர் காபி' },
      price: 40,
      mrp: 50,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-UTTAPAM',
      name: { en: 'Onion Uttapam', ta: 'ஊத்தப்பம்' },
      price: 95,
      mrp: 120,
      imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-SI-CHICKEN-BIRYANI',
      name: { en: 'Chicken Biryani', ta: 'சிக்கன் பிரியாணி' },
      price: 220,
      mrp: 260,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'nonveg',
    },
    {
      sku: 'FOOD-SI-EGG-DOSA',
      name: { en: 'Egg Dosa', ta: 'முட்டை தோசை' },
      price: 100,
      mrp: 130,
      imageUrl: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      categorySlug: 'food-south-indian',
      dietType: 'nonveg',
    },
  ],
  chinese: [
    {
      sku: 'FOOD-CH-NOODLES',
      name: { en: 'Veg Hakka Noodles', ta: 'நூடுல்ஸ்' },
      price: 140,
      mrp: 180,
      imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-FRIEDRICE',
      name: { en: 'Veg Fried Rice', ta: 'ஃப்ரைடு ரைஸ்' },
      price: 130,
      mrp: 160,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-MANCH',
      name: { en: 'Gobi Manchurian', ta: 'கோபி மஞ்சூரியன்' },
      price: 150,
      mrp: 190,
      imageUrl: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-CHILLI',
      name: { en: 'Chilli Paneer', ta: 'சில்லி பன்னீர்' },
      price: 170,
      mrp: 210,
      imageUrl: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-SOUP',
      name: { en: 'Hot & Sour Soup', ta: 'சூப்' },
      price: 90,
      mrp: 110,
      imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-SPRING',
      name: { en: 'Spring Rolls (4 pcs)', ta: 'ஸ்பிரிங் ரோல்' },
      price: 120,
      mrp: 150,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-SCHEZWAN',
      name: { en: 'Schezwan Fried Rice', ta: 'செச்சுவான் ரைஸ்' },
      price: 150,
      mrp: 185,
      imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-CH-CHICKEN-FRIEDRICE',
      name: { en: 'Chicken Fried Rice', ta: 'சிக்கன் ஃப்ரைடு ரைஸ்' },
      price: 170,
      mrp: 210,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'nonveg',
    },
    {
      sku: 'FOOD-CH-CHICKEN-NOODLES',
      name: { en: 'Chicken Hakka Noodles', ta: 'சிக்கன் நூடுல்ஸ்' },
      price: 180,
      mrp: 220,
      imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=400&fit=crop',
      categorySlug: 'food-chinese',
      dietType: 'nonveg',
    },
  ],
  'fast-food': [
    {
      sku: 'FOOD-FF-BURGER',
      name: { en: 'Classic Veg Burger', ta: 'பர்கர்' },
      price: 120,
      mrp: 150,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-CHEESE',
      name: { en: 'Cheese Burst Burger', ta: 'சீஸ் பர்கர்' },
      price: 160,
      mrp: 199,
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-FRIES',
      name: { en: 'Crispy French Fries', ta: 'ஃப்ரைஸ்' },
      price: 80,
      mrp: 100,
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-PIZZA',
      name: { en: 'Margherita Pizza', ta: 'பீட்சா' },
      price: 220,
      mrp: 280,
      imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-WRAP',
      name: { en: 'Paneer Wrap', ta: 'ரேப்' },
      price: 140,
      mrp: 170,
      imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-NUGGETS',
      name: { en: 'Veg Nuggets (6 pcs)', ta: 'நகட்ஸ்' },
      price: 110,
      mrp: 140,
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-SHAKE',
      name: { en: 'Chocolate Milkshake', ta: 'மில்க்ஷேக்' },
      price: 99,
      mrp: 129,
      imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'veg',
    },
    {
      sku: 'FOOD-FF-CHICKEN-BURGER',
      name: { en: 'Chicken Burger', ta: 'சிக்கன் பர்கர்' },
      price: 180,
      mrp: 220,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
      categorySlug: 'food-fast-food',
      dietType: 'nonveg',
    },
  ],
};

/**
 * Demo bootstrap only — inserts sample food dishes into MongoDB for local/dev.
 * Production menus, prices, and discounts must be managed via Admin Web
 * (Products + Vendors → Menu & prices). Mobile always reads from the API/DB.
 */
export async function seedFoodMenus(vendorByCode: Map<string, string>): Promise<void> {
  const parent = await CategoryModel.findOneAndUpdate(
    { slug: FOOD_PARENT.slug },
    {
      slug: FOOD_PARENT.slug,
      name: FOOD_PARENT.name,
      parentId: null,
      sortOrder: FOOD_PARENT.sortOrder,
      isActive: true,
      isFeatured: true,
    },
    { upsert: true, new: true },
  );

  const categoryBySlug = new Map<string, string>();
  categoryBySlug.set(FOOD_PARENT.slug, parent._id.toString());

  for (const sub of FOOD_SUBS) {
    const doc = await CategoryModel.findOneAndUpdate(
      { slug: sub.slug },
      {
        slug: sub.slug,
        name: sub.name,
        parentId: parent._id,
        sortOrder: sub.sortOrder,
        isActive: true,
        isFeatured: false,
      },
      { upsert: true, new: true },
    );
    categoryBySlug.set(sub.slug, doc._id.toString());
  }

  const dishVariantIds = new Map<string, { productId: string; variantId: string; dish: Dish }>();

  for (const dishes of Object.values(MENUS_BY_CUISINE)) {
    for (const dish of dishes) {
      const categoryId = categoryBySlug.get(dish.categorySlug);
      if (!categoryId) continue;

      const product = await ProductModel.findOneAndUpdate(
        { sku: dish.sku },
        {
          sku: dish.sku,
          slug: dish.sku.toLowerCase().replace(/_/g, '-'),
          name: dish.name,
          description: { en: `${dish.name.en} — restaurant special` },
          categoryId,
          brand: 'Dream Kitchen',
          status: 'ACTIVE',
          images: [{ url: dish.imageUrl, isPrimary: true, sortOrder: 0 }],
          searchKeywords: [dish.name.en, dish.name.ta, dish.categorySlug, dish.dietType].filter(
            Boolean,
          ) as string[],
          dietType: dish.dietType,
        },
        { upsert: true, new: true },
      );

      const variantSku = `${dish.sku}-V1`;
      const variant = await ProductVariantModel.findOneAndUpdate(
        { sku: variantSku },
        {
          productId: product._id,
          sku: variantSku,
          name: { en: '1 serving' },
          status: 'ACTIVE',
          sortOrder: 1,
          listPrice: normalizeSeedPrice(dish.mrp),
        },
        { upsert: true, new: true },
      );

      dishVariantIds.set(dish.sku, {
        productId: product._id.toString(),
        variantId: variant._id.toString(),
        dish,
      });
    }
  }

  let restaurantsUpdated = 0;

  for (const [code, vendorId] of vendorByCode) {
    const vendor = await VendorModel.findById(vendorId).lean();
    if (!vendor) continue;
    const tags = (Array.isArray(vendor.cuisineTags) ? vendor.cuisineTags : []).map((t) =>
      String(t).toLowerCase(),
    );
    if (!tags.length) continue;

    // Replace grocery / demo listings with this restaurant's food menu
    await VendorProductModel.updateMany({ vendorId }, { isActive: false });

    const dishes: Dish[] = [];
    for (const tag of tags) {
      const menu = MENUS_BY_CUISINE[tag];
      if (menu) dishes.push(...menu);
    }
    // De-dupe by sku (multi-cuisine restaurants)
    const unique = [...new Map(dishes.map((d) => [d.sku, d])).values()];
    if (!unique.length) continue;

    // Slight price shift per store so menus feel restaurant-specific
    const priceShift = (code.charCodeAt(0) % 5) * 5;

    for (const dish of unique) {
      const mapped = dishVariantIds.get(dish.sku);
      if (!mapped) continue;

      const selling = normalizeSeedPrice(dish.price + priceShift);
      const mrp = normalizeSeedPrice(dish.mrp + priceShift);
      const vendorPrice = normalizeSeedPrice(Math.max(selling - 10, dish.price - 15));

      await VendorProductModel.updateOne(
        { vendorId, variantId: mapped.variantId },
        {
          vendorId,
          productId: mapped.productId,
          variantId: mapped.variantId,
          vendorPrice,
          mrp,
          sellingPrice: selling,
          isActive: true,
          preparationMinutes: 20 + (priceShift % 15),
        },
        { upsert: true },
      );

      await InventoryModel.updateOne(
        { vendorId, variantId: mapped.variantId },
        {
          vendorId,
          variantId: mapped.variantId,
          available: 80,
          reserved: 0,
          sold: 5 + (priceShift % 20),
          lowStockThreshold: 10,
        },
        { upsert: true },
      );

      await syncVariantListPriceFromVendors(mapped.variantId);
    }

    const hasVeg = unique.some((d) => d.dietType === 'veg');
    const hasNonVeg = unique.some((d) => d.dietType === 'nonveg');
    const dietType = hasVeg && hasNonVeg ? 'both' : hasNonVeg ? 'nonveg' : 'veg';
    await VendorModel.updateOne({ _id: vendorId }, { $set: { dietType } });

    restaurantsUpdated += 1;
    logger.info(
      { code, name: vendor.name, dishes: unique.length, cuisineTags: tags, dietType },
      'Restaurant food menu seeded',
    );
  }

  logger.info({ restaurantsUpdated }, 'Food menus seeded for restaurants');
}
