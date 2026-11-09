import type { AdminDashboardResponse, AdminLogLevel } from '@monthloom/contracts';

import type { AdminLogReader } from './admin-log-reader.js';
import type { AdminRepository } from './admin.repository.js';

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
    const [metrics, logs] = await Promise.all([
      this.repository.getMetrics(now),
      this.logReader.read(),
    ]);
    const counts = emptyCounts();
    const last24Hours = emptyCounts();
    const cutoff = now.getTime() - 24 * 60 * 60 * 1_000;

    for (const entry of logs.entries) {
      counts[entry.level] += 1;
      if (Date.parse(entry.timestamp) >= cutoff) last24Hours[entry.level] += 1;
    }

    const status = !logs.available
      ? 'unavailable'
      : last24Hours.fatal > 0
        ? 'critical'
        : last24Hours.error > 0 || last24Hours.warn > 0
          ? 'degraded'
          : 'healthy';

    return {
      generatedAt: now.toISOString(),
      metrics: {
        ...metrics,
        transactions: metrics.incomes + metrics.expenses,
      },
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
