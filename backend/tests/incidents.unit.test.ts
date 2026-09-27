import { IncidentsService } from '../src/modules/incidents/incidents.service.js';
import { Incident } from '../src/models/Incident.js';
import { Check } from '../src/models/Check.js';

jest.mock('../src/models/Incident.js');
jest.mock('../src/models/Check.js');
jest.mock('../src/models/Api.js');

describe('IncidentsService Unit Tests', () => {
  let service: IncidentsService;
  const mockOrgId = '507f1f77bcf86cd799439011';
  const mockUserId = '507f1f77bcf86cd799439022';
  const mockIncidentId = '507f1f77bcf86cd799439033';

  beforeEach(() => {
    service = new IncidentsService();
    jest.clearAllMocks();
  });

  describe('Lifecycle Transition Rules', () => {
    it('should validate allowed lifecycle transitions', () => {
      expect(IncidentsService.isValidStatusTransition('detected', 'investigating')).toBe(true);
      expect(IncidentsService.isValidStatusTransition('investigating', 'mitigated')).toBe(true);
      expect(IncidentsService.isValidStatusTransition('mitigated', 'resolved')).toBe(true);
      expect(IncidentsService.isValidStatusTransition('investigating', 'resolved')).toBe(true);
    });

    it('should reject invalid direct detected -> resolved transition', () => {
      expect(IncidentsService.isValidStatusTransition('detected', 'resolved')).toBe(false);
    });
  });

  describe('updateIncidentStatus', () => {
    it('should throw ConflictError for invalid transition detected -> resolved', async () => {
      (Incident.findOne as jest.Mock).mockResolvedValue({
        _id: mockIncidentId,
        organizationId: mockOrgId,
        status: 'detected',
      });

      await expect(
        service.updateIncidentStatus(mockIncidentId, 'resolved', mockOrgId, mockUserId),
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw ValidationError if resolving while target API is actively failing', async () => {
      (Incident.findOne as jest.Mock).mockResolvedValue({
        _id: mockIncidentId,
        organizationId: mockOrgId,
        apiId: 'api-123',
        status: 'investigating',
      });

      (Check.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue({ passed: false }),
      });

      await expect(
        service.updateIncidentStatus(mockIncidentId, 'resolved', mockOrgId, mockUserId),
      ).rejects.toThrow('Cannot resolve incident while the target API is actively failing');
    });
  });
});
