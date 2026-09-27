import { detectAnomaly, CheckMetrics } from '../src/modules/anomaly/detection.js';

describe('Pure Anomaly Detection Unit Tests (100% Branch Coverage)', () => {
  const normal5Baseline: CheckMetrics[] = [
    { passed: true, latencyMs: 100 },
    { passed: true, latencyMs: 110 },
    { passed: true, latencyMs: 95 },
    { passed: true, latencyMs: 105 },
  ]; // + 1 current = 5 total

  it('should return no anomaly for normal latency and passing status', () => {
    const current: CheckMetrics = { passed: true, latencyMs: 120 };
    const result = detectAnomaly(normal5Baseline, current);

    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toBe('Metrics within normal threshold');
  });

  it('should NOT trigger anomaly when baseline has fewer than 5 total checks (1-2 failures alone)', () => {
    const insufficientBaseline: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(insufficientBaseline, current);

    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toContain('Insufficient baseline checks (3/5 checks)');
  });

  it('should NOT trigger anomaly on 1 failure out of 5 checks (20% failure rate)', () => {
    const prior4: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior4, current);

    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toBe('Metrics within normal threshold');
  });

  it('should NOT trigger anomaly on 2 failures out of 5 checks (40% failure rate)', () => {
    const prior4: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior4, current);

    expect(result.isAnomaly).toBe(false);
  });

  it('should detect failure rate anomaly when 3 out of 5 checks fail (60% threshold crossed)', () => {
    const prior4: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior4, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('medium');
    expect(result.reason).toContain('60% (3/5 failed)');
  });

  it('should detect high severity failure rate anomaly when 4 out of 5 checks fail (80% threshold crossed)', () => {
    const prior4: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior4, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.reason).toContain('80% (4/5 failed)');
  });

  it('should detect latency anomaly when latency > 3x rolling avg with >= 5 baseline points', () => {
    // 5 prior passing checks (avg = 102ms)
    const prior5: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 110 },
      { passed: true, latencyMs: 95 },
      { passed: true, latencyMs: 105 },
      { passed: true, latencyMs: 100 },
    ];
    const current: CheckMetrics = { passed: true, latencyMs: 350 };
    const result = detectAnomaly(prior5, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('medium');
    expect(result.reason).toContain('3.4x threshold');
  });

  it('should detect high severity latency anomaly when latency >= 5x rolling avg', () => {
    const prior5: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 110 },
      { passed: true, latencyMs: 95 },
      { passed: true, latencyMs: 105 },
      { passed: true, latencyMs: 100 },
    ];
    const current: CheckMetrics = { passed: true, latencyMs: 600 };
    const result = detectAnomaly(prior5, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.reason).toContain('5.9x threshold');
  });
});
