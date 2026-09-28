import mongoose from 'mongoose';
import Redis from 'ioredis';
import http from 'http';
import express from 'express';
import { User } from '../backend/src/models/User.js';
import { Organization } from '../backend/src/models/Organization.js';
import { Api } from '../backend/src/models/Api.js';
import { Check } from '../backend/src/models/Check.js';
import { Incident } from '../backend/src/models/Incident.js';
import { startCheckWorker } from '../backend/src/workers/checkWorker.js';
import { scheduleApiCheck } from '../backend/src/workers/scheduler.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentrywatch';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const TARGET_PORT = 4000;

let isFailing = true; // Start in failing state (HTTP 500)

async function startDemoTargetServer(): Promise<http.Server> {
  const app = express();
  app.get('/status', (_req, res) => {
    if (isFailing) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(200).json({ status: 'ok' });
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(TARGET_PORT, () => {
      console.log(`[DemoTarget] Running on http://localhost:${TARGET_PORT}`);
      resolve(server);
    });
  });
}

async function runRealSchedulerVerification() {
  console.log('=== STARTING REAL BULLMQ SCHEDULER VERIFICATION (7 MINUTES) ===');
  
  const targetServer = await startDemoTargetServer();

  console.log('Connecting to Docker MongoDB & Redis...');
  await mongoose.connect(MONGODB_URI);
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

  await Check.deleteMany({});
  await Incident.deleteMany({});
  await Api.deleteMany({});
  await User.deleteMany({});
  await Organization.deleteMany({});
  await redis.flushall();

  console.log('DB collections and Redis flushed cleanly.');

  // Create Org & User
  const org = await Organization.create({ name: 'Real Scheduler Org' });
  const user = await User.create({
    email: 'admin@realscheduler.io',
    passwordHash: 'hashedpass',
    role: 'admin',
    organizationId: org._id,
  });

  // Create API with 60s check interval
  const api = await Api.create({
    organizationId: org._id,
    name: 'Demo Target /status Endpoint',
    method: 'GET',
    url: `http://localhost:${TARGET_PORT}/status`,
    expectedStatus: 200,
    checkIntervalSeconds: 60,
    enabled: true,
    currentStatus: 'unknown',
  });

  console.log(`Created API: ${api.name} (${api._id}) - Url: ${api.url}`);

  // Start real worker
  const worker = startCheckWorker();

  // Register repeatable BullMQ job
  await scheduleApiCheck(api);
  console.log('Registered BullMQ repeatable job every 60s. NO direct calls or Redis seeding.');
  console.log('Waiting ~7 minutes (420s) for BullMQ scheduler to naturally run 7 cycles...\n');

  const startTime = Date.now();
  const durationMs = 420 * 1000; // 7 minutes

  const intervalId = setInterval(async () => {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const checkCount = await Check.countDocuments({ apiId: api._id });
    const currentApi = await Api.findById(api._id);
    const incidentCount = await Incident.countDocuments({ apiId: api._id });
    
    console.log(`[Elapsed: ${elapsedSec}s] Checks in DB: ${checkCount} | API Status: '${currentApi?.currentStatus}' | Incidents: ${incidentCount}`);
  }, 30000); // Progress log every 30 seconds

  await new Promise((res) => setTimeout(res, durationMs));
  clearInterval(intervalId);

  console.log('\n=== 7 MINUTES ELAPSED. FETCHING RAW DB & REDIS DOCUMENTS ===\n');

  const checkCount = await Check.countDocuments();
  const checksSorted = await Check.find().sort({ scheduledTime: 1 }).lean();
  const finalApi = await Api.findById(api._id).lean();
  const incidents = await Incident.find().lean();

  const rollingKey = `rolling:${api._id}`;
  const counterKey = `consecutive_anomaly:${api._id}`;

  const rollingRaw = await redis.lrange(rollingKey, 0, -1);
  const consecutiveCounterRaw = await redis.get(counterKey);

  console.log('================================================================');
  console.log(' RAW MONGODB & REDIS VERIFICATION DOCUMENTS (NO MOCKS)');
  console.log('================================================================\n');

  console.log(`db.checks.countDocuments(): ${checkCount}\n`);

  console.log('--- ALL CHECKS SORTED ASCENDING ---');
  console.log(JSON.stringify(checksSorted, null, 2));

  console.log('\n--- REDIS ROLLING WINDOW (LRANGE rolling:<apiId> 0 -1) ---');
  console.log(JSON.stringify(rollingRaw, null, 2));

  console.log('\n--- CONSECUTIVE ANOMALY COUNTER (GET consecutive_anomaly:<apiId>) ---');
  console.log(consecutiveCounterRaw);

  console.log('\n--- API DOCUMENT (denormalized currentStatus) ---');
  console.log(JSON.stringify(finalApi, null, 2));

  console.log('\n--- INCIDENTS COLLECTION WITH EMBEDDED EVENTS ---');
  console.log(JSON.stringify(incidents, null, 2));

  // Cleanup
  await worker.close();
  await redis.quit();
  await mongoose.disconnect();
  targetServer.close();

  process.exit(0);
}

runRealSchedulerVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
