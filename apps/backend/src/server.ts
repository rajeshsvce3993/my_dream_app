import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './infrastructure/database/connection.js';
import { connectRedis, disconnectRedis } from './infrastructure/cache/redis.js';
import { logger } from './infrastructure/logging/logger.js';
import { registerNotificationHandlers } from './modules/notifications/notification.service.js';
import { startDeliveryDispatchLoop } from './modules/delivery/deliveryDispatch.service.js';

async function bootstrap() {
  await connectDatabase();
  try {
    await connectRedis();
  } catch {
    await disconnectRedis();
    logger.warn('Redis unavailable — continuing without cache');
  }

  registerNotificationHandlers();
  startDeliveryDispatchLoop();

  const app = createApp();
  app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT, prefix: env.API_PREFIX }, 'API server started');
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
