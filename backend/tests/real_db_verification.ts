import mongoose from 'mongoose';
import Redis from 'ioredis';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ApisService } from '../src/modules/apis/apis.service.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Api } from '../src/models/Api.js';
import { Check } from '../src/models/Check.js';
import { Incident } from '../src/models/Incident.js';
import { detectAnomaly } from '../src/modules/anomaly/detection.js';
import {
  addCheckToRollingWindow,
  getRollingWindowChecks,
  getConsecutiveAnomalyCount,
  incrementConsecutiveAnomalyCount,
  resetConsecutiveAnomalyCount,
} from '../src/modules/anomaly/rollingWindow.js';
import axios from 'axios';

const MONGO_URI = 'mongodb://localhost:27017/sentrywatch?replicaSet=rs0&directConnection=true';
const REDIS_HOST = 'localhost';
const REDIS_PORT = 6379;

async function executeRealWorkerCycle(apiId: string) {
  const api = await Api.findById(apiId);
  if (!api) throw new Error('API not found');

  const now = new Date();
  const intervalMs = api.checkIntervalSeconds * 1000;
  const scheduledTimestamp = Math.floor(now.getTime() / intervalMs) * intervalMs;
  const scheduledTime = new Date(scheduledTimestamp);

  let statusCode: number | null = null;
  let passed = false;
  let latencyMs: number | null = null;
  let errorType: 'network' | 'timeout' | null = null;

  const startTime = Date.now();

  try {
    const response = await axios({
      method: api.method,
      url: api.url,
      headers: api.headers || {},
      timeout: 10000,
      validateStatus: () => true,
    });

    latencyMs = Date.now() - startTime;
    statusCode = response.status;
    passed = statusCode === api.expectedStatus;
  } catch (err: any) {
    passed = false;
    statusCode = null;
    latencyMs = null;
    errorType = err.code === 'ECONNABORTED' || err.message?.includes('timeout') ? 'timeout' : 'network';
  }

  // Idempotent write to Check collection
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
    if (err.code !== 11000 && !err.message?.includes('E11000')) {
      throw err;
    }
  }

  // Rolling window + Anomaly Detection
  const priorRolling = await getRollingWindowChecks(apiId);
  const currentMetric = { passed, latencyMs, executedAt: now };
  await addCheckToRollingWindow(apiId, currentMetric);

  const anomalyResult = detectAnomaly(priorRolling, currentMetric);

  if (!anomalyResult.isAnomaly) {
    await resetConsecutiveAnomalyCount(apiId);

    const openIncident = await Incident.findOne({ apiId: api._id, status: { $ne: 'resolved' } });
    const recent5 = [...priorRolling, currentMetric].slice(-5);
    const failedInRecent5 = recent5.filter((c) => !c.passed).length;

    if (!openIncident) {
      if (failedInRecent5 >= 2 && api.currentStatus !== 'warn') {
        api.currentStatus = 'warn';
        await api.save();
      } else if (failedInRecent5 < 2 && api.currentStatus !== 'ok') {
        api.currentStatus = 'ok';
        await api.save();
      }
    }
  } else {
    const consecutiveCount = await incrementConsecutiveAnomalyCount(apiId);

    if (consecutiveCount === 1) {
      if (api.currentStatus !== 'warn' && api.currentStatus !== 'critical') {
        api.currentStatus = 'warn';
        await api.save();
      }
    } else if (consecutiveCount >= 2) {
      const existingIncident = await Incident.findOne({ apiId: api._id, status: { $ne: 'resolved' } });
      if (existingIncident) {
        existingIncident.anomalyCount = (existingIncident.anomalyCount || 1) + 1;
        existingIncident.lastAnomalyAt = now;
        await existingIncident.save();
      } else {
        const newIncident = new Incident({
          apiId: api._id,
          organizationId: api.organizationId,
          status: 'detected',
          severity: anomalyResult.severity,
          reason: anomalyResult.reason,
          detectedAt: now,
          lastAnomalyAt: now,
          anomalyCount: 1,
          events: [{ status: 'detected', timestamp: now, triggeredBy: 'system' }],
        });
        await newIncident.save();
      }

      if (api.currentStatus !== 'critical') {
        api.currentStatus = 'critical';
        await api.save();
      }
    }
  }
}

async function runRealDBVerification() {
  console.log('Connecting to Docker MongoDB & Redis...');
  await mongoose.connect(MONGO_URI);
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

  // Clean collection documents individually
  await User.deleteMany({});
  await Organization.deleteMany({});
  await Api.deleteMany({});
  await Check.deleteMany({});
  await Incident.deleteMany({});
  await redis.flushall();

  console.log('DB collections and Redis flushed cleanly.');

  // 1. Create Org + User
  const authService = new AuthService();
  const { user, org } = await authService.signup({
    email: 'admin@sentrywatch.io',
    password: 'password123',
    orgName: 'Real Verification Org',
  });

  console.log(`[Real Auth] Created User: ${user.email} (${user._id}) in Org: ${org.name} (${org._id})`);

  // 2. Create API pointing to https://httpstat.us/500
  const apisService = new ApisService();
  const api = await apisService.createApi(
    {
      name: 'Real Failing Endpoint Test',
      method: 'GET',
      url: 'https://httpstat.us/500',
      expectedStatus: 200,
      checkIntervalSeconds: 60,
    },
    org._id.toString(),
  );

  console.log(`[Real API] Created API Registry doc: ${api.name} (${api._id}) - currentStatus: ${api.currentStatus}\n`);

  // 3. Run 6 consecutive real HTTP health check cycles
  console.log('--- Executing Real Worker Health Check Cycles against https://httpstat.us/500 ---');
  for (let cycle = 1; cycle <= 6; cycle++) {
    await executeRealWorkerCycle(api._id.toString());
    const refreshedApi = await Api.findById(api._id);
    const incidentCount = await Incident.countDocuments({ apiId: api._id });
    console.log(
      `Check Cycle ${cycle} Complete -> api.currentStatus = '${refreshedApi?.currentStatus}' | Open Incidents in DB = ${incidentCount}`,
    );

    // Sleep 500ms between cycles
    await new Promise((r) => setTimeout(r, 500));
  }

  // 4. Query raw MongoDB documents
  console.log('\n================================================================');
  console.log(' RAW MONGODB DOCUMENTS FROM DOCKER DATABASE (NO MOCKS)');
  console.log('================================================================\n');

  console.log('--- CHECKS COLLECTION (raw MongoDB documents) ---');
  const rawChecks = await Check.find({ apiId: api._id }).lean();
  console.log(JSON.stringify(rawChecks, null, 2));

  console.log('\n--- API DOCUMENT (denormalized currentStatus) ---');
  const rawApi = await Api.findById(api._id).lean();
  console.log(JSON.stringify(rawApi, null, 2));

  console.log('\n--- INCIDENTS COLLECTION (raw MongoDB documents with embedded events) ---');
  const rawIncidents = await Incident.find({ apiId: api._id }).lean();
  console.log(JSON.stringify(rawIncidents, null, 2));

  await mongoose.disconnect();
  redis.disconnect();
}

runRealDBVerification().catch((err) => {
  console.error('Real Verification Error:', err);
  process.exit(1);
});
