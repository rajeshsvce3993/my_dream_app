import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../modules/auth/auth.service.js';
import { ConfigurationModel } from '../modules/configuration/configuration.model.js';
import { InventoryModel } from '../modules/inventory/inventory.model.js';
import { ProductModel } from '../modules/products/product.model.js';
import { ProductVariantModel } from '../modules/products/productVariant.model.js';
import { VendorProductModel } from '../modules/products/vendorProduct.model.js';
import { RoleModel } from '../modules/users/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { VendorModel } from '../modules/vendors/vendor.model.js';
import { cacheDel } from '../infrastructure/cache/redis.js';
import { invalidateOtpSettingsCache } from '../modules/otp/otp.settings.service.js';
import { logger } from '../infrastructure/logging/logger.js';
import { normalizeSeedPrice } from '../common/money.util.js';
import { syncVariantListPriceFromVendors } from '../modules/products/variantListPrice.service.js';
import { seedCategoryHierarchy } from './seedCategoryHierarchy.js';

interface FreshmartSeedFile {
  configurations: Array<{
    key: string;
    value: unknown;
    category: string;
    isPublic: boolean;
    description?: string;
  }>;
  admin: { email: string; password: string; firstName: string; lastName: string };
  categories: Array<{
    slug: string;
    name: { en: string; ta?: string };
    sortOrder: number;
    isFeatured: boolean;
  }>;
  vendors: Array<{
    code: string;
    name: string;
    rating: number;
    ratingCount: number;
    commissionRate: number;
    lng: number;
    lat: number;
    serviceAreaWideDelivery?: boolean;
    address?: { city?: string; state?: string; country?: string };
  }>;
  products: Array<{
    sku: string;
    slug: string;
    categorySlug: string;
    brand?: string;
    name: { en: string; ta?: string };
    description?: { en: string; ta?: string };
    imageUrl?: string;
    variants: Array<{
      sku: string;
      name: { en: string; ta?: string };
      vendorPricing: Array<{
        vendorCode: string;
        vendorPrice: number;
        mrp: number;
        sellingPrice: number;
        stock: number;
      }>;
    }>;
  }>;
}

export function resolveSeedFilePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../../../data/freshmart-seed.json'),
    path.resolve(process.cwd(), 'data/freshmart-seed.json'),
    path.resolve(process.cwd(), '../../data/freshmart-seed.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('freshmart-seed.json not found in data/');
}

