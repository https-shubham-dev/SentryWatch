import Redis from 'ioredis';
import { redisConnectionOptions } from '../../config/redis.js';
import { TooManyRequestsError } from '../../middleware/errorHandler.js';

const redis = new Redis({
  ...redisConnectionOptions,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_TTL_SECONDS = 15 * 60;

function failKey(email: string): string {
  return `auth:fail:${email.toLowerCase()}`;
}

function lockKey(email: string): string {
  return `auth:lock:${email.toLowerCase()}`;
}

/**
 * Reject login if this email is currently locked after consecutive failures.
 * Fails open if Redis is unreachable (log + allow) so a cache outage doesn't
 * brick authentication — IP rate limiting still applies.
 */
export async function assertNotLocked(email: string): Promise<void> {
  try {
    const ttl = await redis.ttl(lockKey(email));
    if (ttl > 0) {
      const minutes = Math.max(1, Math.ceil(ttl / 60));
      throw new TooManyRequestsError(
        `Account temporarily locked due to too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }
  } catch (err) {
    if (err instanceof TooManyRequestsError) {
      throw err;
    }
    console.error('[LoginLockout] Redis error during lock check:', err);
  }
}

/**
 * Increment failed-attempt counter; lock the account for 15 minutes at threshold.
 */
export async function recordFailedLogin(email: string): Promise<void> {
  try {
    const key = failKey(email);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, LOCKOUT_TTL_SECONDS);
    }
    if (count >= MAX_FAILED_ATTEMPTS) {
      await redis.set(lockKey(email), '1', 'EX', LOCKOUT_TTL_SECONDS);
      await redis.del(key);
    }
  } catch (err) {
    console.error('[LoginLockout] Redis error recording failed login:', err);
  }
}

/**
 * Clear failure + lock keys after a successful login.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await redis.del(failKey(email), lockKey(email));
  } catch (err) {
    console.error('[LoginLockout] Redis error clearing login failures:', err);
  }
}
