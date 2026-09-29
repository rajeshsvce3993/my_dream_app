import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  isConnected = true;
  logger.info('MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

export function getDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
