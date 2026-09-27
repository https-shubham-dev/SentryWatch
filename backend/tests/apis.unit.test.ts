import { ApisService } from '../src/modules/apis/apis.service.js';
import { Api } from '../src/models/Api.js';

jest.mock('../src/models/Api.js');

describe('ApisService Unit Tests', () => {
  let service: ApisService;
  const mockOrgId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    service = new ApisService();
    jest.clearAllMocks();
  });

  describe('createApi', () => {
    it('should throw ValidationError if checkIntervalSeconds is invalid', async () => {
      await expect(
        service.createApi(
          {
            name: 'Test Service',
            method: 'GET',
            url: 'https://api.example.com/health',
            checkIntervalSeconds: 45 as any,
          },
          mockOrgId,
        ),
      ).rejects.toThrow('checkIntervalSeconds must be one of: 60, 300, 900');
    });

    it('should throw ValidationError if method is unsupported (e.g. PATCH)', async () => {
      await expect(
        service.createApi(
          {
            name: 'Test Service',
            method: 'PATCH' as any,
            url: 'https://api.example.com/health',
            checkIntervalSeconds: 60,
          },
          mockOrgId,
        ),
      ).rejects.toThrow('Invalid HTTP method');
    });

    it('should throw ValidationError if URL is invalid', async () => {
      await expect(
        service.createApi(
          {
            name: 'Test Service',
            method: 'GET',
            url: 'not-a-valid-url',
            checkIntervalSeconds: 60,
          },
          mockOrgId,
        ),
      ).rejects.toThrow('Invalid URL format');
    });

    it('should create API document with currentStatus: unknown when valid', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        _id: 'api-123',
        organizationId: mockOrgId,
        name: 'Payment Service Health',
        method: 'GET',
        url: 'https://api.payments.com/health',
        expectedStatus: 200,
        checkIntervalSeconds: 60,
        enabled: true,
        currentStatus: 'unknown',
      });

      (Api as any).mockImplementation(() => ({
        save: mockSave,
      }));

      const result = await service.createApi(
        {
          name: 'Payment Service Health',
          method: 'GET',
          url: 'https://api.payments.com/health',
          expectedStatus: 200,
          checkIntervalSeconds: 60,
        },
        mockOrgId,
      );

      expect(mockSave).toHaveBeenCalled();
      expect(result.currentStatus).toBe('unknown');
    });
  });

  describe('getApisByOrg', () => {
    it('should filter strictly by organizationId', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      (Api.find as jest.Mock).mockReturnValue({ sort: mockSort });

      await service.getApisByOrg(mockOrgId);

      expect(Api.find).toHaveBeenCalledWith({ organizationId: mockOrgId });
    });
  });
});
