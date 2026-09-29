import { CategoryModel } from '../modules/categories/category.model.js';
import { InventoryModel } from '../modules/inventory/inventory.model.js';
import { ProductModel } from '../modules/products/product.model.js';
import { ProductVariantModel } from '../modules/products/productVariant.model.js';
import { VendorProductModel } from '../modules/products/vendorProduct.model.js';
import { normalizeSeedPrice } from '../common/money.util.js';
import { syncVariantListPriceFromVendors } from '../modules/products/variantListPrice.service.js';

type Localized = { en: string; ta?: string };

type SubSeed = { slug: string; name: Localized; sortOrder: number; productNames: string[] };
type ParentSeed = { slug: string; name: Localized; sortOrder: number; children: SubSeed[] };

/** Parent → subcategories with sample product titles (8 per sub). */
export const CATEGORY_HIERARCHY: ParentSeed[] = [
  {
    slug: 'groceries',
    name: { en: 'Groceries', ta: 'மளிகை' },
    sortOrder: 1,
    children: [
      {
        slug: 'groceries-rice-pulses',
        name: { en: 'Rice & Pulses', ta: 'அரிசி & பருப்பு' },
        sortOrder: 1,
        productNames: ['Sona Masoori Rice 5kg', 'Basmati Rice 1kg', 'Toor Dal 1kg', 'Moong Dal 500g', 'Chana Dal 1kg', 'Urad Dal 500g', 'Poha 500g', 'Rava 1kg'],
      },
      {
        slug: 'groceries-oil-spices',
        name: { en: 'Oil & Spices', ta: 'எண்ணெய் & masala' },
        sortOrder: 2,
        productNames: ['Sunflower Oil 1L', 'Groundnut Oil 1L', 'Turmeric Powder 200g', 'Red Chilli Powder 100g', 'Coriander Powder 200g', 'Garam Masala 100g', 'Mustard Seeds 100g', 'Cumin Seeds 100g'],
      },
      {
        slug: 'groceries-staples',
        name: { en: 'Staples', ta: 'அத்தியாவசியம்' },
        sortOrder: 3,
        productNames: ['Wheat Flour 5kg', 'Sugar 1kg', 'Salt 1kg', 'Jaggery 500g', 'Semiya 400g', 'Vermicelli 400g', 'Sooji 500g', 'Besan 500g'],
      },
      {
        slug: 'groceries-snacks-packaged',
        name: { en: 'Packaged Snacks', ta: 'பேக் snacks' },
        sortOrder: 4,
        productNames: ['Potato Chips 50g', 'Namkeen Mix 200g', 'Murukku 150g', 'Biscuit Pack 6pcs', 'Popcorn Kernels 200g', 'Instant Noodles 4pk', 'Peanuts Roasted 200g', 'Trail Mix 150g'],
      },
      {
        slug: 'groceries-beverages',
        name: { en: 'Beverages', ta: 'பானங்கள்' },
        sortOrder: 5,
        productNames: ['Mineral Water 1L', 'Orange Juice 1L', 'Soft Drink 750ml', 'Green Tea 25 bags', 'Coffee Powder 200g', 'Mango Drink 1L', 'Buttermilk 200ml', 'Energy Drink 250ml'],
      },
      {
        slug: 'groceries-fresh-produce',
        name: { en: 'Fresh Produce', ta: 'புதிய காய்கறி' },
        sortOrder: 6,
        productNames: ['Tomato 1kg', 'Onion 1kg', 'Potato 1kg', 'Banana Dozen', 'Apple 1kg', 'Carrot 500g', 'Capsicum 250g', 'Spinach Bunch'],
      },
    ],
  },
  {
    slug: 'dairy',
    name: { en: 'Dairy', ta: 'பால் பொருட்கள்' },
    sortOrder: 2,
    children: [
      {
        slug: 'dairy-milk',
        name: { en: 'Milk', ta: 'பால்' },
        sortOrder: 1,
        productNames: ['Full Cream Milk 1L', 'Toned Milk 500ml', 'Double Toned Milk 1L', 'Organic Milk 1L', 'Flavoured Milk 200ml', 'Lactose Free Milk 1L', 'Farm Fresh Milk 500ml', 'UHT Milk 1L'],
      },
      {
        slug: 'dairy-curd-yogurt',
        name: { en: 'Curd & Yogurt', ta: 'தயிர்' },
        sortOrder: 2,
        productNames: ['Fresh Curd 500g', 'Greek Yogurt 200g', 'Flavoured Yogurt 4pk', 'Probiotic Curd 400g', 'Low Fat Curd 500g', 'Set Curd 1kg', 'Mishti Doi 100g', 'Lassi 200ml'],
      },
      {
        slug: 'dairy-cheese',
        name: { en: 'Cheese', ta: 'Cheese' },
        sortOrder: 3,
        productNames: ['Processed Cheese Slices', 'Mozzarella 200g', 'Cheddar Block 200g', 'Cream Cheese 150g', 'Cheese Spread 200g', 'Parmesan Grated 100g', 'Cheese Cubes 200g', 'Pizza Cheese 200g'],
      },
      {
        slug: 'dairy-butter-ghee',
        name: { en: 'Butter & Ghee', ta: 'வெண்ணெய் & நெய்' },
        sortOrder: 4,
        productNames: ['Salted Butter 100g', 'Unsalted Butter 200g', 'Cow Ghee 500ml', 'Buffalo Ghee 200ml', 'Cooking Butter 500g', 'Garlic Butter 100g', 'Clarified Butter 250g', 'Spreadable Butter 200g'],
      },
      {
        slug: 'dairy-paneer',
        name: { en: 'Paneer', ta: 'பன்னீர்' },
        sortOrder: 5,
        productNames: ['Fresh Paneer 200g', 'Malai Paneer 250g', 'Low Fat Paneer 200g', 'Paneer Cubes 200g', 'Organic Paneer 200g', 'Snack Paneer 150g', 'Herb Paneer 200g', 'Family Pack Paneer 400g'],
      },
      {
        slug: 'dairy-desserts',
        name: { en: 'Dairy Desserts', ta: 'Desserts' },
        sortOrder: 6,
        productNames: ['Vanilla Ice Cream 500ml', 'Kulfi Stick 4pk', 'Rasgulla Tin', 'Shrikhand 200g', 'Rabri Cup 100g', 'Flavoured Milkshake 250ml', 'Chocolate Ice Cream 500ml', 'Mango Ice Cream 500ml'],
      },
    ],
  },
  {
    slug: 'bakery',
    name: { en: 'Bakery', ta: 'பேக்கரி' },
    sortOrder: 3,
    children: [
      {
        slug: 'bakery-bread',
        name: { en: 'Bread', ta: 'ரொட்டி' },
        sortOrder: 1,
        productNames: ['Whole Wheat Bread', 'White Sandwich Bread', 'Multigrain Bread', 'Milk Bread 400g', 'Garlic Bread', 'Brown Bread', 'Burger Buns 4pk', 'Hot Dog Buns 4pk'],
      },
      {
        slug: 'bakery-cakes',
        name: { en: 'Cakes', ta: 'கேக்' },
        sortOrder: 2,
        productNames: ['Chocolate Truffle Cake', 'Vanilla Sponge Slice', 'Black Forest Pastry', 'Red Velvet Cupcake', 'Butterscotch Cake', 'Fruit Cake 500g', 'Plum Cake', 'Mawa Cake Slice'],
      },
      {
        slug: 'bakery-cookies',
        name: { en: 'Cookies & Biscuits', ta: 'பிஸ்கட்' },
        sortOrder: 3,
        productNames: ['Butter Cookies 200g', 'Oat Cookies', 'Cream Biscuits', 'Marie Biscuits', 'Digestive Biscuits', 'Chocolate Cookies', 'Coconut Cookies', 'Assorted Cookies Box'],
      },
      {
        slug: 'bakery-pastries',
        name: { en: 'Pastries', ta: 'Pastry' },
        sortOrder: 4,
        productNames: ['Pineapple Pastry', 'Strawberry Pastry', 'Honey Almond Croissant', 'Danish Pastry', 'Eclair Chocolate', 'Fruit Tart', 'Cheese Puff', 'Palmier Pack'],
      },
      {
        slug: 'bakery-breakfast',
        name: { en: 'Breakfast Bakery', ta: 'Breakfast' },
        sortOrder: 5,
        productNames: ['Croissant Plain', 'Muffin Blueberry', 'Donut Glazed', 'Pav Pack 6', 'Rusks 300g', 'Toast Slices', 'Swiss Roll', 'Pancake Mix 200g'],
      },
    ],
  },
  {
    slug: 'gifts',
    name: { en: 'Gifts', ta: 'பரிசுகள்' },
    sortOrder: 4,
    children: [
      {
        slug: 'gifts-hampers',
        name: { en: 'Gift Hampers', ta: 'Gift hamper' },
        sortOrder: 1,
        productNames: ['Festive Snack Hamper', 'Gourmet Tea Hamper', 'Dry Fruits Hamper', 'Chocolate Hamper', 'Breakfast Hamper', 'Wellness Hamper', 'Corporate Hamper', 'Mini Celebration Hamper'],
      },
      {
        slug: 'gifts-chocolates',
        name: { en: 'Chocolates', ta: 'Chocolate' },
        sortOrder: 2,
        productNames: ['Assorted Chocolates Box', 'Dark Chocolate Bar', 'Milk Chocolate Bar', 'Truffles 6pc', 'Ferrero Collection', 'Personalized Chocolate Box', 'Nutty Chocolate Pack', 'Heart Chocolate Box'],
      },
      {
        slug: 'gifts-flowers',
        name: { en: 'Flowers', ta: 'Flowers' },
        sortOrder: 3,
        productNames: ['Rose Bouquet 12', 'Mixed Flower Bouquet', 'Orchid Pot', 'Carnations Bunch', 'Sunflower Bouquet', 'Lily Arrangement', 'Gerbera Bouquet', 'Premium Floral Box'],
      },
      {
        slug: 'gifts-personalized',
        name: { en: 'Personalized Gifts', ta: 'Personalized' },
        sortOrder: 4,
        productNames: ['Custom Mug', 'Photo Frame Gift', 'Engraved Keychain', 'Name Plate Hamper Tag', 'Custom Greeting Card Set', 'Personalized Tote', 'Custom Candle', 'Monogram Notebook Set'],
      },
      {
        slug: 'gifts-festive',
        name: { en: 'Festive Gifts', ta: 'Festive' },
        sortOrder: 5,
        productNames: ['Diwali Sweet Box', 'Christmas Cookie Tin', 'New Year Hamper', 'Pongal Special Box', 'Rakhi Gift Combo', 'Eid Delight Box', 'Housewarming Gift Set', 'Anniversary Gift Box'],
      },
    ],
  },
];

