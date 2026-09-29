import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate } from '../auth/auth.middleware.js';
import { createCustomerAddress, listCustomerAddresses } from './customer.service.js';

export const customerRouter = Router();

const addressSchema = z.object({
  fullName: z.string().min(2).max(100),
  line1: z.string().min(2).max(120),
  line2: z.string().min(2).max(120),
  landmark: z.string().max(120).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().max(100).optional(),
  lng: z.number().optional(),
  lat: z.number().optional(),
  phone: z.string().max(20).optional(),
  addressType: z.enum(['home', 'work', 'other']).optional(),
  deliveryInstructions: z.string().max(300).optional(),
  label: z.string().max(50).optional(),
});

customerRouter.get('/me/addresses', authenticate, async (req, res, next) => {
  try {
    const addresses = await listCustomerAddresses(req.auth!.sub);
    res.json(successResponse(addresses));
  } catch (err) {
    next(err);
  }
});

customerRouter.post(
  '/me/addresses',
  authenticate,
  validate({ body: addressSchema }),
  async (req, res, next) => {
    try {
      const address = await createCustomerAddress({
        userId: req.auth!.sub,
        ...req.body,
      });
      res.status(201).json(successResponse(address));
    } catch (err) {
      next(err);
    }
  },
);
