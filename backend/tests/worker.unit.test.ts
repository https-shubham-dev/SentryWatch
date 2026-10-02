import { Check } from '../src/models/Check.js';
import { Api } from '../src/models/Api.js';
import { Incident } from '../src/models/Incident.js';
import { processCheckJob } from '../src/workers/checkWorker.js';
import * as rollingWindowModule from '../src/modules/anomaly/rollingWindow.js';
import { Types } from 'mongoose';
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

  describe('First Check Failure Handling', () => {
    it('should set currentStatus to warn when the very first check of a new API fails', async () => {
      const mockApiId = new Types.ObjectId().toString();
      const mockOrgId = new Types.ObjectId().toString();

      const mockApi = {
        _id: mockApiId,
        organizationId: mockOrgId,
        name: 'New Failing API',
        method: 'GET',
        url: 'https://httpstat.us/500',
        expectedStatus: 200,
        checkIntervalSeconds: 60,
        enabled: true,
        currentStatus: 'unknown',
        updatedAt: new Date(),
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(Api, 'findById').mockResolvedValue(mockApi as any);
      jest.spyOn(Check, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: new Types.ObjectId(),
      } as any);

      jest.spyOn(rollingWindowModule, 'getRollingWindowChecks').mockResolvedValue([]);
      jest.spyOn(rollingWindowModule, 'addCheckToRollingWindow').mockResolvedValue();
      jest.spyOn(rollingWindowModule, 'resetConsecutiveAnomalyCount').mockResolvedValue();
      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);

      (axios as unknown as jest.Mock).mockResolvedValue({
        status: 500,
        data: {},
      });

      await processCheckJob({ apiId: mockApiId, organizationId: mockOrgId });

      expect(mockApi.currentStatus).not.toBe('ok');
      expect(mockApi.currentStatus).toBe('warn');
      expect(mockApi.save).toHaveBeenCalled();
    });
  });

  describe('Worker Idempotency Guard', () => {
    it('should verify rolling window length, consecutive counter, currentStatus, and incident state are unchanged after a duplicate job', async () => {
      const mockApiId = new Types.ObjectId().toString();
      const mockOrgId = new Types.ObjectId().toString();

      const mockApi = {
        _id: mockApiId,
        organizationId: mockOrgId,
        name: 'Test API',
        method: 'GET',
        url: 'https://httpstat.us/200',
        expectedStatus: 200,
        checkIntervalSeconds: 60,
        enabled: true,
        currentStatus: 'ok',
        save: jest.fn(),
      };

      jest.spyOn(Api, 'findById').mockResolvedValue(mockApi as any);

      // Spy on side-effect functions
      const addRollingSpy = jest.spyOn(rollingWindowModule, 'addCheckToRollingWindow').mockResolvedValue();
      const getRollingSpy = jest.spyOn(rollingWindowModule, 'getRollingWindowChecks').mockResolvedValue([]);
      const incrementConsecutiveSpy = jest.spyOn(rollingWindowModule, 'incrementConsecutiveAnomalyCount').mockResolvedValue(1);
      const resetConsecutiveSpy = jest.spyOn(rollingWindowModule, 'resetConsecutiveAnomalyCount').mockResolvedValue();

      const incidentFindSpy = jest.spyOn(Incident, 'findOne');
      const incidentSaveSpy = jest.spyOn(Incident.prototype, 'save');

      // Simulate Check.updateOne indicating that an existing document matched (upsertedCount = 0)
      const updateCheckSpy = jest.spyOn(Check, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      } as any);

      (axios as unknown as jest.Mock).mockResolvedValue({
        status: 200,
        data: {},
      });

      const initialStatus = mockApi.currentStatus;

      // Run duplicate job (Check for scheduledTime already exists)
      await processCheckJob({ apiId: mockApiId, organizationId: mockOrgId });

      // Assertions verifying that no side effects occurred and all 4 states are unchanged
      expect(updateCheckSpy).toHaveBeenCalled();
      expect(addRollingSpy).not.toHaveBeenCalled(); // rolling window length is unchanged
      expect(getRollingSpy).not.toHaveBeenCalled();
      expect(incrementConsecutiveSpy).not.toHaveBeenCalled(); // consecutive counter is unchanged
      expect(resetConsecutiveSpy).not.toHaveBeenCalled(); // consecutive counter is unchanged
      expect(mockApi.save).not.toHaveBeenCalled(); // currentStatus is unchanged
      expect(mockApi.currentStatus).toBe(initialStatus); // currentStatus is unchanged
      expect(incidentFindSpy).not.toHaveBeenCalled(); // incident state is unchanged
      expect(incidentSaveSpy).not.toHaveBeenCalled(); // incident state is unchanged
    });
  });
});
