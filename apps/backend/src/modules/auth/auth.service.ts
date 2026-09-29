import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import type { AuthTokens, JwtAccessPayload, JwtRefreshPayload } from './auth.types.js';
import { SessionModel } from '../users/session.model.js';
import { UserModel, type IUserDocument } from '../users/user.model.js';
import { RoleModel } from '../users/role.model.js';
import { resolveCustomerDisplayName } from '../customers/customerProfile.service.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function resolveUserAuthContext(user: IUserDocument): Promise<{ roles: string[]; permissions: string[] }> {
  const roles = await RoleModel.find({ _id: { $in: user.roleIds }, isActive: true }).lean();
  const roleCodes = roles.map((r) => r.code);
  const permissionSet = new Set<string>();
  for (const role of roles) {
    for (const p of role.permissionCodes) {
      permissionSet.add(p);
    }
  }
  if (user.extraPermissionCodes?.length) {
    for (const p of user.extraPermissionCodes) permissionSet.add(p);
  }
  return { roles: roleCodes, permissions: [...permissionSet] };
}

function signAccessToken(
  user: IUserDocument,
  roles: string[],
  permissions: string[],
  displayName: string,
): string {
  const payload: JwtAccessPayload = {
    sub: user._id.toString(),
    email: user.email,
    type: 'access',
    roles,
    permissions,
    displayName,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

function signRefreshToken(userId: string, sessionId: string): string {
  const payload: JwtRefreshPayload = {
    sub: userId,
    sessionId,
    type: 'refresh',
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export async function createSession(user: IUserDocument, userAgent?: string, ip?: string): Promise<AuthTokens> {
  const { roles, permissions } = await resolveUserAuthContext(user);
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken(user._id.toString(), sessionId);
  const refreshExpiresMs = parseDurationMs(env.JWT_REFRESH_EXPIRES_IN);
  await SessionModel.create({
    userId: user._id,
    sessionId,
    refreshTokenHash: await hashPassword(refreshToken),
    userAgent,
    ip,
    expiresAt: new Date(Date.now() + refreshExpiresMs),
  });
  const displayName = await resolveCustomerDisplayName(user._id.toString());
  const accessToken = signAccessToken(user, roles, permissions, displayName);
  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 86_400_000);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    if (payload.type !== 'access') throw new AuthenticationError('Invalid token type');
    return payload;
  } catch {
    throw new AuthenticationError('Invalid or expired access token');
  }
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload: JwtRefreshPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
    if (payload.type !== 'refresh') throw new AuthenticationError('Invalid token type');
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  const session = await SessionModel.findOne({
    userId: payload.sub,
    sessionId: payload.sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('+refreshTokenHash');
  if (!session) throw new AuthenticationError('Session not found');

  const valid = await verifyPassword(refreshToken, session.refreshTokenHash);
  if (!valid) {
    await SessionModel.updateOne({ _id: session._id }, { revokedAt: new Date() });
    throw new AuthenticationError('Invalid refresh token');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive) throw new AuthenticationError('User inactive');

  session.revokedAt = new Date();
  await session.save();

  return createSession(user);
}

export async function revokeSession(userId: string, sessionId?: string): Promise<void> {
  const filter: Record<string, unknown> = { userId, revokedAt: null };
  if (sessionId) filter.sessionId = sessionId;
  await SessionModel.updateMany(filter, { revokedAt: new Date() });
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  roleCodes?: string[];
}): Promise<IUserDocument> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');

  let roleIds: typeof UserModel.prototype.roleIds = [];
  if (input.roleCodes?.length) {
    const roles = await RoleModel.find({ code: { $in: input.roleCodes }, isActive: true });
    roleIds = roles.map((r) => r._id);
  } else {
    const customerRole = await RoleModel.findOne({ code: 'CUSTOMER' });
    if (customerRole) roleIds = [customerRole._id];
  }

  const passwordHash = await hashPassword(input.password);
  return UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    roleIds,
    isActive: true,
    emailVerified: false,
  });
}

export async function loginUser(email: string, password: string, userAgent?: string, ip?: string): Promise<{ user: IUserDocument; tokens: AuthTokens }> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) throw new AuthenticationError('Invalid credentials');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AuthenticationError('Invalid credentials');
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await createSession(user, userAgent, ip);
  return { user, tokens };
}

export async function getUserById(id: string): Promise<IUserDocument> {
  const user = await UserModel.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}
