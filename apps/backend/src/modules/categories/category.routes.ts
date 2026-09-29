import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { paginatedMeta, successResponse } from '../../common/types/api.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { CategoryModel } from './category.model.js';
export const categoryRouter = Router();

const localizedInput = z.object({ en: z.string().min(1), ta: z.string().optional() });

const createCategorySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: localizedInput,
  description: localizedInput.optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

categoryRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter: Record<string, unknown> = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.slug) filter.slug = String(req.query.slug);
    if (req.query.parentId === 'null') filter.parentId = null;
    else if (req.query.parentId) filter.parentId = req.query.parentId;

    const [items, total] = await Promise.all([
      CategoryModel.find(filter).sort({ sortOrder: 1, 'name.en': 1 }).skip((page - 1) * limit).limit(limit).lean(),
      CategoryModel.countDocuments(filter),
    ]);
    res.json(successResponse(items, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

categoryRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await CategoryModel.findById(req.params.id).lean();
    if (!item) throw new NotFoundError('Category not found');
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

categoryRouter.post(
  '/',
  authenticate,
  requirePermissions('category.create'),
  validate({ body: createCategorySchema }),
  async (req, res, next) => {
    try {
      const created = await CategoryModel.create(req.body);
      res.status(201).json(successResponse(created));
    } catch (err) {
      next(err);
    }
  },
);

categoryRouter.patch(
  '/:id',
  authenticate,
  requirePermissions('category.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: createCategorySchema.partial(),
  }),
  async (req, res, next) => {
    try {
      const updated = await CategoryModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) throw new NotFoundError('Category not found');
      res.json(successResponse(updated));
    } catch (err) {
      next(err);
    }
  },
);
