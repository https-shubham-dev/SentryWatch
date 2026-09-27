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
 * Zero DB or external side effects inside this function.
 */
export function detectAnomaly(
  priorChecks: CheckMetrics[],
  currentCheck: CheckMetrics,
): AnomalyDetectionResult {
  // 1. Evaluate Failure Rate Anomaly (over last up to 5 checks including current)
  const windowChecks = [...priorChecks, currentCheck].slice(-5);
  const totalInWindow = windowChecks.length;
  const failedInWindow = windowChecks.filter((c) => !c.passed).length;
  const failureRate = totalInWindow > 0 ? failedInWindow / totalInWindow : 0;

  if (totalInWindow >= 1 && failureRate >= THRESHOLDS.FAILURE_RATE_THRESHOLD) {
    const isHighSeverity = failureRate >= THRESHOLDS.HIGH_SEVERITY_FAILURE_RATE;
    return {
      isAnomaly: true,
      reason: `Failure rate over last ${totalInWindow} checks is ${Math.round(failureRate * 100)}% (${failedInWindow}/${totalInWindow} failed)`,
      severity: isHighSeverity ? 'high' : 'medium',
    };
  }

  // 2. Evaluate Latency Spike Anomaly (requires >= 5 prior baseline checks)
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
