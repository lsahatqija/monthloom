import type { Logger } from './infrastructure/logging/logger.js';

interface ClosableServer {
  close(callback: (error?: Error) => void): void;
}

interface LifecycleDependencies {
  closeDatabase(): Promise<void>;
  closeLogging(): Promise<void>;
  logger: Logger;
}

interface ShutdownDependencies extends LifecycleDependencies {
  exit(code: number): void;
  server: ClosableServer;
}

const FORCE_SHUTDOWN_MS = 10_000;

export function createShutdownHandler({
  closeDatabase,
  closeLogging,
  exit,
  logger,
  server,
}: ShutdownDependencies): (signal: string) => void {
  let isShuttingDown = false;
  let forceTimer: NodeJS.Timeout | undefined;

  return (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Shutting down gracefully...');

    server.close(async (closeError) => {
      if (closeError) logger.error({ err: closeError }, 'Error while closing HTTP server');

      try {
        await closeDatabase();
      } catch (error) {
        logger.error({ err: error }, 'Error while closing database connection');
      }

      logger.info('Shutdown complete.');
      try {
        await closeLogging();
      } catch (error) {
        logger.error({ err: error }, 'Error while closing log destination');
      } finally {
        if (forceTimer) clearTimeout(forceTimer);
        exit(closeError ? 1 : 0);
      }
    });

    forceTimer = setTimeout(() => {
      logger.fatal('Forced shutdown after timeout.');
      exit(1);
    }, FORCE_SHUTDOWN_MS);
    forceTimer.unref();
  };
}

export async function handleStartupFailure(
  error: unknown,
  { closeDatabase, closeLogging, logger }: LifecycleDependencies,
): Promise<void> {
  logger.fatal({ err: error }, 'Failed to start API server');

  try {
    await closeDatabase();
  } catch (closeError) {
    logger.error({ err: closeError }, 'Error while closing database connection');
  }

  try {
    await closeLogging();
  } catch (closeError) {
    logger.error({ err: closeError }, 'Error while closing log destination');
  }
}
