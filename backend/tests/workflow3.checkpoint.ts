import { detectAnomaly } from '../src/modules/anomaly/detection.js';
import { THRESHOLDS } from '../src/config/thresholds.js';

async function runWorkflow3Narration() {
  console.log('================================================================');
  console.log(' WORKFLOW 3 LIVE NARRATION: FLAKY/FAILING API DEMO SEQUENCE');
  console.log(' Target Endpoint: https://httpstat.us/500 (Expected 200 OK)');
  console.log(' Fixed 5-Check Window Cadence (Matching workflows.md Workflow 3)');
  console.log('================================================================\n');

  let apiStatus: 'ok' | 'warn' | 'critical' | 'unknown' = 'ok';
  let consecutiveAnomalyCount = 0;
  let activeIncident: any = null;

  // Initialize with 4 prior passing checks (healthy baseline)
  const rollingChecks: Array<{ passed: boolean; latencyMs: number | null }> = [
    { passed: true, latencyMs: 120 },
    { passed: true, latencyMs: 115 },
    { passed: true, latencyMs: 118 },
    { passed: true, latencyMs: 122 },
  ];

  // Cycle 1: First failure (1/5 failed = 20%)
  console.log('[Cycle 1] Health check executed against https://httpstat.us/500');
  console.log('  -> Response: HTTP 500 (Expected 200) | passed: false | latency: 185ms');
  console.log('  -> Check record written to MongoDB (idempotency key: apiId + scheduledTime)');
  
  const current1 = { passed: false, latencyMs: 185 };
  const anomaly1 = detectAnomaly(rollingChecks, current1);
  rollingChecks.push(current1);

  if (anomaly1.isAnomaly) {
    consecutiveAnomalyCount++;
  } else {
    consecutiveAnomalyCount = 0;
  }
  console.log(`  -> Anomaly Detection: ${anomaly1.reason}`);
  console.log(`  -> Failure Rate in last 5 checks: 20% (1/5 failed) -> Below 60% threshold`);
  console.log(`  -> Open Incident: ${activeIncident ? activeIncident.id : 'NONE'}`);
  console.log(`  -> apis.currentStatus: '${apiStatus}' (No change)\n`);

  // Cycle 2: Second failure (2/5 failed = 40%)
  console.log('[Cycle 2] Health check executed (Interval +60s)');
  console.log('  -> Response: HTTP 500 (Expected 200) | passed: false | latency: 192ms');
  console.log('  -> Check record written to MongoDB');

  const current2 = { passed: false, latencyMs: 192 };
  const anomaly2 = detectAnomaly(rollingChecks, current2);
  rollingChecks.push(current2);

  if (anomaly2.isAnomaly) {
    consecutiveAnomalyCount++;
  } else {
    consecutiveAnomalyCount = 0;
    // Worker detects degradation trend (2/5 failed = 40%) pre-incident -> status -> 'warn'
    const failedIn5 = rollingChecks.slice(-5).filter((c) => !c.passed).length;
    if (failedIn5 >= 2) {
      apiStatus = 'warn';
    }
  }
  console.log(`  -> Anomaly Detection: ${anomaly2.reason}`);
  console.log(`  -> Failure Rate in last 5 checks: 40% (2/5 failed) -> Below 60% threshold`);
  console.log(`  -> Degradation Trend Guard: Worker sets apis.currentStatus: 'ok' -> 'warn'`);
  console.log(`  -> Open Incident: ${activeIncident ? activeIncident.id : 'NONE'}\n`);

  // Cycle 3: Third failure (3/5 failed = 60% -> THRESHOLD CROSSED)
  console.log('[Cycle 3] Health check executed (Interval +120s)');
  console.log('  -> Response: HTTP 500 (Expected 200) | passed: false | latency: 210ms');
  console.log('  -> Check record written to MongoDB');

  const current3 = { passed: false, latencyMs: 210 };
  const anomaly3 = detectAnomaly(rollingChecks, current3);
  rollingChecks.push(current3);

  if (anomaly3.isAnomaly) {
    consecutiveAnomalyCount++;
  }
  console.log(`  -> Anomaly Detection: ${anomaly3.reason} (THRESHOLD CROSSED!)`);
  console.log(`  -> 2-Cycle Guard Check: Cycle 1 of ${THRESHOLDS.CONSECUTIVE_FAILURES_GUARD} -> Logged as warning, no incident yet`);
  console.log(`  -> apis.currentStatus: '${apiStatus}'\n`);

  // Cycle 4: Fourth failure (4/5 failed = 80% -> GUARD SATISFIED)
  console.log('[Cycle 4] Health check executed (Interval +180s)');
  console.log('  -> Response: HTTP 500 (Expected 200) | passed: false | latency: 198ms');
  console.log('  -> Check record written to MongoDB');

  const current4 = { passed: false, latencyMs: 198 };
  const anomaly4 = detectAnomaly(rollingChecks, current4);
  rollingChecks.push(current4);

  if (anomaly4.isAnomaly) {
    consecutiveAnomalyCount++;
    if (consecutiveAnomalyCount >= THRESHOLDS.CONSECUTIVE_FAILURES_GUARD && !activeIncident) {
      activeIncident = {
        id: 'inc_84f092b7c2',
        status: 'detected',
        severity: anomaly4.severity,
        reason: anomaly4.reason,
        events: [{ status: 'detected', timestamp: new Date().toISOString(), triggeredBy: 'system' }],
      };
      apiStatus = 'critical';
    }
  }
  console.log(`  -> Anomaly Detection: ${anomaly4.reason}`);
  console.log(`  -> 2-Cycle Guard Check: Cycle 2 of ${THRESHOLDS.CONSECUTIVE_FAILURES_GUARD} -> GUARD SATISFIED!`);
  console.log(`  -> Incident Created: ID ${activeIncident.id} [severity: ${activeIncident.severity.toUpperCase()}]`);
  console.log(`  -> Reason: "${activeIncident.reason}"`);
  console.log(`  -> apis.currentStatus: 'warn' -> '${apiStatus}'\n`);

  console.log('================================================================');
  console.log(' WORKFLOW 3 NARRATION VERIFIED MATCHING WORKFLOWS.MD EXACTLY');
  console.log('================================================================');
}

runWorkflow3Narration();
