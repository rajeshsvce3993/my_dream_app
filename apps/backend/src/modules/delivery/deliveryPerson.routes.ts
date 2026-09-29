import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate, requireAnyRole, requirePermissions } from '../auth/auth.middleware.js';
import { OrderModel } from '../orders/order.model.js';
import {
  acceptOffer,
  markDelivered,
  markPickedUp,
  rejectOffer,
} from './deliveryAssignment.service.js';
import { setAvailability, touchLastSeen, getDeliveryPersonByUserId } from './deliveryAvailability.service.js';
import { loadOfferCard } from './deliveryDispatch.service.js';
import { getEarnings, listDeliveryHistory } from './deliveryEarnings.service.js';
import { createDeliveryPerson, listDeliveryPeople, updateDeliveryPerson } from './deliveryPersonAdmin.service.js';

export const deliveryPersonRouter = Router();

deliveryPersonRouter.get('/me', authenticate, requireAnyRole('DELIVERY'), async (req, res, next) => {
  try {
    await touchLastSeen(req.auth!.sub);
    const person = await getDeliveryPersonByUserId(req.auth!.sub);
    const offer = await loadOfferCard(person._id.toString());
    const active = person.activeOrderId
      ? await OrderModel.findById(person.activeOrderId)
          .select('orderNumber status deliveryAddress grandTotal currency deliveryEarning shippingTotal')
          .lean()
      : null;
    res.json(
      successResponse({
        availability: person.availability,
        approvalStatus: person.approvalStatus,
        onboardingComplete: person.onboardingComplete,
        lastSeenAt: person.lastSeenAt,
        activeOrder: active,
        offer,
      }),
    );
  } catch (err) {
    next(err);
  }
});

deliveryPersonRouter.post(
  '/me/availability',
  authenticate,
  requireAnyRole('DELIVERY'),
  validate({ body: z.object({ availability: z.enum(['ONLINE', 'OFFLINE']) }) }),
  async (req, res, next) => {
    try {
      const person = await setAvailability(req.auth!.sub, req.body.availability);
      res.json(successResponse({ availability: person.availability, lastSeenAt: person.lastSeenAt }));
    } catch (err) {
      next(err);
    }
  },
);

deliveryPersonRouter.post(
  '/offers/:offerId/accept',
  authenticate,
  requireAnyRole('DELIVERY'),
  validate({ params: z.object({ offerId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const result = await acceptOffer(req.auth!.sub, String(req.params.offerId));
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },
);

deliveryPersonRouter.post(
  '/offers/:offerId/reject',
  authenticate,
  requireAnyRole('DELIVERY'),
  validate({ params: z.object({ offerId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const offer = await rejectOffer(req.auth!.sub, String(req.params.offerId));
      res.json(successResponse(offer));
    } catch (err) {
      next(err);
    }
  },
);

deliveryPersonRouter.post('/me/pickup', authenticate, requireAnyRole('DELIVERY'), async (req, res, next) => {
  try {
    const order = await markPickedUp(req.auth!.sub);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

deliveryPersonRouter.post('/me/deliver', authenticate, requireAnyRole('DELIVERY'), async (req, res, next) => {
  try {
    const order = await markDelivered(req.auth!.sub);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

deliveryPersonRouter.get('/me/earnings', authenticate, requireAnyRole('DELIVERY'), async (req, res, next) => {
  try {
    res.json(successResponse(await getEarnings(req.auth!.sub)));
  } catch (err) {
    next(err);
  }
});

deliveryPersonRouter.get('/me/history', authenticate, requireAnyRole('DELIVERY'), async (req, res, next) => {
  try {
    res.json(successResponse(await listDeliveryHistory(req.auth!.sub)));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  vehicleType: z.string().max(40).optional(),
  approve: z.boolean().optional(),
});

deliveryPersonRouter.get(
  '/persons',
  authenticate,
  requirePermissions('order.read'),
  async (_req, res, next) => {
    try {
      res.json(successResponse(await listDeliveryPeople()));
    } catch (err) {
      next(err);
    }
  },
);

deliveryPersonRouter.post(
  '/persons',
  authenticate,
  requirePermissions('order.update'),
  validate({ body: createSchema }),
  async (req, res, next) => {
    try {
      const created = await createDeliveryPerson(req.body);
      res.status(201).json(
        successResponse({
          id: created.person._id,
          userId: created.user._id,
          email: created.user.email,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

deliveryPersonRouter.patch(
  '/persons/:id',
  authenticate,
  requirePermissions('order.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      onboardingComplete: z.boolean().optional(),
      isActive: z.boolean().optional(),
      vehicleType: z.string().max(40).optional(),
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().max(100).optional(),
      rejectionReason: z.string().max(300).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const person = await updateDeliveryPerson(String(req.params.id), req.body);
      res.json(successResponse(person));
    } catch (err) {
      next(err);
    }
  },
);
