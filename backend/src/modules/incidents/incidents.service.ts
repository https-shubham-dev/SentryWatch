import { Incident, IIncident, IncidentStatus } from '../../models/Incident.js';
import { Api } from '../../models/Api.js';
import { Check } from '../../models/Check.js';
import { ConflictError, NotFoundError, ValidationError } from '../../middleware/errorHandler.js';

export class IncidentsService {
  /**
   * Helper to validate status transition legality (requirements.md §5).
   */
  static isValidStatusTransition(from: IncidentStatus, to: IncidentStatus): boolean {
    if (from === 'detected' && to === 'investigating') return true;
    if (from === 'investigating' && to === 'mitigated') return true;
    if (from === 'mitigated' && to === 'resolved') return true;
    if (from === 'investigating' && to === 'resolved') return true; // Skip mitigated is allowed
    return false;
  }

  /**
   * Manually transition incident status with server-side resolve guard enforcement.
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    organizationId: string,
    userId: string,
  ): Promise<IIncident> {
    const incident = await Incident.findOne({ _id: incidentId, organizationId });
    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    if (incident.status === newStatus) {
      return incident;
    }

    if (!IncidentsService.isValidStatusTransition(incident.status, newStatus)) {
      throw new ConflictError(
        `Invalid status transition from '${incident.status}' to '${newStatus}'. Direct 'detected' -> 'resolved' is not allowed.`,
      );
    }

    // Resolve guard: target API must be passing its last check (requirements.md §5)
    if (newStatus === 'resolved') {
      const lastCheck = await Check.findOne({ apiId: incident.apiId }).sort({ executedAt: -1 });
      if (lastCheck && !lastCheck.passed) {
        throw new ValidationError(
          'Cannot resolve incident while the target API is actively failing its health check.',
        );
      }
      incident.resolvedAt = new Date();
    }

    incident.status = newStatus;
    incident.events.push({
      status: newStatus,
      timestamp: new Date(),
      triggeredBy: userId as any,
    });

    const savedIncident = await incident.save();

    // If incident resolved, update denormalized api.currentStatus to 'ok'
    if (newStatus === 'resolved') {
      const api = await Api.findById(incident.apiId);
      if (api) {
        api.currentStatus = 'ok';
        await api.save();
      }
    }

    return savedIncident;
  }

  /**
   * List incidents for organization.
   */
  async getIncidentsByOrg(organizationId: string, status?: string): Promise<IIncident[]> {
    const query: Record<string, any> = { organizationId };
    if (status) {
      query.status = status;
    }
    return Incident.find(query).sort({ detectedAt: -1 });
  }

  /**
   * Get incident detail by ID.
   */
  async getIncidentById(incidentId: string, organizationId: string): Promise<IIncident> {
    const incident = await Incident.findOne({ _id: incidentId, organizationId });
    if (!incident) {
      throw new NotFoundError('Incident not found');
    }
    return incident;
  }
}
