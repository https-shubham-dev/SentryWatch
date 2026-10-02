import { Incident, IIncident, IncidentStatus } from '../../models/Incident.js';
import { Api } from '../../models/Api.js';
import { Check } from '../../models/Check.js';
import { ConflictError, NotFoundError } from '../../middleware/errorHandler.js';
import { publishSystemEvent } from '../../sockets/redisPubSub.js';

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
        throw new ConflictError(
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

    // Emit incident:updated event to room
    await publishSystemEvent({
      type: 'incident:updated',
      organizationId,
      payload: savedIncident,
    });

    // If incident resolved, update denormalized api.currentStatus to 'ok' and emit api:status_changed
    if (newStatus === 'resolved') {
      const api = await Api.findById(incident.apiId);
      if (api && api.currentStatus !== 'ok') {
        api.currentStatus = 'ok';
        await api.save();

        await publishSystemEvent({
          type: 'api:status_changed',
          organizationId,
          payload: {
            id: api._id.toString(),
            name: api.name,
            currentStatus: 'ok',
            updatedAt: api.updatedAt.toISOString(),
          },
        });
      }
    }

    return savedIncident;
  }

  /**
   * List incidents for organization with filter and pagination support.
   */
  async getIncidentsByOrg(
    organizationId: string,
    status?: string,
    severity?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<IIncident[]> {
    const query: Record<string, any> = { organizationId };
    if (status) {
      query.status = status;
    }
    if (severity) {
      query.severity = severity;
    }
    const skip = (page - 1) * limit;
    return Incident.find(query).sort({ detectedAt: -1 }).skip(skip).limit(limit);
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
