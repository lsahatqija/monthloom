import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';
import type { DestinationStream, LevelWithSilent } from 'pino';
import { pinoHttp, type Options } from 'pino-http';

import { createCategoryLogger } from './logger.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;
const SECURITY_SENSITIVE_CONFLICTS = new Set([
  'EMAIL_ALREADY_REGISTERED',
  'ALREADY_HOUSEHOLD_MEMBER',
]);

const genReqId: NonNullable<Options<Request, Response>['genReqId']> = (req, res) => {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const id = candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
};

export function safeRouteTemplate(req: Request): string {
  const routePath: unknown = req.route?.path;
  if (typeof routePath !== 'string') return '<unmatched>';

  const template = `${req.baseUrl}${routePath}`.replace(/\/{2,}/g, '/');
  return template.length > 1 ? template.replace(/\/$/, '') : template;
}

function isHealthCheck(req: Request): boolean {
  const route = safeRouteTemplate(req);
  return route === '/health/live' || route === '/health/ready';
}

function httpLogLevel(req: Request, res: Response, error?: Error): LevelWithSilent {
  if (isHealthCheck(req)) return !error && res.statusCode < 400 ? 'silent' : 'error';
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) return 'warn';
  if (
    res.statusCode === 409 &&
    SECURITY_SENSITIVE_CONFLICTS.has(res.locals.logErrorReason as string)
  ) {
    return 'warn';
  }
  return 'info';
}

function completedRequest(req: Request, res: Response, responseTime: number) {
  return {
    method: req.method,
    route: safeRouteTemplate(req),
    statusCode: res.statusCode,
    durationMs: responseTime,
    ...(req.authUser ? { actorUserId: req.authUser.id } : {}),
  };
}

/** HTTP request logger. Records only safe route templates and completion metadata. */
export function createHttpLogger(destination?: DestinationStream) {
  const logger = createCategoryLogger('http', destination);

  return pinoHttp<Request, Response>({
    logger,
    genReqId,
    customAttributeKeys: { reqId: 'requestId' },
    customLogLevel: httpLogLevel,
    customSuccessObject: (req, res, value: { responseTime: number }) =>
      completedRequest(req, res, value.responseTime),
    customErrorObject: (req, res, _error, value: { responseTime: number }) =>
      completedRequest(req, res, value.responseTime),
    quietReqLogger: true,
    quietResLogger: true,
  });
}

export const httpLogger = createHttpLogger();
