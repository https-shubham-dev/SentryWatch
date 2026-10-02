import {
  computeCheckExportSummary,
  buildCheckHistoryPdf,
} from '../src/modules/apis/checkHistoryPdf.js';

describe('Check history PDF export', () => {
  describe('computeCheckExportSummary', () => {
    it('computes uptime, avg latency, and counts', () => {
      const summary = computeCheckExportSummary(
        [
          { passed: true, latencyMs: 100, executedAt: new Date() },
          { passed: true, latencyMs: 200, executedAt: new Date() },
          { passed: false, latencyMs: null, executedAt: new Date() },
        ],
        'Last 100 checks',
      );

      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.uptimePercent).toBeCloseTo(66.7, 1);
      expect(summary.avgLatencyMs).toBe(150);
      expect(summary.rangeLabel).toBe('Last 100 checks');
    });

    it('handles empty check list', () => {
      const summary = computeCheckExportSummary([], 'Last 100 checks');
      expect(summary.total).toBe(0);
      expect(summary.uptimePercent).toBe(0);
      expect(summary.avgLatencyMs).toBeNull();
    });
  });

  describe('buildCheckHistoryPdf', () => {
    it('returns a PDF buffer with %PDF header', async () => {
      const buffer = await buildCheckHistoryPdf(
        {
          name: 'Demo API',
          method: 'GET',
          url: 'https://example.com/health',
        },
        [
          {
            executedAt: new Date('2026-10-01T12:00:00.000Z'),
            passed: true,
            statusCode: 200,
            latencyMs: 42,
            errorType: null,
          },
          {
            executedAt: new Date('2026-10-01T12:01:00.000Z'),
            passed: false,
            statusCode: 500,
            latencyMs: 10,
            errorType: null,
          },
        ],
        {
          total: 2,
          passed: 1,
          failed: 1,
          uptimePercent: 50,
          avgLatencyMs: 26,
          rangeLabel: 'Last 100 checks',
        },
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
  });
});
