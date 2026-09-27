import { THRESHOLDS } from '../../config/thresholds.js';

export interface CheckMetrics {
  passed: boolean;
  latencyMs: number | null;
  executedAt?: Date | string;
}

export type SeverityLevel = 'medium' | 'high';

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  reason: string;
  severity: SeverityLevel;
}

/**
 * Pure anomaly detection function (Rules.md §6).
 * Evaluates a check against prior rolling window metrics.
 * Uses a fixed window of 5 checks and enforces a minimum 5-check baseline.
 */
export function detectAnomaly(
  priorChecks: CheckMetrics[],
  currentCheck: CheckMetrics,
): AnomalyDetectionResult {
  const allChecks = [...priorChecks, currentCheck];

  // Baseline Guard: Requires at least 5 total checks in history for anomaly detection
  if (allChecks.length < THRESHOLDS.MIN_BASELINE_CHECKS) {
    return {
      isAnomaly: false,
      reason: `Insufficient baseline checks (${allChecks.length}/${THRESHOLDS.MIN_BASELINE_CHECKS} checks)`,
      severity: 'medium',
    };
  }

  // 1. Evaluate Failure Rate Anomaly over fixed window of 5 checks
  const windowChecks = allChecks.slice(-5);
  const failedInWindow = windowChecks.filter((c) => !c.passed).length;
  const failureRate = failedInWindow / 5; // Fixed denominator of 5

  if (failureRate >= THRESHOLDS.FAILURE_RATE_THRESHOLD) {
    const isHighSeverity = failureRate >= THRESHOLDS.HIGH_SEVERITY_FAILURE_RATE;
    return {
      isAnomaly: true,
      reason: `Failure rate over last 5 checks is ${Math.round(failureRate * 100)}% (${failedInWindow}/5 failed)`,
      severity: isHighSeverity ? 'high' : 'medium',
    };
  }

  // 2. Evaluate Latency Spike Anomaly (over prior passing baseline)
  const validPriorLatencies = priorChecks
    .filter((c) => c.passed && c.latencyMs !== null && c.latencyMs > 0)
    .map((c) => c.latencyMs as number);

  if (
    validPriorLatencies.length >= THRESHOLDS.MIN_BASELINE_CHECKS &&
    currentCheck.passed &&
    currentCheck.latencyMs !== null
  ) {
    const sum = validPriorLatencies.reduce((acc, val) => acc + val, 0);
    const avgLatency = sum / validPriorLatencies.length;

    if (avgLatency > 0) {
      const multiplier = currentCheck.latencyMs / avgLatency;
      if (multiplier >= THRESHOLDS.LATENCY_MULTIPLIER_THRESHOLD) {
        const isHighSeverity = multiplier >= THRESHOLDS.HIGH_SEVERITY_LATENCY_MULTIPLIER;
        return {
          isAnomaly: true,
          reason: `Latency ${currentCheck.latencyMs}ms vs rolling avg ${Math.round(avgLatency)}ms (${multiplier.toFixed(1)}x threshold)`,
          severity: isHighSeverity ? 'high' : 'medium',
        };
      }
    }
  }

  return {
    isAnomaly: false,
    reason: 'Metrics within normal threshold',
    severity: 'medium',
  };
}
