import type { Server } from 'node:http';

import { createApp } from './app.js';
import { buildAppDependencies } from './composition.js';
import { config } from './config/index.js';
import { recordDeployment } from './infrastructure/analytics/deployment-history.js';
import { cleanExpiredRequestRollups } from './infrastructure/analytics/maintenance.js';
import { closeDatabaseConnection, db } from './infrastructure/database/client.js';
import { runDatabaseMigrations } from './infrastructure/database/migration-runner.js';
import { closeLogger, logger } from './infrastructure/logging/logger.js';
import { createShutdownHandler, handleStartupFailure } from './server-lifecycle.js';

/** Loads configuration, connects infrastructure, starts listening and handles shutdown. */
async function start(): Promise<void> {
  await runDatabaseMigrations();
  await recordDeployment(db, config.deployment.version, config.deployment.deployedAt);
  await cleanExpiredRequestRollups(db, logger);

  const deps = buildAppDependencies();
  const app = createApp(deps);

  const server: Server = app.listen(config.server.port, () => {
    logger.info({ port: config.server.port, environment: config.env }, 'API server started');
  });

  const shutdown = createShutdownHandler({
    server,
    logger,
    closeDatabase: closeDatabaseConnection,
    closeLogging: closeLogger,
    exit: process.exit,
  });

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

start().catch(async (error) => {
  await handleStartupFailure(error, {
    logger,
    closeDatabase: closeDatabaseConnection,
    closeLogging: closeLogger,
  });
  process.exitCode = 1;
});
