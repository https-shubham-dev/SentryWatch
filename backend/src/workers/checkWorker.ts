import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnectionOptions } from '../config/redis.js';
import { CHECK_QUEUE_NAME } from './scheduler.js';
import { Api } from '../models/Api.js';
import { Check, CheckErrorType } from '../models/Check.js';

interface CheckJobData {
  apiId: string;
  organizationId: string;
}

/**
 * Worker process executing scheduled HTTP health checks against registered APIs.
 */
export function startCheckWorker(): Worker {
  const worker = new Worker<CheckJobData>(
    CHECK_QUEUE_NAME,
    async (job: Job<CheckJobData>) => {
      const { apiId } = job.data;

      const api = await Api.findById(apiId);
      if (!api || !api.enabled) {
        console.info(`[Worker] Skipping disabled or missing API (${apiId})`);
        return;
      }

      // Compute deterministic scheduledTime rounded to job interval boundary for idempotency key
      const now = new Date();
      const intervalMs = api.checkIntervalSeconds * 1000;
      const scheduledTimestamp = Math.floor(now.getTime() / intervalMs) * intervalMs;
      const scheduledTime = new Date(scheduledTimestamp);

      let statusCode: number | null = null;
      let passed = false;
      let latencyMs: number | null = null;
      let errorType: CheckErrorType = null;

      const startTime = Date.now();

      try {
        const response = await axios({
          method: api.method,
          url: api.url,
          headers: api.headers || {},
          timeout: 10000, // Fixed 10s timeout - requirements.md §3
          validateStatus: () => true, // Capture all HTTP status codes
        });

        latencyMs = Date.now() - startTime;
        statusCode = response.status;
        passed = statusCode === api.expectedStatus;
      } catch (err: any) {
        passed = false;
        statusCode = null;
        latencyMs = null;

        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          errorType = 'timeout';
        } else {
          errorType = 'network';
        }
      }

      // Idempotency-safe write to Check collection using compound unique index key { apiId, scheduledTime }
      try {
        await Check.updateOne(
          { apiId: api._id, scheduledTime },
          {
            $setOnInsert: {
              organizationId: api.organizationId,
              executedAt: now,
              statusCode,
              passed,
              latencyMs,
              errorType,
              contractViolation: false,
            },
          },
          { upsert: true },
        );
      } catch (err: any) {
        // If duplicate key error occurs due to concurrent execution, log and proceed gracefully
        if (err.code === 11000) {
          console.warn(`[Worker] Idempotency guard activated: Check already exists for API ${apiId} at ${scheduledTime.toISOString()}`);
        } else {
          throw err;
        }
      }

      // Denormalized currentStatus update on API document (database.md §8)
      const nextStatus = passed ? 'ok' : 'critical';
      if (api.currentStatus !== nextStatus) {
        api.currentStatus = nextStatus;
        await api.save();
      }

      console.info(
        `[Worker] Check completed for API "${api.name}" (${apiId}): status=${statusCode ?? errorType}, passed=${passed}, latency=${latencyMs}ms`,
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}
