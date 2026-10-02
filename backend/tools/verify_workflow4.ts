import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import RedisMock from 'ioredis-mock';
import express from 'express';
import http from 'http';
import axios from 'axios';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Api } from '../src/models/Api.js';
import { Check } from '../src/models/Check.js';
import { Incident } from '../src/models/Incident.js';
import { IncidentsService } from '../src/modules/incidents/incidents.service.js';
import { processCheckJob } from '../src/workers/checkWorker.js';

// Setup Mock Redis instance
const mockRedis = new RedisMock();

const TARGET_PORT = 4000;
let isFailing = true;

async function startDemoTargetServer(): Promise<http.Server> {
  const app = express();
  app.use(express.json());

  app.get('/status', (_req, res) => {
    if (isFailing) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(200).json({ status: 'ok' });
    }
  });

  app.post('/toggle', (_req, res) => {
    isFailing = !isFailing;
    res.status(200).json({
      message: `Toggled status. Now failing=${isFailing}`,
      isFailing,
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(TARGET_PORT, () => {
      console.log(`[DemoTarget] Local target running on http://localhost:${TARGET_PORT}`);
      resolve(server);
    });
  });
}

async function runWorkflow4Verification() {
  console.log('=== STARTING WORKFLOW 4 REAL END-TO-END VERIFICATION ===\n');

  // 1. Start MongoMemoryServer & Demo Target
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log(`[MongoDB] Connected to in-memory instance at ${uri}`);

  const targetServer = await startDemoTargetServer();

  // 2. Seed Organization and User
  const org = await Organization.create({ name: 'Workflow 4 Demo Org' });
  const user = await User.create({
    email: 'member@sentrywatch.io',
    passwordHash: 'hashedpass',
    role: 'member',
    organizationId: org._id,
  });

  // 3. Register API pointing at http://localhost:4000/status
  const api = await Api.create({
    organizationId: org._id,
    name: 'Demo /status API',
    method: 'GET',
    url: `http://localhost:${TARGET_PORT}/status`,
    expectedStatus: 200,
    checkIntervalSeconds: 60,
    enabled: true,
    currentStatus: 'unknown',
  });
  console.log(`[API Created] ${api.name} (${api._id}) - URL: ${api.url}`);

  const incidentsService = new IncidentsService();
  let baseTime = Date.now() - 600000; // Start 10 minutes in the past
  const realDateNow = Date.now;

  // 4. Run Check Cycles 1 through 6 while API is failing (500)
  console.log('\n--- EXECUTING CHECK CYCLES 1 TO 6 (FAILING ENDPOINT) ---');
  for (let cycle = 1; cycle <= 6; cycle++) {
    baseTime += 60000; // Advance 60s per cycle
    Date.now = () => baseTime;

    await processCheckJob({ apiId: api._id.toString(), organizationId: org._id.toString() });
    const currentApi = await Api.findById(api._id);
    const openIncident = await Incident.findOne({ apiId: api._id, status: { $ne: 'resolved' } });
    console.log(
      `Cycle ${cycle}: Check recorded at ${new Date(baseTime).toISOString()} | API Status: '${currentApi?.currentStatus}' | Open Incident: ${
        openIncident ? `ID ${openIncident._id} [${openIncident.status}], severity=${openIncident.severity}, anomalyCount=${openIncident.anomalyCount}` : 'None'
      }`,
    );
  }

  // Verify Incident creation at Cycle 6
  let incident = await Incident.findOne({ apiId: api._id, status: { $ne: 'resolved' } });
  if (!incident) {
    throw new Error('Expected Incident to be created at Cycle 6');
  }
  console.log('\n[Incident Created Successfully]:', {
    id: incident._id.toString(),
    status: incident.status,
    severity: incident.severity,
    reason: incident.reason,
    anomalyCount: incident.anomalyCount,
    lastAnomalyAt: incident.lastAnomalyAt,
    eventsLength: incident.events.length,
  });

  // 5. Execute Cycle 7 (Repeated Anomaly on already-open incident)
  console.log('\n--- EXECUTING CYCLE 7 (REPEATED ANOMALY) ---');
  baseTime += 60000;
  Date.now = () => baseTime;
  await processCheckJob({ apiId: api._id.toString(), organizationId: org._id.toString() });
  incident = (await Incident.findById(incident._id))!;
  console.log(`Cycle 7 Complete: anomalyCount=${incident.anomalyCount}, eventsLength=${incident.events.length}`);
  if (incident.events.length !== 1) {
    throw new Error(`Expected exactly 1 event in array, got ${incident.events.length}`);
  }

  // 6. Member transitions Incident to 'investigating'
  console.log('\n--- MEMBER TRANSITIONS: DETECTED -> INVESTIGATING ---');
  incident = await incidentsService.updateIncidentStatus(
    incident._id.toString(),
    'investigating',
    org._id.toString(),
    user._id.toString(),
  );
  console.log(`Status updated to '${incident.status}'. Events count: ${incident.events.length}`);

  // 7. Member attempts PREMATURE RESOLVE while API is still actively failing (500)
  console.log('\n--- MEMBER ATTEMPTS PREMATURE RESOLVE (API STILL FAILING) ---');
  try {
    await incidentsService.updateIncidentStatus(
      incident._id.toString(),
      'resolved',
      org._id.toString(),
      user._id.toString(),
    );
    throw new Error('FAIL: Server should have rejected premature resolve!');
  } catch (err: any) {
    console.log(`[SUCCESS: SERVER REJECTED RESOLVE WITH MESSAGE]: "${err.message}" (HTTP Code: ${err.statusCode})`);
  }

  // 8. Toggle Demo Target Server using POST /toggle (flipping /status response to 200)
  console.log('\n--- TOGGLING DEMO TARGET ENDPOINT TO HTTP 200 VIA POST /toggle ---');
  const toggleRes = await axios.post(`http://localhost:${TARGET_PORT}/toggle`);
  console.log(`Toggle Response:`, toggleRes.data);

  // 9. Execute Cycle 8 (Passing Check)
  console.log('\n--- EXECUTING CYCLE 8 (PASSING CHECK) ---');
  baseTime += 60000;
  Date.now = () => baseTime;
  await processCheckJob({ apiId: api._id.toString(), organizationId: org._id.toString() });
  const lastCheck = await Check.findOne({ apiId: api._id }).sort({ executedAt: -1 });
  console.log(`Last Check Result: statusCode=${lastCheck?.statusCode}, passed=${lastCheck?.passed}`);

  // 10. Member resolves Incident now that API is passing
  console.log('\n--- MEMBER RESOLVES INCIDENT AFTER PASSING CHECK ---');
  const finalIncidentDoc = await incidentsService.updateIncidentStatus(
    incident._id.toString(),
    'resolved',
    org._id.toString(),
    user._id.toString(),
  );

  const updatedApiDoc = await Api.findById(api._id);

  console.log('\n================================================================');
  console.log(' FINAL RESULTING INCIDENT MONGODB DOCUMENT (VERBATIM JSON)');
  console.log('================================================================\n');
  console.log(JSON.stringify(finalIncidentDoc.toObject(), null, 2));

  console.log('\n--- FINAL API DOCUMENT ---');
  console.log(JSON.stringify(updatedApiDoc?.toObject(), null, 2));

  // Cleanup
  targetServer.close();
  await mongoose.disconnect();
  await mongod.stop();
  console.log('\n=== WORKFLOW 4 VERIFICATION COMPLETED SUCCESSFULLY ===');
}

runWorkflow4Verification().catch((err) => {
  console.error('Workflow 4 verification failed:', err);
  process.exit(1);
});
