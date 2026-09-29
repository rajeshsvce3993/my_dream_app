import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { VendorModel } from '../src/modules/vendors/vendor.model.js';
import { ProductModel } from '../src/modules/products/product.model.js';
import { ProductVariantModel } from '../src/modules/products/productVariant.model.js';
import { VendorProductModel } from '../src/modules/products/vendorProduct.model.js';
import { InventoryModel } from '../src/modules/inventory/inventory.model.js';
import { CategoryModel } from '../src/modules/categories/category.model.js';
import {
  getVendorStoreProduct,
  listVendorStoreProducts,
} from '../src/modules/vendors/vendorStore.service.js';

describe('vendor store service', () => {
  let mongo: MongoMemoryServer;
  let vendorA: string;
  let vendorB: string;
  let productX: string;
  let productY: string;
  let productZ: string;
  let vpX: string;
  let vpY: string;
  let vpZ: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await VendorProductModel.syncIndexes();

    const cat = await CategoryModel.create({
      slug: 'test-cat',
      name: { en: 'Test' },
      isActive: true,
      sortOrder: 1,
    });

    const [a, b] = await VendorModel.create([
      {
        code: 'V-A',
        name: 'Chennai Fresh Mart',
        status: 'ACTIVE',
        rating: 4.5,
        location: { type: 'Point', coordinates: [80.2707, 13.0827] },
      },
      {
        code: 'V-B',
        name: 'Chennai Super Store',
        status: 'ACTIVE',
        rating: 4.3,
        location: { type: 'Point', coordinates: [80.271, 13.083] },
      },
    ]);
    vendorA = a._id.toString();
    vendorB = b._id.toString();

    const makeProduct = async (sku: string, name: string) => {
      const p = await ProductModel.create({
        sku,
        slug: sku,
        name: { en: name },
        categoryId: cat._id,
        status: 'ACTIVE',
      });
      const v = await ProductVariantModel.create({
        productId: p._id,
        sku: `${sku}-V1`,
        name: { en: '1 pack' },
        status: 'ACTIVE',
      });
      return { p, v };
    };

    const x = await makeProduct('PX', 'Product X');
    const y = await makeProduct('PY', 'Product Y');
    const z = await makeProduct('PZ', 'Product Z');
    productX = x.p._id.toString();
    productY = y.p._id.toString();
    productZ = z.p._id.toString();

    const map = async (vendorId: string, productId: mongoose.Types.ObjectId, variantId: mongoose.Types.ObjectId) => {
      const doc = await VendorProductModel.create({
        vendorId,
        productId,
        variantId,
        vendorPrice: 100,
        mrp: 120,
        sellingPrice: 110,
        isActive: true,
      });
      await InventoryModel.create({
        vendorId,
        variantId,
        available: 50,
        reserved: 0,
        sold: 0,
        lowStockThreshold: 5,
      });
      return doc._id.toString();
    };

    vpX = await map(vendorA, x.p._id, x.v._id);
    vpY = await map(vendorA, y.p._id, y.v._id);
    vpZ = await map(vendorB, z.p._id, z.v._id);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('lists only vendor A products for vendor A store', async () => {
    const { items } = await listVendorStoreProducts(vendorA, { lng: 80.2707, lat: 13.0827 });
    const productIds = items.map((i) => i.productId);
    expect(productIds).toContain(productX);
    expect(productIds).toContain(productY);
    expect(productIds).not.toContain(productZ);
  });

  it('returns no results when searching vendor A store for product Z', async () => {
    const { items } = await listVendorStoreProducts(vendorA, {
      search: 'Product Z',
      lng: 80.2707,
      lat: 13.0827,
    });
    expect(items).toHaveLength(0);
  });

  it('scopes vendor product detail to vendor ownership', async () => {
    const detail = await getVendorStoreProduct(vendorA, vpX, 80.2707, 13.0827);
    expect(detail.vendorName).toBe('Chennai Fresh Mart');
    expect(detail.productId).toBe(productX);

    await expect(getVendorStoreProduct(vendorA, vpZ, 80.2707, 13.0827)).rejects.toThrow(/not found/i);
  });

  it('prevents duplicate vendor-variant mappings at database level', async () => {
    const variant = await ProductVariantModel.findOne({ sku: 'PX-V1' });
    await expect(
      VendorProductModel.create({
        vendorId: vendorA,
        productId: productX,
        variantId: variant!._id,
        vendorPrice: 90,
        mrp: 100,
        sellingPrice: 95,
        isActive: true,
      }),
    ).rejects.toThrow();
  });
});
