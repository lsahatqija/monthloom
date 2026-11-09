import type {
  AdminDashboardResponse,
  AdminHealthResponse,
  AdminLogLevel,
  AdminOverviewResponse,
} from '@monthloom/contracts';

import type { AdminLogReader } from './admin-log-reader.js';
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
}
