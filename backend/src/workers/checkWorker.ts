import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnectionOptions } from '../config/redis.js';
import { CHECK_QUEUE_NAME } from './scheduler.js';
import { Api } from '../models/Api.js';
import { Check, CheckErrorType } from '../models/Check.js';
import { Incident } from '../models/Incident.js';
import { detectAnomaly } from '../modules/anomaly/detection.js';
import {
  addCheckToRollingWindow,
  getRollingWindowChecks,
  incrementConsecutiveAnomalyCount,
  resetConsecutiveAnomalyCount,
} from '../modules/anomaly/rollingWindow.js';
import { publishSystemEvent } from '../sockets/redisPubSub.js';

interface CheckJobData {
  apiId: string;
  organizationId: string;
}

/**
 * Worker process executing scheduled HTTP health checks against registered APIs,
 * running anomaly detection, maintaining Redis rolling stats, managing incidents,
 * and emitting real-time events via Redis Pub/Sub.
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

      // 1. Write Check document (Idempotency Key: apiId + scheduledTime)
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
        if (err.code === 11000 || err.message?.includes('E11000')) {
          console.warn(
            `[Worker] Idempotency guard activated: Check already exists for API ${apiId} at ${scheduledTime.toISOString()}`,
          );
        } else {
          throw err;
        }
      }

      // 2. Fetch rolling window metrics from Redis prior to this check
      const priorRollingChecks = await getRollingWindowChecks(apiId);

      const currentCheckMetric = {
        passed,
        latencyMs,
        executedAt: now,
      };

      // Update Redis rolling window with latest check
      await addCheckToRollingWindow(apiId, currentCheckMetric);

      // 3. Run pure anomaly detection (rules.md §6)
      const anomalyResult = detectAnomaly(priorRollingChecks, currentCheckMetric);

      // Helper for status change emission
      const setAndEmitApiStatus = async (newStatus: 'ok' | 'warn' | 'critical') => {
        if (api.currentStatus !== newStatus) {
          api.currentStatus = newStatus;
          await api.save();

          await publishSystemEvent({
            type: 'api:status_changed',
            organizationId: api.organizationId.toString(),
            payload: {
              id: api._id.toString(),
              name: api.name,
              currentStatus: newStatus,
              updatedAt: api.updatedAt.toISOString(),
            },
          });
        }
      };

      // 4. Workflow 3 Lifecycle & Status Guard Logic
      if (!anomalyResult.isAnomaly) {
        await resetConsecutiveAnomalyCount(apiId);

        const openIncident = await Incident.findOne({
          apiId: api._id,
          status: { $ne: 'resolved' },
        });

        const recent5 = [...priorRollingChecks, currentCheckMetric].slice(-5);
        const failedInRecent5 = recent5.filter((c) => !c.passed).length;

        if (!openIncident) {
          if (failedInRecent5 >= 2) {
            await setAndEmitApiStatus('warn');
          } else if (failedInRecent5 < 2) {
            await setAndEmitApiStatus('ok');
          }
        }
      } else {
        const consecutiveCount = await incrementConsecutiveAnomalyCount(apiId);

        if (consecutiveCount === 1) {
          await setAndEmitApiStatus('warn');
        } else if (consecutiveCount >= 2) {
          const existingIncident = await Incident.findOne({
            apiId: api._id,
            status: { $ne: 'resolved' },
          });

          if (existingIncident) {
            existingIncident.events.push({
              status: existingIncident.status,
              timestamp: now,
              triggeredBy: 'system',
            });
            await existingIncident.save();

            await publishSystemEvent({
              type: 'incident:updated',
              organizationId: api.organizationId.toString(),
              payload: existingIncident,
            });
          } else {
            const newIncident = new Incident({
              apiId: api._id,
              organizationId: api.organizationId,
              status: 'detected',
              severity: anomalyResult.severity,
              reason: anomalyResult.reason,
              detectedAt: now,
              events: [
                {
                  status: 'detected',
                  timestamp: now,
                  triggeredBy: 'system',
                },
              ],
            });
            await newIncident.save();

            await publishSystemEvent({
              type: 'incident:created',
              organizationId: api.organizationId.toString(),
              payload: newIncident,
            });
          }

          await setAndEmitApiStatus('critical');
        }
      }

      console.info(
        `[Worker] Check completed for API "${api.name}" (${apiId}): status=${statusCode ?? errorType}, passed=${passed}, latency=${latencyMs}ms, currentStatus=${api.currentStatus}`,
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
