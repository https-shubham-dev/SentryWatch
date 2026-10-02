import { Request, Response, NextFunction } from 'express';
import { ApisService } from './apis.service.js';

const apisService = new ApisService();

export class ApisController {
  async getApis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apis = await apisService.getApisByOrg(organizationId);

      res.status(200).json(
        apis.map((api) => ({
          id: api._id.toString(),
          organizationId: api.organizationId.toString(),
          name: api.name,
          method: api.method,
          url: api.url,
          expectedStatus: api.expectedStatus,
          headers: api.headers,
          checkIntervalSeconds: api.checkIntervalSeconds,
          enabled: api.enabled,
          currentStatus: api.currentStatus,
          createdAt: api.createdAt.toISOString(),
          updatedAt: api.updatedAt.toISOString(),
        })),
      );
    } catch (error) {
      next(error);
    }
  }

  async getApiById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;
      const api = await apisService.getApiById(apiId, organizationId);

      res.status(200).json({
        id: api._id.toString(),
        organizationId: api.organizationId.toString(),
        name: api.name,
        method: api.method,
        url: api.url,
        expectedStatus: api.expectedStatus,
        headers: api.headers,
        checkIntervalSeconds: api.checkIntervalSeconds,
        enabled: api.enabled,
        currentStatus: api.currentStatus,
        createdAt: api.createdAt.toISOString(),
        updatedAt: api.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async createApi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const api = await apisService.createApi(req.body, organizationId);

      res.status(201).json({
        id: api._id.toString(),
        organizationId: api.organizationId.toString(),
        name: api.name,
        method: api.method,
        url: api.url,
        expectedStatus: api.expectedStatus,
        headers: api.headers,
        checkIntervalSeconds: api.checkIntervalSeconds,
        enabled: api.enabled,
        currentStatus: api.currentStatus,
        createdAt: api.createdAt.toISOString(),
        updatedAt: api.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateApi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;
      const api = await apisService.updateApi(apiId, req.body, organizationId);

      res.status(200).json({
        id: api._id.toString(),
        organizationId: api.organizationId.toString(),
        name: api.name,
        method: api.method,
        url: api.url,
        expectedStatus: api.expectedStatus,
        headers: api.headers,
        checkIntervalSeconds: api.checkIntervalSeconds,
        enabled: api.enabled,
        currentStatus: api.currentStatus,
        createdAt: api.createdAt.toISOString(),
        updatedAt: api.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteApi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;
      await apisService.deleteApi(apiId, organizationId);

      res.status(200).json({ message: 'API removed successfully from monitoring' });
    } catch (error) {
      next(error);
    }
  }

  async getApiChecks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);

      const result = await apisService.getApiChecks(apiId, organizationId, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getApiStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;

      const stats = await apisService.getApiStats(apiId, organizationId);
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  async exportApiChecksPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const apiId = req.params.id;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const { buffer, filename } = await apisService.exportApiChecksPdf(apiId, organizationId, {
        from,
        to,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
