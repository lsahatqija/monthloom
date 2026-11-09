import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { AdminLogEntry, AdminLogLevel } from '@monthloom/contracts';

const LOG_FILE_PATTERN = /^server\.\d{4}-\d{2}-\d{2}\.log$/;
const LEVELS = new Set<AdminLogLevel>(['warn', 'error', 'fatal']);

export interface AdminLogResult {
  available: boolean;
  windowDays: number;
  entries: AdminLogEntry[];
}

export interface AdminLogReader {
  read(): Promise<AdminLogResult>;
}

export class FileAdminLogReader implements AdminLogReader {
  constructor(
    private readonly directory: string,
    private readonly windowDays = 7,
  ) {}

  async read(): Promise<AdminLogResult> {
    try {
      const files = (await readdir(this.directory))
        .filter((name) => LOG_FILE_PATTERN.test(name))
        .sort()
        .slice(-this.windowDays);
      const results = await Promise.all(
        files.map(async (name) => {
          try {
            return await readFile(path.join(this.directory, name), 'utf8');
          } catch {
            return null;
          }
        }),
      );
      const contents = results.filter((content): content is string => content !== null);

      const entries = contents
        .flatMap((content) => content.split('\n'))
        .map(parseLogEntry)
        .filter((entry): entry is AdminLogEntry => entry !== null)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp));

      return { available: contents.length === files.length, windowDays: this.windowDays, entries };
    } catch {
      return { available: false, windowDays: this.windowDays, entries: [] };
    }
  }
}

function parseLogEntry(line: string): AdminLogEntry | null {
  if (!line.trim()) return null;

  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    if (typeof record.level !== 'string' || !LEVELS.has(record.level as AdminLogLevel)) return null;
    if (typeof record.time !== 'string' || Number.isNaN(Date.parse(record.time))) return null;

    const error = asRecord(record.err);
    const request = asRecord(record.req);
    const response = asRecord(record.res);
    const requestDetail =
      typeof request?.method === 'string' && typeof request.url === 'string'
        ? `${request.method} ${request.url}${typeof response?.statusCode === 'number' ? ` · ${response.statusCode}` : ''}`
        : typeof record.method === 'string' && typeof record.route === 'string'
          ? `${record.method} ${record.route}${typeof record.statusCode === 'number' ? ` · ${record.statusCode}` : ''}`
          : undefined;

    return {
      timestamp: new Date(record.time).toISOString(),
      level: record.level as AdminLogLevel,
      category: typeof record.category === 'string' ? record.category : 'system',
      message:
        typeof record.msg === 'string'
          ? record.msg
          : typeof error?.message === 'string'
            ? error.message
            : 'Logged application event',
      detail: requestDetail ?? (typeof error?.message === 'string' ? error.message : undefined),
    };
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
