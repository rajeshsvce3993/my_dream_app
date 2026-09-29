import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate } from '../auth/auth.middleware.js';
import { addToCart, getCartForUser, recalculateCart } from './cart.service.js';
import { CartModel } from './cart.model.js';
import { getOrCreateCustomerId } from './cart.service.js';

export const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.get('/', async (req, res, next) => {
  try {
    const cart = await getCartForUser(req.auth!.sub);
    const calculated = await recalculateCart(cart._id.toString());
    res.json(successResponse(calculated));
  } catch (err) {
    next(err);
  }
});

cartRouter.post(
  '/items',
  validate({
    body: z
      .object({
        vendorId: z.string().min(1).optional(),
        productId: z.string().min(1),
        variantId: z.string().min(1),
        vendorProductId: z.string().min(1).optional(),
        quantity: z.number().int().min(1),
        lng: z.number().optional(),
        lat: z.number().optional(),
        deferAvailability: z.boolean().optional(),
      })
      .refine((b) => Boolean(b.deferAvailability) || Boolean(b.vendorId), {
        message: 'vendorId is required unless deferAvailability is true',
      }),
  }),
  async (req, res, next) => {
    try {
      const cart = await addToCart({ userId: req.auth!.sub, ...req.body });
      const calculated = await recalculateCart(cart._id.toString());
      res.status(201).json(successResponse(calculated));
    } catch (err) {
      next(err);
    }
  },
);

cartRouter.patch(
  '/items/:variantId',
  validate({
    params: z.object({ variantId: z.string().min(1) }),
    body: z.object({ vendorId: z.string().min(1), quantity: z.number().int().min(0) }),
  }),
  async (req, res, next) => {
    try {
      const customerId = await getOrCreateCustomerId(req.auth!.sub);
      const cart = await CartModel.findOne({ customerId });
      if (!cart) {
        res.json(successResponse({ items: [] }));
        return;
      }
      const idx = cart.items.findIndex(
        (i) =>
          i.variantId.toString() === req.params.variantId &&
          i.vendorId.toString() === req.body.vendorId,
      );
      if (idx >= 0) {
        if (req.body.quantity === 0) cart.items.splice(idx, 1);
        else cart.items[idx].quantity = req.body.quantity;
      }
      await cart.save();
      const calculated = await recalculateCart(cart._id.toString());
      res.json(successResponse(calculated));
    } catch (err) {
      next(err);
    }
  },
);
