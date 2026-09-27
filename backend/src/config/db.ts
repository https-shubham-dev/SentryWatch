import mongoose from 'mongoose';
import { ENV } from './env.js';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.info(`[MongoDB] Connected to database at ${ENV.MONGODB_URI}`);
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
