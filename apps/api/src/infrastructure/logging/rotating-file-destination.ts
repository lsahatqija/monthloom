import { EventEmitter } from 'node:events';
import { createWriteStream, type WriteStream } from 'node:fs';
import { chmod, link, lstat, mkdir, readdir, readlink, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_RETENTION_DAYS = 90;
const LOG_FILE_PATTERN = /^server\.(\d{4}-\d{2}-\d{2})\.log$/;

interface LogFileStream extends EventEmitter {
  readonly closed: boolean;
  destroy(): this;
  end(): this;
  write(chunk: string, callback?: (error?: Error | null) => void): boolean;
}

type StreamFactory = (filePath: string, options: { flags: 'a'; mode: number }) => LogFileStream;
type FailureReporter = (context: string, error: Error) => void;

export interface RotatingFileDestinationOptions {
  directory: string;
  now?: () => Date;
  reportFailure?: FailureReporter;
  retentionDays?: number;
  schedule?: boolean;
  streamFactory?: StreamFactory;
}

/** Pino-compatible destination with explicit lifecycle methods. */
export interface RotatingFileDestination {
  readonly healthy: boolean;
  readonly currentFilePath: string | undefined;
  close(): Promise<void>;
  flush(): Promise<void>;
  rotate(): Promise<void>;
  write(message: string): void;
}

export function utcDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function millisecondsUntilNextUtcMidnight(date: Date): number {
  const nextMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return nextMidnight - date.getTime();
}

export async function deleteExpiredLogFiles(
  directory: string,
  now: Date,
  retentionDays = DEFAULT_RETENTION_DAYS,
): Promise<string[]> {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('Log retention must be a positive whole number of days.');
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const oldestRetainedDate = today - retentionDays * DAY_MS;
  const removed: string[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const match = LOG_FILE_PATTERN.exec(entry.name);
    if (!match) continue;

    const dateStamp = match[1]!;
    const fileDate = Date.parse(`${dateStamp}T00:00:00.000Z`);
    if (!Number.isFinite(fileDate) || utcDateStamp(new Date(fileDate)) !== dateStamp) continue;
    if (fileDate >= oldestRetainedDate) continue;

    const filePath = path.join(directory, entry.name);
    await unlink(filePath);
    removed.push(filePath);
  }

  return removed;
}

export async function createRotatingFileDestination(
  options: RotatingFileDestinationOptions,
): Promise<RotatingFileDestination> {
  const destination = new DailyRotatingFileDestination(options);
  await destination.initialize();
  return destination;
}

class DailyRotatingFileDestination implements RotatingFileDestination {
  private readonly directory: string;
  private readonly now: () => Date;
  private readonly reportFailure: FailureReporter;
  private readonly retentionDays: number;
  private readonly scheduleEnabled: boolean;
  private readonly streamFactory: StreamFactory;
  private readonly reportedFailures = new Set<string>();
  private readonly queuedMessages: string[] = [];

  private activeDate: string | undefined;
  private activeStream: LogFileStream | undefined;
  private closed = false;
  private failed = false;
  private rotating: Promise<void> | undefined;
  private rotationTimer: NodeJS.Timeout | undefined;

  constructor(options: RotatingFileDestinationOptions) {
    this.directory = path.resolve(options.directory);
    this.now = options.now ?? (() => new Date());
    this.reportFailure = options.reportFailure ?? reportToStderr;
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.scheduleEnabled = options.schedule ?? true;
    this.streamFactory = options.streamFactory ?? defaultStreamFactory;
  }

  get healthy(): boolean {
    return !this.failed;
  }

  get currentFilePath(): string | undefined {
    return this.activeDate ? this.filePathFor(this.activeDate) : undefined;
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      await chmod(this.directory, 0o700);
      await this.cleanupExpiredFiles();
      await this.openFile(utcDateStamp(this.now()));
      if (this.scheduleEnabled) this.scheduleRotation();
    } catch (error) {
      this.fail('Unable to initialize the log destination', toError(error));
    }
  }

  write(message: string): void {
    if (this.closed || this.failed) return;
    if (this.rotating) {
      this.queuedMessages.push(message);
      return;
    }

    try {
      this.activeStream?.write(message);
    } catch (error) {
      this.fail('Unable to write to the log destination', toError(error));
    }
  }

  async flush(): Promise<void> {
    if (this.failed) return;
    if (this.rotating) await this.rotating;
    const stream = this.activeStream;
    if (!stream || stream.closed) return;

    try {
      await flushStream(stream);
    } catch (error) {
      this.fail('Unable to flush the log destination', toError(error));
    }
  }

  rotate(): Promise<void> {
    if (this.closed || this.failed) return Promise.resolve();
    if (this.rotating) return this.rotating;

    this.rotating = this.performRotation().finally(() => {
      this.rotating = undefined;
      if (!this.closed && !this.failed) this.drainQueuedMessages();
      else this.queuedMessages.length = 0;
    });
    return this.rotating;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearRotationTimer();
    if (this.rotating) await this.rotating;

    const stream = this.activeStream;
    this.activeStream = undefined;
    if (stream) {
      try {
        await closeStream(stream);
      } catch (error) {
        this.fail('Unable to close the log destination', toError(error));
      }
    }
  }

  private async performRotation(): Promise<void> {
    const nextDate = utcDateStamp(this.now());

    try {
      if (nextDate !== this.activeDate) {
        const previousStream = this.activeStream;
        this.activeStream = undefined;
        if (previousStream) await closeStream(previousStream);
        await this.openFile(nextDate);
      } else {
        await this.flushActiveStream();
      }

      await this.cleanupExpiredFiles();
    } catch (error) {
      this.fail('Unable to rotate the log destination', toError(error));
    } finally {
      if (this.scheduleEnabled && !this.closed && !this.failed) this.scheduleRotation();
    }
  }

  private async openFile(dateStamp: string): Promise<void> {
    const filePath = this.filePathFor(dateStamp);
    const stream = this.streamFactory(filePath, { flags: 'a', mode: 0o600 });

    await waitForOpen(stream);
    await chmod(filePath, 0o600);

    stream.on('error', (error: Error) => {
      this.fail('Log destination stream failed', error);
    });

    this.activeDate = dateStamp;
    this.activeStream = stream;
    await this.updateCurrentLink(filePath);
  }

  private async updateCurrentLink(filePath: string): Promise<void> {
    const currentPath = path.join(this.directory, 'current.log');
    const existing = await lstat(currentPath).catch(() => undefined);

    if (existing?.isSymbolicLink()) {
      const target = await readlink(currentPath).catch(() => undefined);
      if (target === path.basename(filePath)) return;
    }
    if (existing) await unlink(currentPath);

    try {
      await symlink(path.basename(filePath), currentPath);
    } catch (error) {
      // Windows may forbid file symlinks without Developer Mode; a hard link preserves live access.
      try {
        await link(filePath, currentPath);
      } catch {
        this.reportOnce('Unable to update current.log', toError(error));
      }
    }
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      await deleteExpiredLogFiles(this.directory, this.now(), this.retentionDays);
    } catch (error) {
      this.reportOnce('Unable to delete expired log files', toError(error));
    }
  }

  private async flushActiveStream(): Promise<void> {
    const stream = this.activeStream;
    if (!stream || stream.closed) return;
    await flushStream(stream);
  }

  private drainQueuedMessages(): void {
    const messages = this.queuedMessages.splice(0);
    for (const message of messages) this.write(message);
  }

  private scheduleRotation(): void {
    this.clearRotationTimer();
    const delay = millisecondsUntilNextUtcMidnight(this.now());
    this.rotationTimer = setTimeout(() => {
      this.rotationTimer = undefined;
      void this.rotate();
    }, delay);
    this.rotationTimer.unref();
  }

  private clearRotationTimer(): void {
    if (!this.rotationTimer) return;
    clearTimeout(this.rotationTimer);
    this.rotationTimer = undefined;
  }

  private fail(context: string, error: Error): void {
    if (this.failed) return;
    this.failed = true;
    this.clearRotationTimer();
    this.queuedMessages.length = 0;

    const stream = this.activeStream;
    this.activeStream = undefined;
    stream?.destroy();
    this.reportOnce(context, error);
  }

  private reportOnce(context: string, error: Error): void {
    if (this.reportedFailures.has(context)) return;
    this.reportedFailures.add(context);
    try {
      this.reportFailure(context, error);
    } catch {
      // Failure reporting is part of the logging boundary and must also fail open.
    }
  }

  private filePathFor(dateStamp: string): string {
    return path.join(this.directory, `server.${dateStamp}.log`);
  }
}

function defaultStreamFactory(
  filePath: string,
  options: { flags: 'a'; mode: number },
): WriteStream {
  return createWriteStream(filePath, options);
}

function waitForOpen(stream: LogFileStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      stream.off('error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      stream.off('open', onOpen);
      reject(error);
    };

    stream.once('open', onOpen);
    stream.once('error', onError);
  });
}

function flushStream(stream: LogFileStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.off('error', onError);
      stream.off('close', onClose);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Log destination closed before it flushed.'));
    };

    stream.once('error', onError);
    stream.once('close', onClose);
    try {
      stream.write('', (error) => {
        cleanup();
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function closeStream(stream: LogFileStream): Promise<void> {
  if (stream.closed) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.off('error', onError);
      stream.off('close', onClose);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      resolve();
    };

    stream.once('error', onError);
    stream.once('close', onClose);
    try {
      stream.end();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function reportToStderr(context: string, error: Error): void {
  try {
    process.stderr.write(`[logging] ${context}: ${error.message}\n`);
  } catch {
    // Logging failures must never take down the server.
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
