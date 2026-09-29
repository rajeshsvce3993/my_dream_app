import mongoose from 'mongoose';
import { env } from '../../config/env.js';

/**
 * Runs checkout-style work in a transaction when the deployment supports it (replica set / mongos).
 * Local standalone MongoDB skips transactions — pass `null` session to callers.
 */
export async function withMongoTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>,
): Promise<T> {
  if (!env.MONGODB_USE_TRANSACTIONS) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
