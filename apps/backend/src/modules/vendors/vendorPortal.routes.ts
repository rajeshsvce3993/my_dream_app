import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate, requireAnyRole, requirePermissions } from '../auth/auth.middleware.js';
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
} from './vendorStaffAccess.service.js';
import {
  createVendorStaff,
  listVendorStaffAccounts,
  updateVendorStaffAccount,
} from './vendorStaffAdmin.service.js';

export const vendorPortalRouter = Router();

vendorPortalRouter.get('/me', authenticate, requireAnyRole('VENDOR'), async (req, res, next) => {
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
  requireAnyRole('VENDOR'),
  validate({ body: z.object({ acceptingOrders: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const staff = await getVendorStaffByUserId(req.auth!.sub);
      if (staff.approvalStatus !== 'APPROVED') {
        res.status(403).json({ success: false, error: { message: 'Not approved' } });
        return;
      }
      staff.acceptingOrders = req.body.acceptingOrders;
      await staff.save();
      res.json(successResponse({ acceptingOrders: staff.acceptingOrders }));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get('/products', authenticate, requireAnyRole('VENDOR'), async (req, res, next) => {
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
  requireAnyRole('VENDOR'),
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

vendorPortalRouter.get('/orders', authenticate, requireAnyRole('VENDOR'), async (req, res, next) => {
  try {
    const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
    const bucket = req.query.bucket as 'new' | 'active' | 'completed' | undefined;
    const items = await listVendorOrders(vendorId, bucket);
    res.json(successResponse(items));
  } catch (err) {
    next(err);
  }
});

vendorPortalRouter.get('/orders/:id', authenticate, requireAnyRole('VENDOR'), async (req, res, next) => {
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
  requireAnyRole('VENDOR'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ status: z.enum(ORDER_STATUSES) }),
  }),
  async (req, res, next) => {
    try {
      const { vendorId } = await requireOperationalVendorStaff(req.auth!.sub);
      const vo = await updateVendorOrderStatusForVendor(
        vendorId,
        String(req.params.id),
        req.body.status,
        req.auth!.sub,
      );
      res.json(successResponse(vo));
    } catch (err) {
      next(err);
    }
  },
);

vendorPortalRouter.get('/me/earnings', authenticate, requireAnyRole('VENDOR'), async (req, res, next) => {
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
