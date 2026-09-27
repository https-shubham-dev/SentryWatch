import { Api, IApi, HttpMethod, AllowedIntervalSeconds } from '../../models/Api.js';
import { CreateApiDto, UpdateApiDto } from '../../types/api.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';

export class ApisService {
  /**
   * List all APIs belonging to the organization.
   */
  async getApisByOrg(organizationId: string): Promise<IApi[]> {
    return Api.find({ organizationId }).sort({ createdAt: -1 });
  }

  /**
   * Get API details by ID, ensuring organization scoping.
   */
  async getApiById(apiId: string, organizationId: string): Promise<IApi> {
    const api = await Api.findOne({ _id: apiId, organizationId });
    if (!api) {
      throw new NotFoundError('API not found');
    }
    return api;
  }

  /**
   * Create new API configuration under current organization.
   */
  async createApi(dto: CreateApiDto, organizationId: string): Promise<IApi> {
    this.validateCreateDto(dto);

    const api = new Api({
      organizationId,
      name: dto.name.trim(),
      method: dto.method,
      url: dto.url.trim(),
      expectedStatus: dto.expectedStatus ?? 200,
      headers: dto.headers || {},
      checkIntervalSeconds: dto.checkIntervalSeconds,
      enabled: dto.enabled ?? true,
      currentStatus: 'unknown',
    });

    return api.save();
  }

  /**
   * Update existing API configuration.
   */
  async updateApi(apiId: string, dto: UpdateApiDto, organizationId: string): Promise<IApi> {
    const api = await this.getApiById(apiId, organizationId);

    if (dto.name !== undefined) api.name = dto.name.trim();
    if (dto.method !== undefined) {
      this.validateMethod(dto.method);
      api.method = dto.method;
    }
    if (dto.url !== undefined) {
      this.validateUrl(dto.url);
      api.url = dto.url.trim();
    }
    if (dto.expectedStatus !== undefined) {
      this.validateStatus(dto.expectedStatus);
      api.expectedStatus = dto.expectedStatus;
    }
    if (dto.headers !== undefined) api.headers = dto.headers;
    if (dto.checkIntervalSeconds !== undefined) {
      this.validateInterval(dto.checkIntervalSeconds);
      api.checkIntervalSeconds = dto.checkIntervalSeconds;
    }
    if (dto.enabled !== undefined) api.enabled = dto.enabled;

    return api.save();
  }

  /**
   * Delete API configuration without cascade-deleting checks or incidents.
   */
  async deleteApi(apiId: string, organizationId: string): Promise<void> {
    const result = await Api.deleteOne({ _id: apiId, organizationId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('API not found');
    }
  }

  private validateCreateDto(dto: CreateApiDto): void {
    if (!dto.name || !dto.method || !dto.url || !dto.checkIntervalSeconds) {
      throw new ValidationError('Name, method, url, and checkIntervalSeconds are required');
    }
    this.validateMethod(dto.method);
    this.validateUrl(dto.url);
    this.validateInterval(dto.checkIntervalSeconds);
    if (dto.expectedStatus !== undefined) {
      this.validateStatus(dto.expectedStatus);
    }
  }

  private validateMethod(method: string): void {
    const allowedMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(method as HttpMethod)) {
      throw new ValidationError(`Invalid HTTP method. Allowed methods: ${allowedMethods.join(', ')}`);
    }
  }

  private validateInterval(interval: number): void {
    const allowedIntervals: AllowedIntervalSeconds[] = [60, 300, 900];
    if (!allowedIntervals.includes(interval as AllowedIntervalSeconds)) {
      throw new ValidationError('checkIntervalSeconds must be one of: 60, 300, 900');
    }
  }

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new ValidationError('URL must use http or https protocol');
      }
    } catch (_err) {
      throw new ValidationError('Invalid URL format');
    }
  }

  private validateStatus(status: number): void {
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new ValidationError('expectedStatus must be an integer between 100 and 599');
    }
  }
}
