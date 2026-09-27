import { detectAnomaly, CheckMetrics } from '../src/modules/anomaly/detection.js';

describe('Pure Anomaly Detection Unit Tests (100% Branch Coverage)', () => {
  const normalBaseline: CheckMetrics[] = [
    { passed: true, latencyMs: 100 },
    { passed: true, latencyMs: 110 },
    { passed: true, latencyMs: 95 },
    { passed: true, latencyMs: 105 },
    { passed: true, latencyMs: 100 },
  ];

  it('should return no anomaly for normal latency and passing status', () => {
    const current: CheckMetrics = { passed: true, latencyMs: 120 };
    const result = detectAnomaly(normalBaseline, current);

    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toBe('Metrics within normal threshold');
  });

  it('should detect latency anomaly when latency > 3x rolling avg with >= 5 baseline points', () => {
    // Avg = 102ms. Latency = 350ms (3.43x avg)
    const current: CheckMetrics = { passed: true, latencyMs: 350 };
    const result = detectAnomaly(normalBaseline, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('medium');
    expect(result.reason).toContain('3.4x threshold');
  });

  it('should detect high severity latency anomaly when latency >= 5x rolling avg', () => {
    // Avg = 102ms. Latency = 600ms (5.88x avg)
    const current: CheckMetrics = { passed: true, latencyMs: 600 };
    const result = detectAnomaly(normalBaseline, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.reason).toContain('5.9x threshold');
  });

  it('should NOT trigger false positive latency anomaly when baseline has fewer than 5 points', () => {
    const insufficientBaseline: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
    ];
    const current: CheckMetrics = { passed: true, latencyMs: 400 };
    const result = detectAnomaly(insufficientBaseline, current);

    expect(result.isAnomaly).toBe(false);
  });

  it('should detect failure rate anomaly when 3 out of 5 checks fail (60%)', () => {
    const prior: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('medium');
    expect(result.reason).toContain('60%');
  });

  it('should detect high severity failure rate anomaly when >= 80% checks fail', () => {
    const prior: CheckMetrics[] = [
      { passed: true, latencyMs: 100 },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
      { passed: false, latencyMs: null },
    ];
    const current: CheckMetrics = { passed: false, latencyMs: null };
    const result = detectAnomaly(prior, current);

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.reason).toContain('80%');
  });

  it('should handle zero avg latency gracefully', () => {
    const zeroBaseline: CheckMetrics[] = [
      { passed: true, latencyMs: 0 },
      { passed: true, latencyMs: 0 },
      { passed: true, latencyMs: 0 },
      { passed: true, latencyMs: 0 },
      { passed: true, latencyMs: 0 },
    ];
    const current: CheckMetrics = { passed: true, latencyMs: 100 };
    const result = detectAnomaly(zeroBaseline, current);

    expect(result.isAnomaly).toBe(false);
  });
});
