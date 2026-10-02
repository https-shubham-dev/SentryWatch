import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../config/redis.js';
import { ENV } from '../config/env.js';

/**
 * 5 req/min per IP on /auth/login and /auth/signup (api.md).
 * Key includes req.path so login and signup have separate buckets, while
 * /api/v1/auth/login and /api/auth/login share a bucket (same router path).
 * Redis store in non-test envs for multi-instance; MemoryStore under Jest.
 */
function buildAuthStore() {
  if (ENV.NODE_ENV === 'test') {
    return undefined; // express-rate-limit default MemoryStore
  }

  const client = new Redis({
    ...redisConnectionOptions,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  return new RedisStore({
    prefix: 'rl:auth:',
    // ioredis call() expects (command, ...args); cast keeps rate-limit-redis typings happy
    sendCommand: ((...args: string[]) =>
      client.call(args[0], ...args.slice(1))) as (
      ...args: string[]
    ) => Promise<RedisReply>,
  });
}

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildAuthStore(),
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