export async function loadFreshmartSeedFromFile(filePath?: string): Promise<void> {
  const resolved = filePath ?? resolveSeedFilePath();
  const raw = fs.readFileSync(resolved, 'utf-8');
  const data = JSON.parse(raw) as FreshmartSeedFile;
  logger.info({ file: resolved }, 'Loading FreshMart seed data');

  for (const cfg of data.configurations) {
    await ConfigurationModel.updateOne({ key: cfg.key }, cfg, { upsert: true });
  }
  await cacheDel('config:*');
  invalidateOtpSettingsCache();

  const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' });
  if (superAdminRole) {
    const existingAdmin = await UserModel.findOne({ email: data.admin.email.toLowerCase() });
    if (!existingAdmin) {
      await UserModel.create({
        email: data.admin.email.toLowerCase(),
        passwordHash: await hashPassword(data.admin.password),
        firstName: data.admin.firstName,
        lastName: data.admin.lastName,
        roleIds: [superAdminRole._id],
        isActive: true,
        emailVerified: true,
      });
    }
  }

  const vendorByCode = new Map<string, string>();
  for (const v of data.vendors) {
    const doc = await VendorModel.findOneAndUpdate(
      { code: v.code },
      {
        code: v.code,
        name: v.name,
        status: 'ACTIVE',
        rating: v.rating,
        ratingCount: v.ratingCount,
        commissionRate: v.commissionRate,
        location: { type: 'Point', coordinates: [v.lng, v.lat] },
        serviceAreaRadiusKm: 20,
        deliveryRadiusKm: 15,
        serviceAreaWideDelivery: Boolean(v.serviceAreaWideDelivery),
        address: v.address,
      },
      { upsert: true, new: true },
    );
    vendorByCode.set(v.code, doc._id.toString());
  }

  const categoryBySlug = await seedCategoryHierarchy(vendorByCode);

  const legacyCategorySlugRemap: Record<string, string> = {
    'fruits-vegetables': 'groceries-fresh-produce',
    snacks: 'groceries-snacks-packaged',
    beverages: 'groceries-beverages',
    groceries: 'groceries-staples',
    dairy: 'dairy-milk',
    bakery: 'bakery-bread',
  };

  for (const p of data.products) {
    const mappedSlug = legacyCategorySlugRemap[p.categorySlug] ?? p.categorySlug;
    const categoryId = categoryBySlug.get(mappedSlug);
    if (!categoryId) continue;

    const product = await ProductModel.findOneAndUpdate(
      { sku: p.sku },
      {
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId,
        brand: p.brand,
        status: 'ACTIVE',
        images: p.imageUrl ? [{ url: p.imageUrl, isPrimary: true, sortOrder: 0 }] : [],
        searchKeywords: [p.name.en, p.name.ta].filter(Boolean),
      },
      { upsert: true, new: true },
    );

    for (const variant of p.variants) {
      const variantDoc = await ProductVariantModel.findOneAndUpdate(
        { sku: variant.sku },
        {
          productId: product._id,
          sku: variant.sku,
          name: variant.name,
          status: 'ACTIVE',
          sortOrder: 1,
        },
        { upsert: true, new: true },
      );

      const variantListPrice = normalizeSeedPrice(
        Math.max(...variant.vendorPricing.map((vp) => vp.mrp)),
      );

      for (const vp of variant.vendorPricing) {
        const vendorId = vendorByCode.get(vp.vendorCode);
        if (!vendorId) continue;

        await VendorProductModel.updateOne(
          { vendorId, variantId: variantDoc._id },
          {
            vendorId,
            productId: product._id,
            variantId: variantDoc._id,
            vendorPrice: normalizeSeedPrice(vp.vendorPrice),
            mrp: normalizeSeedPrice(vp.mrp),
            sellingPrice: normalizeSeedPrice(vp.sellingPrice),
            isActive: true,
            preparationMinutes: 30,
          },
          { upsert: true },
        );

        await InventoryModel.updateOne(
          { vendorId, variantId: variantDoc._id },
          {
            vendorId,
            variantId: variantDoc._id,
            available: vp.stock,
            reserved: 0,
            sold: 0,
            lowStockThreshold: 10,
          },
          { upsert: true },
        );
      }

      await ProductVariantModel.updateOne(
        { _id: variantDoc._id },
        { listPrice: variantListPrice },
      );
      await syncVariantListPriceFromVendors(variantDoc._id.toString());
    }
  }

  await expandDemoVendorCatalog(vendorByCode, categoryBySlug);
  await backfillAllVariantListPrices();
  await renormalizeAllVendorProductPrices();
  await cloneVendorCatalogIfEmpty('FRESH-FARM', 'TIRUVALLUR-MART', vendorByCode);

  logger.info('FreshMart seed file loaded successfully');
}

/** Gives new local stores a starter catalog (same SKUs as template) for store list / browse tests. */
async function cloneVendorCatalogIfEmpty(
  templateCode: string,
  targetCode: string,
  vendorByCode: Map<string, string>,
): Promise<void> {
  const templateId = vendorByCode.get(templateCode);
  const targetId = vendorByCode.get(targetCode);
  if (!templateId || !targetId) return;

  const existing = await VendorProductModel.countDocuments({ vendorId: targetId, isActive: true });
  if (existing > 0) return;

  const templateMappings = await VendorProductModel.find({ vendorId: templateId, isActive: true }).lean();
  for (const m of templateMappings) {
    await VendorProductModel.updateOne(
      { vendorId: targetId, variantId: m.variantId },
      {
        vendorId: targetId,
        productId: m.productId,
        variantId: m.variantId,
        vendorPrice: m.vendorPrice,
        mrp: m.mrp,
        sellingPrice: m.sellingPrice,
        isActive: true,
        preparationMinutes: m.preparationMinutes ?? 30,
      },
      { upsert: true },
    );
    const inv = await InventoryModel.findOne({ vendorId: templateId, variantId: m.variantId }).lean();
    await InventoryModel.updateOne(
      { vendorId: targetId, variantId: m.variantId },
      {
        vendorId: targetId,
        variantId: m.variantId,
        available: inv?.available ?? 40,
        reserved: 0,
        sold: 0,
        lowStockThreshold: 10,
      },
      { upsert: true },
    );
  }
}

