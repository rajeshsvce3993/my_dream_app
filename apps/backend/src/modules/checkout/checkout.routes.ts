import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate } from '../auth/auth.middleware.js';
import { checkout } from './checkout.service.js';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/',
  authenticate,
  validate({
    body: z.object({
      idempotencyKey: z.string().uuid(),
      paymentMethod: z.enum(['COD', 'RAZORPAY', 'STRIPE']).default('COD'),
      deliveryAddress: z.object({
        line1: z.string().min(1),
        line2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().min(1),
        lng: z.number().optional(),
        lat: z.number().optional(),
      }),
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await checkout({
        userId: req.auth!.sub,
        ...req.body,
      });
      res.status(result.duplicate ? 200 : 201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },
);
