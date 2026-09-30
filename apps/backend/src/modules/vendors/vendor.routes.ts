import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { paginatedMeta, successResponse } from '../../common/types/api.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { VendorModel } from './vendor.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import {
  normalizeEmptyUrls,
  vendorOnboardingDocumentsBaseSchema,
  vendorOnboardingDocumentsSchema,
} from '../onboarding/onboardingDocuments.js';
import {
  getCustomerVendor,
  getVendorStoreProduct,
  listCustomerVendors,
  listVendorStoreProducts,
} from './vendorStore.service.js';

export const vendorRouter = Router();

const createVendorSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  address: z.object({
    line1: z.string().min(3).max(120),
    line2: z.string().max(120).optional(),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    postalCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN'),
    country: z.string().max(100).optional(),
  }),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  serviceAreaRadiusKm: z.number().min(0).optional(),
  deliveryRadiusKm: z.number().min(0).optional(),
  serviceAreaWideDelivery: z.boolean().optional(),
  cuisineTags: z.array(z.string()).optional(),
  dietType: z.enum(['veg', 'nonveg', 'both']).optional(),
  imageUrl: z.string().min(1).optional(),
  /** Mandatory KYC pack — each shop is one vendor. */
  documents: vendorOnboardingDocumentsSchema,
  /** When true, mark onboarding approved (admin already verified docs). Default true for admin create. */
  approveOnboarding: z.boolean().optional(),
});

const updateVendorSchema = createVendorSchema
  .partial()
  .extend({
    documents: vendorOnboardingDocumentsBaseSchema.partial().optional(),
    onboardingStatus: z.enum(['INCOMPLETE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
    onboardingRejectionReason: z.string().max(300).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });


vendorRouter.get('/nearby', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lng and lat required' } });
      return;
    }
    const maxRadiusKm =
      Number(req.query.maxRadiusKm) ||
      (await getConfigValue<number>('vendor.search.maxRadiusKm', 25));

    const vendors = await VendorModel.find({
      status: 'ACTIVE',
      onboardingComplete: { $ne: false },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxRadiusKm * 1000,
        },
      },
    }).limit(50);

    res.json(successResponse(vendors));
  } catch (err) {
    next(err);
  }
});

vendorRouter.get('/', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const q = req.query.q ? String(req.query.q) : undefined;
    const dietRaw = req.query.diet ? String(req.query.diet) : undefined;
    const diet = dietRaw === 'veg' || dietRaw === 'nonveg' ? dietRaw : undefined;

    if (lng !== undefined && lat !== undefined && !Number.isNaN(lng) && !Number.isNaN(lat)) {
      const { items, total, location } = await listCustomerVendors({ lng, lat, page, limit, q, diet });
      const meta = {
        ...paginatedMeta(page, limit, total),
        ...(location ? { location } : {}),
      };
      res.json(successResponse(items, null, meta as unknown as Record<string, unknown>));
      return;
    }

    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      VendorModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      VendorModel.countDocuments(filter),
    ]);
    res.json(successResponse(items, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

vendorRouter.post(
  '/',
  authenticate,
  requirePermissions('vendor.create'),
  validate({ body: createVendorSchema }),
  async (req, res, next) => {
    try {
      const { longitude, latitude, documents, approveOnboarding, ...rest } = req.body;
      const docs = normalizeEmptyUrls(documents);
      const approved = approveOnboarding !== false;
      const created = await VendorModel.create({
        ...rest,
        documents: docs,
        phone: rest.phone || docs.ownerPhone,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        onboardingComplete: approved,
        onboardingStatus: approved ? 'APPROVED' : 'PENDING_REVIEW',
        // Only ACTIVE shops go live after docs approved
        status: approved && rest.status !== 'SUSPENDED' && rest.status !== 'INACTIVE' ? 'ACTIVE' : rest.status ?? 'INACTIVE',
      });
      res.status(201).json(successResponse(created));
    } catch (err) {
      next(err);
    }
  },
);

vendorRouter.patch(
  '/:id',
  authenticate,
  requirePermissions('vendor.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: updateVendorSchema,
  }),
  async (req, res, next) => {
    try {
      const { longitude, latitude, documents, ...rest } = req.body as z.infer<typeof updateVendorSchema>;
      const update: Record<string, unknown> = { ...rest };
      if (longitude !== undefined && latitude !== undefined) {
        update.location = { type: 'Point', coordinates: [longitude, latitude] };
      }
      if (documents) {
        const existing = await VendorModel.findById(req.params.id).select('documents').lean();
        update.documents = normalizeEmptyUrls({
          ...(existing?.documents ?? {}),
          ...documents,
        });
        update.onboardingComplete = true;
        if (!rest.onboardingStatus) update.onboardingStatus = 'APPROVED';
      }
      if (rest.onboardingStatus === 'APPROVED') {
        update.onboardingComplete = true;
      }
      if (rest.onboardingStatus === 'REJECTED' || rest.onboardingStatus === 'INCOMPLETE') {
        update.onboardingComplete = false;
        if (rest.status === undefined) update.status = 'INACTIVE';
      }
      const vendor = await VendorModel.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      }).lean();
      if (!vendor) throw new NotFoundError('Vendor not found');
      res.json(successResponse(vendor));
    } catch (err) {
      next(err);
    }
  },
);

vendorRouter.delete(
  '/:id',
  authenticate,
  requirePermissions('vendor.delete'),
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const vendor = await VendorModel.findById(req.params.id);
      if (!vendor) throw new NotFoundError('Vendor not found');
      vendor.status = 'INACTIVE';
      await vendor.save();
      res.json(successResponse({ id: vendor._id.toString(), status: vendor.status, deactivated: true }));
    } catch (err) {
      next(err);
    }
  },
);

vendorRouter.get('/:vendorId/products', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 20));
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const dietRaw = req.query.diet ? String(req.query.diet) : undefined;
    const diet = dietRaw === 'veg' || dietRaw === 'nonveg' ? dietRaw : undefined;
    const result = await listVendorStoreProducts(req.params.vendorId, {
      page,
      limit,
      search: req.query.search ? String(req.query.search) : req.query.q ? String(req.query.q) : undefined,
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      brand: req.query.brand ? String(req.query.brand) : undefined,
      minPrice: req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined,
      inStockOnly: req.query.inStockOnly === 'true',
      sort: req.query.sort ? String(req.query.sort) : undefined,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      diet,
    });
    res.json(
      successResponse(
        { products: result.items, categories: result.categories },
        null,
        paginatedMeta(page, limit, result.total) as unknown as Record<string, unknown>,
      ),
    );
  } catch (err) {
    next(err);
  }
});

vendorRouter.get('/:vendorId/products/:vendorProductId', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const detail = await getVendorStoreProduct(
      req.params.vendorId,
      req.params.vendorProductId,
      lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
    );
    res.json(successResponse(detail));
  } catch (err) {
    next(err);
  }
});

vendorRouter.get('/:id', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    if (lng !== undefined && lat !== undefined && !Number.isNaN(lng) && !Number.isNaN(lat)) {
      const vendor = await getCustomerVendor(req.params.id, lng, lat);
      res.json(successResponse(vendor));
      return;
    }
    const vendor = await VendorModel.findById(req.params.id).lean();
    if (!vendor) throw new NotFoundError('Vendor not found');
    res.json(successResponse(vendor));
  } catch (err) {
    next(err);
  }
});
