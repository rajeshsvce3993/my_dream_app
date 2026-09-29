import { Router } from 'express';
import { successResponse, paginatedMeta } from '../../common/types/api.js';
import { authenticate } from '../auth/auth.middleware.js';
import { listUserNotifications } from './notification.service.js';

export const notificationRouter = Router();

notificationRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { items, total } = await listUserNotifications(req.auth!.sub, page, limit);
    res.json(successResponse(items, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});
