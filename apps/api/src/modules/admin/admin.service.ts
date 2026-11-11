import type {
  AdminAdoptionResponse,
  AdminAnalyticsRangeQuery,
  AdminDashboardResponse,
  AdminHealthResponse,
  AdminLogLevel,
  AdminOverviewResponse,
  AdminReliabilityResponse,
  AdminRetentionResponse,
  AdminSecurityResponse,
  AdminSuspendAccountResponse,
  AdminUsageResponse,
} from '@monthloom/contracts';

import { ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { AdminLogReader } from './admin-log-reader.js';
import { resolveAdminAnalyticsRange } from './admin-range.js';
import type { AdminRepository } from './admin.repository.js';

const EXPECTED_WARNING_STATUS_CODES = new Set([401, 403, 409, 429]);
const ACTIONABLE_WARNING_THRESHOLD = 5;

function emptyCounts(): Record<AdminLogLevel, number> {
  return { warn: 0, error: 0, fatal: 0 };
}

export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly logReader: AdminLogReader,
    private readonly eventLimit = 100,
  ) {}

  async getDashboard(now = new Date()): Promise<AdminDashboardResponse> {
    const [overview, health] = await Promise.all([this.getOverview(now), this.getHealth(now)]);
    return { ...overview, health: health.health };
  }

  async getOverview(now = new Date()): Promise<AdminOverviewResponse> {
    const metrics = await this.repository.getMetrics(now);
    return {
      generatedAt: now.toISOString(),
      metrics: {
        ...metrics,
        transactions: metrics.incomes + metrics.expenses,
      },
    };
  }

  async getHealth(now = new Date()): Promise<AdminHealthResponse> {
    const logs = await this.logReader.read();
    const counts = emptyCounts();
    const last24Hours = emptyCounts();
    let actionableWarnings = 0;
    const cutoff = now.getTime() - 24 * 60 * 60 * 1_000;

    for (const entry of logs.entries) {
      counts[entry.level] += 1;
      if (Date.parse(entry.timestamp) >= cutoff) {
        last24Hours[entry.level] += 1;
        if (entry.level === 'warn' && !EXPECTED_WARNING_STATUS_CODES.has(entry.statusCode ?? 0)) {
          actionableWarnings += 1;
        }
      }
    }

    const status = !logs.available
      ? 'unavailable'
      : last24Hours.fatal > 0
        ? 'critical'
        : last24Hours.error > 0 || actionableWarnings >= ACTIONABLE_WARNING_THRESHOLD
          ? 'degraded'
          : 'healthy';

    return {
      generatedAt: now.toISOString(),
      health: {
        status,
        loggingAvailable: logs.available,
        windowDays: logs.windowDays,
        counts,
        last24Hours,
        entries: logs.entries.slice(0, this.eventLimit),
      },
    };
  }

  async getUsage(query: AdminAnalyticsRangeQuery, now = new Date()): Promise<AdminUsageResponse> {
    if (!this.repository.getUsage) throw new Error('Usage analytics repository is unavailable.');
    const { range, comparisonRange } = resolveAdminAnalyticsRange(query, now);
    const usage = await this.repository.getUsage(range, comparisonRange);
    return { generatedAt: now.toISOString(), range, comparisonRange, ...usage };
  }

  async getAdoption(
    query: AdminAnalyticsRangeQuery,
    now = new Date(),
  ): Promise<AdminAdoptionResponse> {
    if (!this.repository.getAdoption) {
      throw new Error('Adoption analytics repository is unavailable.');
    }
    const { range, comparisonRange } = resolveAdminAnalyticsRange(query, now);
    const adoption = await this.repository.getAdoption(range, comparisonRange);
    return { generatedAt: now.toISOString(), range, comparisonRange, ...adoption };
  }

  async getRetention(
    query: AdminAnalyticsRangeQuery,
    now = new Date(),
  ): Promise<AdminRetentionResponse> {
    if (!this.repository.getRetention)
      throw new Error('Retention analytics repository is unavailable.');
    const { range, comparisonRange } = resolveAdminAnalyticsRange(query, now);
    return {
      generatedAt: now.toISOString(),
      range,
      comparisonRange,
      ...(await this.repository.getRetention(range, comparisonRange)),
    };
  }

  async getReliability(
    query: AdminAnalyticsRangeQuery,
    now = new Date(),
  ): Promise<AdminReliabilityResponse> {
    if (!this.repository.getReliability)
      throw new Error('Reliability analytics repository is unavailable.');
    const { range, comparisonRange } = resolveAdminAnalyticsRange(query, now);
    return {
      generatedAt: now.toISOString(),
      range,
      comparisonRange,
      ...(await this.repository.getReliability(range, comparisonRange)),
    };
  }

  async getSecurity(
    query: AdminAnalyticsRangeQuery,
    now = new Date(),
  ): Promise<AdminSecurityResponse> {
    if (!this.repository.getSecurity)
      throw new Error('Security analytics repository is unavailable.');
    const { range, comparisonRange } = resolveAdminAnalyticsRange(query, now);
    return {
      generatedAt: now.toISOString(),
      range,
      comparisonRange,
      ...(await this.repository.getSecurity(range, comparisonRange)),
    };
  }

  async suspendAccount(
    userId: string,
    administratorId: string,
    now = new Date(),
  ): Promise<AdminSuspendAccountResponse> {
    if (userId === administratorId) throw new ConflictError('You cannot suspend your own account.');
    if (!this.repository.suspendAccount)
      throw new Error('Account suspension repository is unavailable.');
    const result = await this.repository.suspendAccount(userId, administratorId, now);
    if (!result) throw new NotFoundError('The account was not found or is already suspended.');
    return result;
  }
}
