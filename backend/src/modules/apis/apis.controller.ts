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
}