const LEGACY_SLUGS_TO_DEACTIVATE = [
  'fruits-vegetables',
  'snacks',
  'beverages',
  'fashions',
  'fresh',
  'electronics',
  'fashion',
];

export async function seedCategoryHierarchy(
  vendorByCode: Map<string, string>,
): Promise<Map<string, string>> {
  const categoryBySlug = new Map<string, string>();
  const vendorCodes = [...vendorByCode.keys()];
  const primaryVendor = vendorByCode.get('FRESH-FARM') ?? vendorByCode.get(vendorCodes[0] ?? '');

  for (const legacy of LEGACY_SLUGS_TO_DEACTIVATE) {
    await CategoryModel.updateOne({ slug: legacy }, { isActive: false });
  }

  for (const parent of CATEGORY_HIERARCHY) {
    const parentDoc = await CategoryModel.findOneAndUpdate(
      { slug: parent.slug },
      {
        slug: parent.slug,
        name: parent.name,
        parentId: null,
        sortOrder: parent.sortOrder,
        isActive: true,
        isFeatured: true,
      },
      { upsert: true, new: true },
    );
    categoryBySlug.set(parent.slug, parentDoc._id.toString());

    for (const sub of parent.children) {
      const subDoc = await CategoryModel.findOneAndUpdate(
        { slug: sub.slug },
        {
          slug: sub.slug,
          name: sub.name,
          parentId: parentDoc._id,
          sortOrder: sub.sortOrder,
          isActive: true,
          isFeatured: false,
        },
        { upsert: true, new: true },
      );
      categoryBySlug.set(sub.slug, subDoc._id.toString());

      if (!primaryVendor) continue;
      for (let i = 0; i < sub.productNames.length; i += 1) {
        const title = sub.productNames[i];
        const sku = `${sub.slug.toUpperCase().replace(/-/g, '_')}-${String(i + 1).padStart(2, '0')}`;
        const product = await ProductModel.findOneAndUpdate(
          { sku },
          {
            sku,
            slug: sku.toLowerCase().replace(/_/g, '-'),
            name: { en: title, ta: title },
            description: { en: `${title} — ${sub.name.en}` },
            categoryId: subDoc._id,
            brand: 'FreshMart Select',
            status: 'ACTIVE',
            searchKeywords: [title, sub.slug, parent.slug],
          },
          { upsert: true, new: true },
        );

        const variantSku = `${sku}-V1`;
        const variant = await ProductVariantModel.findOneAndUpdate(
          { sku: variantSku },
          {
            productId: product._id,
            sku: variantSku,
            name: { en: 'Standard pack' },
            status: 'ACTIVE',
            sortOrder: 1,
          },
          { upsert: true, new: true },
        );

        const base = normalizeSeedPrice(40 + ((i * 7) % 20) * 5);
        const mrp = normalizeSeedPrice(base + 15);
        const selling = normalizeSeedPrice(base + 5);
        await VendorProductModel.updateOne(
          { vendorId: primaryVendor, variantId: variant._id },
          {
            vendorId: primaryVendor,
            productId: product._id,
            variantId: variant._id,
            vendorPrice: normalizeSeedPrice(base - 3),
            mrp,
            sellingPrice: selling,
            isActive: true,
            preparationMinutes: 25,
          },
          { upsert: true },
        );
        await InventoryModel.updateOne(
          { vendorId: primaryVendor, variantId: variant._id },
          {
            vendorId: primaryVendor,
            variantId: variant._id,
            available: 50 + (i % 30),
            reserved: 0,
            sold: 0,
            lowStockThreshold: 5,
          },
          { upsert: true },
        );
        await syncVariantListPriceFromVendors(variant._id.toString());
      }
    }
  }

  return categoryBySlug;
}
