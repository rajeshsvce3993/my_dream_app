import type { RequestHandler } from 'express';
import { AuthenticationError, AuthorizationError } from '../../common/errors/AppError.js';
import type { JwtAccessPayload } from './auth.types.js';
import { verifyAccessToken } from './auth.service.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtAccessPayload;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AuthenticationError());
  }
  const token = header.slice(7);
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export function requirePermissions(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    const hasAll = required.every((p) => req.auth!.permissions.includes(p));
    if (!hasAll) return next(new AuthorizationError());
    next();
  };
}

export function requireAnyRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    const ok = roles.some((r) => req.auth!.roles.includes(r));
    if (!ok) return next(new AuthorizationError());
    next();
  };
}
