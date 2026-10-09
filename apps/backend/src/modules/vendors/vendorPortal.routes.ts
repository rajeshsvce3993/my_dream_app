import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { AuthenticationError, AuthorizationError } from '../../common/errors/AppError.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { ORDER_STATUSES } from '../orders/orderStateMachine.js';
import { UserModel } from '../users/user.model.js';
import { VendorModel } from './vendor.model.js';
import { getVendorEarnings } from './vendorEarningsPortal.service.js';
import {
  getVendorHomeStats,
  getVendorOrderDetail,
  listVendorOrders,
  updateVendorOrderStatusForVendor,
} from './vendorOrderPortal.service.js';
import { listVendorProducts, updateVendorProduct } from './vendorProductPortal.service.js';
import {
  getVendorStaffByUserId,
  requireOperationalVendorStaff,
  setShopAcceptingOrders,
} from './vendorStaffAccess.service.js';
import {
  createVendorStaff,
  listVendorStaffAccounts,
  updateVendorStaffAccount,
} from './vendorStaffAdmin.service.js';

export const vendorPortalRouter = Router();

const requireVendorLogin: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AuthenticationError());
  if (req.auth.roles?.includes('VENDOR')) return next();
  next(new AuthorizationError('This account is not a vendor login'));
};

vendorPortalRouter.get('/me', authenticate, requireVendorLogin, async (req, res, next) => {
  try {
    const staff = await getVendorStaffByUserId(req.auth!.sub);
    const vendor = await VendorModel.findById(staff.vendorId).lean();
    const stats = await getVendorHomeStats(staff.vendorId.toString());
    const user = await UserModel.findById(req.auth!.sub).select('firstName lastName email phone').lean();
    res.json(
      successResponse({
        approvalStatus: staff.approvalStatus,
        acceptingOrders: staff.acceptingOrders,
        vendor: vendor
          ? { id: vendor._id, name: vendor.name, code: vendor.code, status: vendor.status }
          : null,
        stats,
        profile: user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone,
            }
          : null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

vendorPortalRouter.post(
  '/me/accepting-orders',
  authenticate,
  requireVendorLogin,
  validate({ body: z.object({ acceptingOrders: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const staff = await getVendorStaffByUserId(req.auth!.sub);
      if (staff.approvalStatus !== 'APPROVED') {
        res.status(403).json({ success: false, error: { message: 'Not approved' } });
        return;
      }
      await setShopAcceptingOrders(staff.vendorId.toString(), req.body.acceptingOrders);
      res.json(successResponse({ acceptingOrders: req.body.acceptingOrders }));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get('/products', authenticate, requireVendorLogin, async (req, res, next) => {
  try {
    const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
    const items = await listVendorProducts(vendorId);
    res.json(successResponse(items));
  } catch (err) {
    next(err);
  }
});

vendorPortalRouter.patch(
  '/products/:id',
  authenticate,
  requireVendorLogin,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      sellingPrice: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
      const row = await updateVendorProduct(vendorId, String(req.params.id), req.body);
      res.json(successResponse(row));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get(
  '/orders',
  authenticate,
  requireVendorLogin,
  validate({
    query: z.object({
      bucket: z.enum(['new', 'active', 'completed']).optional(),
      status: z.enum(ORDER_STATUSES).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
      const query = req.query as {
        bucket?: 'new' | 'active' | 'completed';
        status?: (typeof ORDER_STATUSES)[number];
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
      };
      const listed = await listVendorOrders(vendorId, {
        bucket: query.bucket,
        status: query.status,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        page: query.page,
        limit: query.limit,
      });
      if (query.page) {
        const totalPages = Math.max(1, Math.ceil(listed.total / listed.limit));
        res.json(
          successResponse({
            items: listed.items,
            page: listed.page,
            limit: listed.limit,
            total: listed.total,
            totalPages,
          }),
        );
        return;
      }
      res.json(successResponse(listed.items));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get('/orders/:id', authenticate, requireVendorLogin, async (req, res, next) => {
  try {
    const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
    const detail = await getVendorOrderDetail(vendorId, String(req.params.id));
    res.json(successResponse(detail));
  } catch (err) {
    next(err);
  }
});

vendorPortalRouter.patch(
  '/orders/:id/status',
  authenticate,
  requireVendorLogin,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      status: z.enum(ORDER_STATUSES),
      reason: z.string().trim().max(300).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
      const vo = await updateVendorOrderStatusForVendor(
        vendorId,
        String(req.params.id),
        req.body.status,
        req.auth!.sub,
        req.body.reason,
      );
      res.json(successResponse(vo));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get('/me/earnings', authenticate, requireVendorLogin, async (req, res, next) => {
  try {
    const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
    const earnings = await getVendorEarnings(vendorId);
    res.json(successResponse(earnings));
  } catch (err) {
    next(err);
  }
});

vendorPortalRouter.get(
  '/staff',
  authenticate,
  requirePermissions('vendor.read'),
  async (_req, res, next) => {
    try {
      res.json(successResponse(await listVendorStaffAccounts()));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.post(
  '/staff',
  authenticate,
  requirePermissions('vendor.create'),
  validate({
    body: z.object({
      vendorId: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      approve: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const created = await createVendorStaff(req.body);
      res.status(201).json(
        successResponse({
          id: created.staff._id,
          vendorId: created.vendor._id,
          email: created.user.email,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.patch(
  '/staff/:id',
  authenticate,
  requirePermissions('vendor.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      acceptingOrders: z.boolean().optional(),
      isActive: z.boolean().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      rejectionReason: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const staff = await updateVendorStaffAccount(String(req.params.id), req.body);
      res.json(successResponse(staff));
    } catch (err) {
      next(err);
    }
  },
);
