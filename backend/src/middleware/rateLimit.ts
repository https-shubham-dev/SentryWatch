import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../config/redis.js';
import { ENV } from '../config/env.js';

function buildStore(prefix: string) {
  if (ENV.NODE_ENV === 'test') {
    return undefined; // express-rate-limit default MemoryStore
  }

  const client = new Redis({
    ...redisConnectionOptions,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  return new RedisStore({
    prefix,
    sendCommand: ((...args: string[]) =>
      client.call(args[0], ...args.slice(1))) as (
      ...args: string[]
    ) => Promise<RedisReply>,
  });
}

/**
 * 5 req/min per IP on /auth/login and /auth/signup (api.md).
 * Key includes req.path so login and signup have separate buckets, while
 * dual mounts share a bucket (same router path).
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('rl:auth:'),
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? 'unknown')}:${req.path}`,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login/signup attempts. Try again in a minute.',
      },
    });
  },
});

/**
 * 100 req/min on authenticated API routes (api.md).
 * Keys by userId when JWT payload is present on the request, else IP.
 * Applied after authenticate middleware so req.user is available.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('rl:api:'),
  keyGenerator: (req) => {
    const userId = req.user?.userId;
    if (userId) {
      return `user:${userId}`;
    }
    return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again in a minute.',
      },
    });
  },
});
