import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { Api, IApi } from '../models/Api.js';

export const CHECK_QUEUE_NAME = 'api-checks-queue';

export const checkQueue = new Queue(CHECK_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Register or update a repeatable check job for an enabled API.
 */
export async function scheduleApiCheck(api: IApi): Promise<void> {
  const apiIdStr = api._id.toString();
  await removeApiCheck(apiIdStr);

  if (!api.enabled) {
    return;
  }

  const intervalMs = api.checkIntervalSeconds * 1000;
  const jobName = `check:${apiIdStr}`;

  await checkQueue.add(
    jobName,
    {
      apiId: apiIdStr,
      organizationId: api.organizationId.toString(),
    },
    {
      repeat: {
        every: intervalMs,
      },
      jobId: `repeat:${jobName}`,
    },
  );

  console.info(`[Scheduler] Registered repeatable job for API ${api.name} (${apiIdStr}) every ${api.checkIntervalSeconds}s`);
}

/**
 * Remove repeatable check job for an API (e.g. disabled or deleted).
 */
export async function removeApiCheck(apiId: string): Promise<void> {
  const repeatableJobs = await checkQueue.getRepeatableJobs();
  const targetName = `check:${apiId}`;

  for (const job of repeatableJobs) {
    if (job.name === targetName || job.key.includes(targetName)) {
      await checkQueue.removeRepeatableByKey(job.key);
      console.info(`[Scheduler] Removed repeatable job key: ${job.key}`);
    }
  }
}

/**
 * Boot reconciliation: syncs BullMQ repeatable jobs with enabled APIs in MongoDB.
 * Solves Workflow 1 edge case (inconsistent state between Mongo write and Redis queue).
 */
export async function reconcileScheduledJobs(): Promise<void> {
  try {
    console.info('[Scheduler] Starting job reconciliation...');
    const enabledApis = await Api.find({ enabled: true });
    const enabledApiMap = new Map<string, IApi>();
    enabledApis.forEach((api) => enabledApiMap.set(api._id.toString(), api));

    const repeatableJobs = await checkQueue.getRepeatableJobs();
    const activeJobApiIds = new Set<string>();

    for (const job of repeatableJobs) {
      // job.name format is "check:<apiId>"
      const apiIdMatch = job.name.match(/^check:(.+)$/);
      if (apiIdMatch) {
        const apiId = apiIdMatch[1];
        if (!enabledApiMap.has(apiId)) {
          // Stale job in queue, remove it
          await checkQueue.removeRepeatableByKey(job.key);
          console.info(`[Scheduler] Removed stale repeatable job for disabled/deleted API: ${apiId}`);
        } else {
          activeJobApiIds.add(apiId);
        }
      }
    }

    // Register any enabled API missing a repeatable job
    for (const [apiId, api] of enabledApiMap.entries()) {
      if (!activeJobApiIds.has(apiId)) {
        await scheduleApiCheck(api);
      }
    }

    console.info(`[Scheduler] Reconciliation complete. Active scheduled jobs: ${enabledApiMap.size}`);
  } catch (error) {
    console.error('[Scheduler] Reconciliation error:', error);
  }
}
