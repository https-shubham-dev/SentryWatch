import Redis from 'ioredis';
import { redisConnectionOptions } from '../../config/redis.js';
import { THRESHOLDS } from '../../config/thresholds.js';
import { CheckMetrics } from './detection.js';

const redis = new Redis(redisConnectionOptions);

export function getRollingKey(apiId: string): string {
  return `rolling:${apiId}`;
}

export function getConsecutiveKey(apiId: string): string {
  return `consecutive_anomaly:${apiId}`;
}

/**
 * Appends a check metric to the Redis rolling window and trims to ROLLING_WINDOW_SIZE (20).
 */
export async function addCheckToRollingWindow(apiId: string, check: CheckMetrics): Promise<void> {
  try {
    const key = getRollingKey(apiId);
    const payload = JSON.stringify({
      passed: check.passed,
      latencyMs: check.latencyMs,
      executedAt: check.executedAt || new Date().toISOString(),
    });

    await redis.rpush(key, payload);
    await redis.ltrim(key, -THRESHOLDS.ROLLING_WINDOW_SIZE, -1);
  } catch (err) {
    console.error(`[RollingWindow] Error pushing check metric for API ${apiId}:`, err);
  }
}

/**
 * Retrieves all recent check metrics from Redis rolling window for anomaly detection.
 */
export async function getRollingWindowChecks(apiId: string): Promise<CheckMetrics[]> {
  try {
    const key = getRollingKey(apiId);
    const rawItems = await redis.lrange(key, 0, -1);
    return rawItems.map((item) => JSON.parse(item) as CheckMetrics);
  } catch (err) {
    console.error(`[RollingWindow] Error fetching rolling metrics for API ${apiId}:`, err);
    return [];
  }
}

/**
 * Manages the consecutive anomaly counter for the 2-cycle guard (requirements.md §5).
 */
export async function getConsecutiveAnomalyCount(apiId: string): Promise<number> {
  try {
    const val = await redis.get(getConsecutiveKey(apiId));
    return val ? parseInt(val, 10) : 0;
  } catch (_err) {
    return 0;
  }
}

export async function incrementConsecutiveAnomalyCount(apiId: string): Promise<number> {
  try {
    return await redis.incr(getConsecutiveKey(apiId));
  } catch (_err) {
    return 1;
  }
}

export async function resetConsecutiveAnomalyCount(apiId: string): Promise<void> {
  try {
    await redis.del(getConsecutiveKey(apiId));
  } catch (_err) {
    // Ignore error
  }
}
