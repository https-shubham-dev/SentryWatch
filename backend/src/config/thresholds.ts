// Threshold configuration for anomaly detection and checks
// Rules.md §1: No magic numbers. All thresholds live in this file with named constants.

export const THRESHOLDS = {
  // Anomaly detection parameters
  LATENCY_MULTIPLIER_THRESHOLD: 3.0, // Alert if latency > 3x rolling average
  HIGH_SEVERITY_LATENCY_MULTIPLIER: 5.0, // High severity if latency >= 5x baseline
  CONSECUTIVE_FAILURES_GUARD: 2,     // Number of consecutive failure cycles to trigger incident
  ROLLING_WINDOW_SIZE: 20,           // Number of recent checks stored in Redis rolling window
  MIN_BASELINE_CHECKS: 5,            // Minimum 5 prior checks required for latency baseline

  FAILURE_RATE_THRESHOLD: 0.60,      // Failure rate over last 5 checks >= 60%
  HIGH_SEVERITY_FAILURE_RATE: 0.80,  // High severity if failure rate >= 80%

  // Default API check intervals
  DEFAULT_CHECK_INTERVAL_SECONDS: 60,

  // Job queue policy
  JOB_MAX_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY_MS: 5000,
} as const;
