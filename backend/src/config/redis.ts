import { RedisOptions } from 'ioredis';
import { ENV } from './env.js';

export const redisConnectionOptions: RedisOptions = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD,
  tls: ENV.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
