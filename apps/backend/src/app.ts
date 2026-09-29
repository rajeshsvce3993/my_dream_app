import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env, corsOrigins } from './config/env.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { requestIdMiddleware } from './common/middleware/requestId.js';
import { logger } from './infrastructure/logging/logger.js';
import { createApiRouter } from './routes/index.js';
import { openApiDocument } from './openapi/document.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  const requestLogger: RequestHandler = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info({
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  };
  app.use(requestLogger);

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    const { getDatabaseReady } = await import('./infrastructure/database/connection.js');
    const { getRedisReady } = await import('./infrastructure/cache/redis.js');
    const ready = getDatabaseReady() && getRedisReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      database: getDatabaseReady(),
      redis: getRedisReady(),
    });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(env.API_PREFIX, createApiRouter());
  app.use(errorHandler);

  return app;
}