/** Keeps DB catalog amounts on ₹ whole or .50 steps after seed edits or legacy data. */
async function backfillAllVariantListPrices(): Promise<void> {
  const variants = await ProductVariantModel.find({}).select('_id').lean();
  for (const v of variants) {
    await syncVariantListPriceFromVendors(v._id.toString());
  }
}

async function renormalizeAllVendorProductPrices(): Promise<void> {
  const mappings = await VendorProductModel.find({}).select('vendorPrice mrp sellingPrice').lean();
  for (const m of mappings) {
    await VendorProductModel.updateOne(
      { _id: m._id },
      {
        vendorPrice: normalizeSeedPrice(m.vendorPrice),
        mrp: normalizeSeedPrice(m.mrp),
        sellingPrice: normalizeSeedPrice(m.sellingPrice),
      },
    );
  }
}

/** Ensures demo scale: 50+ global SKUs and 100+ vendor listings for store browsing tests. */
async function expandDemoVendorCatalog(
  vendorByCode: Map<string, string>,
  categoryBySlug: Map<string, string>,
): Promise<void> {
  const categorySlugs = ['groceries', 'snacks', 'beverages', 'dairy'];
  const vendorCodes = [...vendorByCode.keys()];
  if (!vendorCodes.length) return;

  let mappingCount = await VendorProductModel.countDocuments();
  const productCount = await ProductModel.countDocuments();
  if (productCount >= 50 && mappingCount >= 100) return;

  for (let i = productCount; i < 52; i += 1) {
    const categorySlug = categorySlugs[i % categorySlugs.length];
    const categoryId = categoryBySlug.get(categorySlug);
    if (!categoryId) continue;

    const sku = `DEMO-SKU-${String(i + 1).padStart(3, '0')}`;
    const product = await ProductModel.findOneAndUpdate(
      { sku },
      {
        sku,
        slug: sku.toLowerCase(),
        name: { en: `Demo Grocery Item ${i + 1}`, ta: `Demo ${i + 1}` },
        description: { en: 'Demo catalog item for vendor store browsing' },
        categoryId,
        brand: 'FreshMart Select',
        status: 'ACTIVE',
        searchKeywords: [`demo-${i + 1}`, 'grocery'],
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

    for (let v = 0; v < vendorCodes.length; v += 1) {
      if ((i + v) % 3 === 0) continue;
      const vendorId = vendorByCode.get(vendorCodes[v]);
      if (!vendorId) continue;
      const step = 5 + (i % 3) * 5;
      const base = normalizeSeedPrice(45 + ((i * 3 + v * 2) % 24) * step);
      const mrp = normalizeSeedPrice(base + 10);
      const selling = normalizeSeedPrice(base + (v === 0 ? 0 : 5));
      await VendorProductModel.updateOne(
        { vendorId, variantId: variant._id },
        {
          vendorId,
          productId: product._id,
          variantId: variant._id,
          vendorPrice: normalizeSeedPrice(base - 5),
          mrp,
          sellingPrice: selling,
          isActive: true,
          preparationMinutes: 20 + (v % 3) * 5,
        },
        { upsert: true },
      );
      await InventoryModel.updateOne(
        { vendorId, variantId: variant._id },
        {
          vendorId,
          variantId: variant._id,
          available: 30 + ((i + v) % 80),
          reserved: 0,
          sold: (i + v) % 50,
          lowStockThreshold: 5,
        },
        { upsert: true },
      );
      mappingCount += 1;
    }
  }
}
