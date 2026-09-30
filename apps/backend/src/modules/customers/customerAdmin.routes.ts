import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../common/errors/AppError.js';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { RoleModel } from '../users/role.model.js';
import { UserModel } from '../users/user.model.js';
import { CustomerModel } from './customer.model.js';
import { customerHasSavedAddress } from './customer.service.js';

export const customerAdminRouter = Router();

customerAdminRouter.get(
  '/',
  authenticate,
  requirePermissions('order.read'),
  async (_req, res, next) => {
    try {
      const customerRole = await RoleModel.findOne({ code: 'CUSTOMER' }).lean();
      if (!customerRole) {
        res.json(successResponse([]));
        return;
      }

      const users = await UserModel.find({ roleIds: customerRole._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .select('firstName lastName email phone isActive phoneVerified createdAt lastLoginAt')
        .lean();

      const customerDocs = await CustomerModel.find({
        userId: { $in: users.map((u) => u._id) },
      })
        .select('userId')
        .lean();
      const customerByUser = new Map(customerDocs.map((c) => [c.userId.toString(), c]));

      const rows = await Promise.all(
        users.map(async (u) => {
          const customer = customerByUser.get(u._id.toString());
          const hasAddress = customer
            ? await customerHasSavedAddress(customer._id.toString())
            : false;
          return {
            id: u._id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            isActive: u.isActive,
            phoneVerified: u.phoneVerified,
            hasSavedAddress: hasAddress,
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt,
          };
        }),
      );

      res.json(successResponse(rows));
    } catch (err) {
      next(err);
    }
  },
);

customerAdminRouter.patch(
  '/:userId',
  authenticate,
  requirePermissions('order.update'),
  validate({
    params: z.object({ userId: z.string().min(1) }),
    body: z.object({
      isActive: z.boolean().optional(),
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().max(100).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const customerRole = await RoleModel.findOne({ code: 'CUSTOMER' }).lean();
      if (!customerRole) throw new NotFoundError('Customer role missing');

      const user = await UserModel.findOne({
        _id: req.params.userId,
        roleIds: customerRole._id,
      });
      if (!user) throw new NotFoundError('Customer not found');

      if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
      if (req.body.firstName !== undefined) user.firstName = req.body.firstName;
      if (req.body.lastName !== undefined) user.lastName = req.body.lastName;
      await user.save();

      res.json(
        successResponse({
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          isActive: user.isActive,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);
