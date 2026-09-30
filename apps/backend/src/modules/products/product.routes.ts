import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { paginatedMeta, successResponse } from '../../common/types/api.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { getLocationAvailabilityForCustomer } from '../delivery/deliveryServiceAreas.service.js';
import { SERVICE_AREA_BODY, SERVICE_AREA_TITLE } from '../delivery/locationAvailability.js';
import { quoteVendorOffers } from '../pricing/pricing.service.js';
import { enrichVendorComparisonOffers } from '../catalog/vendorComparisonPresentation.js';
import { getVariantListPrice } from './variantListPrice.service.js';
import { ProductModel } from './product.model.js';
import { ProductVariantModel } from './productVariant.model.js';
import { VendorProductModel } from './vendorProduct.model.js';

export const productRouter = Router();

const localizedInput = z.object({ en: z.string().min(1), ta: z.string().optional() });

const createProductSchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: localizedInput,
  description: localizedInput.optional(),
  categoryId: z.string().min(1),
  subcategoryId: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        isPrimary: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .optional(),
});

const createVariantSchema = z.object({
  sku: z.string().min(1),
  name: localizedInput,
  listPrice: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.number().optional(),
});

productRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.q) {
      filter.$text = { $search: String(req.query.q) };
    }

    const [items, total] = await Promise.all([
      ProductModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProductModel.countDocuments(filter),
    ]);
    res.json(successResponse(items, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

productRouter.get('/:id', async (req, res, next) => {
  try {
    const product = await ProductModel.findById(req.params.id).lean();
    if (!product) throw new NotFoundError('Product not found');
    const variants = await ProductVariantModel.find({ productId: product._id, status: 'ACTIVE' })
      .sort({ sortOrder: 1 })
      .select('sku name status sortOrder listPrice')
      .lean();
    res.json(successResponse({ product, variants }));
  } catch (err) {
    next(err);
  }
});

productRouter.get('/:id/vendor-comparison', async (req, res, next) => {
  try {
    const variantId = String(req.query.variantId || '');
    if (!variantId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'variantId required' } });
      return;
    }
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const quantity = Number(req.query.quantity) || 1;
    if (lng !== undefined && lat !== undefined && !Number.isNaN(lng) && !Number.isNaN(lat)) {
      const location = await getLocationAvailabilityForCustomer(lng, lat);
      if (!location.inServiceArea) {
        res.json(
          successResponse({
            vendors: [],
            cheapestVendorId: null,
            nearestVendorId: null,
            bestOverallVendorId: null,
            location: {
              ...location,
              serviceAreaTitle: location.serviceAreaTitle ?? SERVICE_AREA_TITLE,
              message: location.serviceAreaMessage ?? SERVICE_AREA_BODY,
            },
          }),
        );
        return;
      }
    }
    const comparison = await quoteVendorOffers({
      variantId,
      quantity,
      customerLng: lng,
      customerLat: lat,
    });
    const actualPrice = (await getVariantListPrice(variantId)) ?? 0;
    const vendors = enrichVendorComparisonOffers(actualPrice, comparison.vendors);
    res.json(
      successResponse({
        actualPrice: actualPrice || undefined,
        variantId,
        vendors,
        cheapestVendorId: comparison.cheapestVendorId,
        nearestVendorId: comparison.nearestVendorId,
        bestOverallVendorId: comparison.bestOverallVendorId,
      }),
    );
  } catch (err) {
    next(err);
  }
});

productRouter.post(
  '/',
  authenticate,
  requirePermissions('product.create'),
  validate({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const created = await ProductModel.create(req.body);
      res.status(201).json(successResponse(created));
    } catch (err) {
      next(err);
    }
  },
);

productRouter.post(
  '/:id/variants',
  authenticate,
  requirePermissions('product.create'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: createVariantSchema,
  }),
  async (req, res, next) => {
    try {
      const product = await ProductModel.findById(req.params.id).lean();
      if (!product) throw new NotFoundError('Product not found');
      const created = await ProductVariantModel.create({
        productId: product._id,
        sku: req.body.sku,
        name: req.body.name,
        listPrice: req.body.listPrice,
        status: req.body.status ?? 'ACTIVE',
        sortOrder: req.body.sortOrder ?? 1,
      });
      res.status(201).json(successResponse(created));
    } catch (err) {
      next(err);
    }
  },
);

export const vendorProductRouter = Router();

const vendorProductBodySchema = z.object({
  vendorId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  vendorPrice: z.number().min(0),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  vendorSku: z.string().optional(),
  preparationMinutes: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

vendorProductRouter.get('/', authenticate, requirePermissions('vendor.read'), async (req, res, next) => {
  try {
    const vendorId = String(req.query.vendorId || '');
    if (!vendorId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'vendorId required' } });
      return;
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter = { vendorId, ...(req.query.isActive !== undefined ? { isActive: req.query.isActive === 'true' } : {}) };
    const [items, total] = await Promise.all([
      VendorProductModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('productId', 'name sku slug brand status')
        .populate('variantId', 'name sku status')
        .lean(),
      VendorProductModel.countDocuments(filter),
    ]);
    res.json(successResponse(items, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

vendorProductRouter.post(
  '/',
  authenticate,
  requirePermissions('pricing.update'),
  validate({ body: vendorProductBodySchema }),
  async (req, res, next) => {
    try {
      const created = await VendorProductModel.create(req.body);
      res.status(201).json(successResponse(created));
    } catch (err) {
      next(err);
    }
  },
);

vendorProductRouter.patch(
  '/:id',
  authenticate,
  requirePermissions('pricing.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      vendorPrice: z.number().min(0).optional(),
      mrp: z.number().min(0).optional(),
      sellingPrice: z.number().min(0).optional(),
      vendorSku: z.string().optional(),
      preparationMinutes: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
      stock: z.number().int().min(0).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { stock, ...updates } = req.body;
      const mapping = await VendorProductModel.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!mapping) throw new NotFoundError('Vendor product not found');
      if (stock !== undefined) {
        const { InventoryModel } = await import('../inventory/inventory.model.js');
        await InventoryModel.updateOne(
          { vendorId: mapping.vendorId, variantId: mapping.variantId },
          { $set: { available: stock } },
          { upsert: true },
        );
      }
      if (
        updates.mrp !== undefined ||
        updates.sellingPrice !== undefined ||
        updates.vendorPrice !== undefined
      ) {
        const { syncVariantListPriceFromVendors } = await import('./variantListPrice.service.js');
        await syncVariantListPriceFromVendors(mapping.variantId.toString());
      }
      res.json(successResponse(mapping));
    } catch (err) {
      next(err);
    }
  },
);

vendorProductRouter.delete(
  '/:id',
  authenticate,
  requirePermissions('pricing.update'),
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const mapping = await VendorProductModel.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
      );
      if (!mapping) throw new NotFoundError('Vendor product not found');
      res.json(successResponse({ removed: true, id: mapping._id.toString() }));
    } catch (err) {
      next(err);
    }
  },
);
