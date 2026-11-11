import pino, { type DestinationStream } from 'pino';

import { config } from '../../config/index.js';

import {
  createRotatingFileDestination,
  type RotatingFileDestination,
} from './rotating-file-destination.js';

export type LogCategory = 'system' | 'http' | 'audit';

const sensitiveKeys = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmNewPassword',
  'passwordHash',
  'token',
  'sessionToken',
  'secret',
  'apiKey',
  'resendApiKey',
  'resendAdminKey',
];

const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  ...sensitiveKeys.flatMap((key) => [key, `*.${key}`]),
];

const discardDestination: RotatingFileDestination = {
  healthy: true,
  currentFilePath: undefined,
  write: () => undefined,
  flush: async () => undefined,
  rotate: async () => undefined,
  close: async () => undefined,
};

const logDestination =
  config.env === 'test'
    ? discardDestination
    : await createRotatingFileDestination({ directory: config.logging.directory });

export function createCategoryLogger(
  category: LogCategory,
  destination: DestinationStream = logDestination,
) {
  return pino(
    {
      level: config.logging.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: redactPaths,
        censor: '[REDACTED]',
      },
      base: {
        schemaVersion: 1,
        service: 'api',
        category,
        applicationVersion: config.deployment.version,
        deployedAt: config.deployment.deployedAt,
      },
    },
    destination,
  );
}

export const logger = createCategoryLogger('system');

export async function flushLogger(): Promise<void> {
  await logDestination.flush();
}

export async function closeLogger(): Promise<void> {
  await logDestination.close();
}

export type Logger = typeof logger;
