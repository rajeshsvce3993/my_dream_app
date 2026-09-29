import type { RequestHandler } from 'express';
import { randomUUID } from 'crypto';

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
};
