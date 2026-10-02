import { Api, IApi, HttpMethod, AllowedIntervalSeconds } from '../../models/Api.js';
import { Check, ICheck } from '../../models/Check.js';
import { getRollingWindowChecks } from '../anomaly/rollingWindow.js';
import { CreateApiDto, UpdateApiDto } from '../../types/api.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';
import { scheduleApiCheck, removeApiCheck } from '../../workers/scheduler.js';
import {
  buildCheckHistoryPdf,
  computeCheckExportSummary,
} from './checkHistoryPdf.js';

const DEFAULT_EXPORT_LIMIT = 100;

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
   * Get paginated check history for an API (api.md).
   */
  async getApiChecks(
    apiId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: ICheck[]; total: number; page: number; limit: number }> {
    await this.getApiById(apiId, organizationId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Check.find({ apiId, organizationId }).sort({ executedAt: -1 }).skip(skip).limit(limit),
      Check.countDocuments({ apiId, organizationId }),
    ]);
    return { data, total, page, limit };
  }

  /**
   * Export check history as a dark-themed PDF.
   * Default: last 100 checks. Optional ?from=&to= ISO date range override.
   */
  async exportApiChecksPdf(
    apiId: string,
    organizationId: string,
    options: { from?: string; to?: string } = {},
  ): Promise<{ buffer: Buffer; filename: string }> {
    const api = await this.getApiById(apiId, organizationId);

    const filter: Record<string, unknown> = { apiId, organizationId };
    let rangeLabel = `Last ${DEFAULT_EXPORT_LIMIT} checks`;
    let useDateRange = false;

    if (options.from || options.to) {
      useDateRange = true;
      const executedAt: Record<string, Date> = {};
      if (options.from) {
        const fromDate = new Date(options.from);
        if (Number.isNaN(fromDate.getTime())) {
          throw new ValidationError('Invalid from date — use ISO 8601');
        }
        executedAt.$gte = fromDate;
      }
      if (options.to) {
        const toDate = new Date(options.to);
        if (Number.isNaN(toDate.getTime())) {
          throw new ValidationError('Invalid to date — use ISO 8601');
        }
        executedAt.$lte = toDate;
      }
      filter.executedAt = executedAt;
      const fromLabel = options.from ? new Date(options.from).toISOString().slice(0, 10) : '…';
      const toLabel = options.to ? new Date(options.to).toISOString().slice(0, 10) : '…';
      rangeLabel = `${fromLabel} → ${toLabel}`;
    }

    const query = Check.find(filter).sort({ executedAt: -1 });
    if (!useDateRange) {
      query.limit(DEFAULT_EXPORT_LIMIT);
    }
    const checks = await query.lean();

    const summary = computeCheckExportSummary(checks, rangeLabel);
    const buffer = await buildCheckHistoryPdf(api, checks, summary);
    const safeName = api.name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40);
    const filename = `sentrywatch-${safeName}-checks.pdf`;

    return { buffer, filename };
  }

  /**
   * Get API statistics (rolling latency, failure rate, and recent check metrics for chart).
   */
  async getApiStats(apiId: string, organizationId: string): Promise<{
    avgLatencyMs: number;
    failureRate: number;
    totalChecks: number;
    recentChecks: { executedAt: Date; latencyMs: number; passed: boolean }[];
  }> {
    await this.getApiById(apiId, organizationId);
    let checks = await getRollingWindowChecks(apiId);

    if (!checks || checks.length === 0) {
      const dbChecks = await Check.find({ apiId, organizationId })
        .sort({ executedAt: -1 })
        .limit(20)
        .lean();
      checks = dbChecks.map((c) => ({
        passed: c.passed,
        latencyMs: c.latencyMs,
        executedAt: c.executedAt,
      }));
    }

    const totalChecks = checks.length;
    const failedChecks = checks.filter((c) => !c.passed).length;
    const failureRate = totalChecks > 0 ? failedChecks / totalChecks : 0;

    const latencies = checks
      .map((c) => c.latencyMs)
      .filter((l): l is number => l !== null && l !== undefined);
    const avgLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

    const recentChecks = [...checks].reverse().map((c) => ({
      executedAt: c.executedAt ? new Date(c.executedAt) : new Date(),
      latencyMs: c.latencyMs ?? 0,
      passed: c.passed,
    }));

    return {
      avgLatencyMs,
      failureRate,
      totalChecks,
      recentChecks,
    };
  }

  /**
   * Create new API configuration under current organization and register worker job.
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

    const savedApi = await api.save();

    // Register BullMQ repeatable job if enabled
    if (savedApi.enabled) {
      try {
        await scheduleApiCheck(savedApi);
      } catch (err) {
        console.error('[ApisService] Warning: Failed to schedule job on create:', err);
      }
    }

    return savedApi;
  }

  /**
   * Update existing API configuration and update worker job schedule.
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

    const updatedApi = await api.save();

    // Update job scheduling
    try {
      if (updatedApi.enabled) {
        await scheduleApiCheck(updatedApi);
      } else {
        await removeApiCheck(apiId);
      }
    } catch (err) {
      console.error('[ApisService] Warning: Failed to update job schedule on update:', err);
    }

    return updatedApi;
  }

  /**
   * Delete API configuration and remove worker job without cascade-deleting checks or incidents.
   */
  async deleteApi(apiId: string, organizationId: string): Promise<void> {
    const result = await Api.deleteOne({ _id: apiId, organizationId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('API not found');
    }

    // Stop scheduled monitoring job
    try {
      await removeApiCheck(apiId);
    } catch (err) {
      console.error('[ApisService] Warning: Failed to remove job schedule on delete:', err);
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
