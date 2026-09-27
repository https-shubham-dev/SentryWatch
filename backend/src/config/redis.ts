import { RedisOptions } from 'ioredis';
import { ENV } from './env.js';

export const redisConnectionOptions: RedisOptions = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
