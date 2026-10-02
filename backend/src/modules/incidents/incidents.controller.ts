import { Request, Response, NextFunction } from 'express';
import { IncidentsService } from './incidents.service.js';

const incidentsService = new IncidentsService();

export class IncidentsController {
  async getIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);

      const incidents = await incidentsService.getIncidentsByOrg(
        organizationId,
        status,
        severity,
        page,
        limit,
      );
      res.status(200).json(incidents);
    } catch (error) {
      next(error);
    }
  }

  async getIncidentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const incidentId = req.params.id;

      const incident = await incidentsService.getIncidentById(incidentId, organizationId);
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;
      const incidentId = req.params.id;
      const { status } = req.body;

      const updated = await incidentsService.updateIncidentStatus(
        incidentId,
        status,
        organizationId,
        userId,
      );

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
}
