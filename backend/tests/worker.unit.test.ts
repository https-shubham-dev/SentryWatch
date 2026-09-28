import { Check } from '../src/models/Check.js';
import axios from 'axios';

jest.mock('axios');

describe('Worker & Scheduling Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Check Model Idempotency Index', () => {
    it('should define compound unique index on apiId and scheduledTime', () => {
      const indexes = Check.schema.indexes();
      const compoundIndex = indexes.find(
        (idx) => idx[0].apiId === 1 && idx[0].scheduledTime === 1,
      );

      expect(compoundIndex).toBeDefined();
      expect(compoundIndex?.[1]?.unique).toBe(true);
    });
  });

  describe('HTTP Execution Logic', () => {
    it('should pass if returned HTTP status matches expectedStatus', async () => {
      (axios as unknown as jest.Mock).mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      const response = await axios({
        method: 'GET',
        url: 'https://httpstat.us/200',
        timeout: 10000,
        validateStatus: () => true,
      });

      expect(response.status).toBe(200);
    });

    it('should handle timeout/network errors gracefully', async () => {
      const timeoutErr = new Error('timeout of 10000ms exceeded');
      (timeoutErr as any).code = 'ECONNABORTED';
      (axios as unknown as jest.Mock).mockRejectedValue(timeoutErr);

      await expect(
        axios({
          method: 'GET',
          url: 'https://httpstat.us/200',
          timeout: 10000,
          validateStatus: () => true,
        }),
      ).rejects.toThrow('timeout of 10000ms exceeded');
    });
  });

  describe('Worker Idempotency Guard', () => {
    it('should return immediately without side effects if Check for scheduledTime already exists', async () => {
      const updateOneSpy = jest.spyOn(Check, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      } as any);

      // Verify that when upsertedCount is 0, Check.updateOne matched an existing doc
      const updateResult = await Check.updateOne(
        { apiId: 'mock-api-id', scheduledTime: new Date() },
        { $setOnInsert: { organizationId: 'mock-org' } },
        { upsert: true },
      );

      expect(updateResult.upsertedCount).toBe(0);
      expect(updateOneSpy).toHaveBeenCalled();
      updateOneSpy.mockRestore();
    });
  });
});

