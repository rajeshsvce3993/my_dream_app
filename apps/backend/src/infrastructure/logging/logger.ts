import pino from 'pino';
import { env } from '../../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'refreshToken'],
    remove: true,
  },
});
