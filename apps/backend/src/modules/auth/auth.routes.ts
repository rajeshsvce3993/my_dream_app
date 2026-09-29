import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate } from './auth.middleware.js';
import { loginUser, refreshTokens, registerUser, revokeSession, getUserById } from './auth.service.js';
import { loginOrRegisterWithOtp } from './auth.otp.service.js';
import { requestOtp } from '../otp/otp.service.js';
import { maskPhone } from '../otp/phone.util.js';
import { CustomerModel } from '../customers/customer.model.js';
import { customerHasSavedAddress } from '../customers/customer.service.js';
import { resolveCustomerDisplayName } from '../customers/customerProfile.service.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const user = await registerUser(req.body);
      res.status(201).json(
        successResponse(
          {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          'Registration successful',
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

const otpRequestSchema = z.object({
  phone: z.string().min(8).max(20),
});

const otpVerifySchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().min(4).max(8),
});

authRouter.post('/otp/request', validate({ body: otpRequestSchema }), async (req, res, next) => {
  try {
    const result = await requestOtp(req.body.phone);
    res.json(
      successResponse(
        {
          phone: result.phone,
          maskedPhone: maskPhone(result.phone),
          resendInSeconds: result.resendInSeconds,
          expirySeconds: result.expirySeconds,
          otpLength: result.otpLength,
        },
        'OTP sent',
      ),
    );
  } catch (err) {
    next(err);
  }
});

authRouter.post('/otp/verify', validate({ body: otpVerifySchema }), async (req, res, next) => {
  try {
    const { user, tokens, needsAddress, isNewUser } = await loginOrRegisterWithOtp({
      phone: req.body.phone,
      otp: req.body.otp,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    const displayName = await resolveCustomerDisplayName(user._id.toString());
    res.json(
      successResponse({
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName,
          phone: user.phone,
          phoneVerified: user.phoneVerified,
        },
        tokens,
        needsAddress,
        isNewUser,
      }),
    );
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { user, tokens } = await loginUser(
      req.body.email,
      req.body.password,
      req.headers['user-agent'],
      req.ip,
    );
    res.json(
      successResponse({
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        tokens,
      }),
    );
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tokens = await refreshTokens(req.body.refreshToken);
      res.json(successResponse(tokens));
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    await revokeSession(req.auth!.sub);
    res.json(successResponse(null, 'Logged out'));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await getUserById(req.auth!.sub);
    const customer = await CustomerModel.findOne({ userId: user._id });
    const hasSavedAddress = customer
      ? await customerHasSavedAddress(customer._id.toString())
      : false;
    const displayName = await resolveCustomerDisplayName(user._id.toString());
    res.json(
      successResponse({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        hasSavedAddress,
        roles: req.auth!.roles,
        permissions: req.auth!.permissions,
      }),
    );
  } catch (err) {
    next(err);
  }
});
