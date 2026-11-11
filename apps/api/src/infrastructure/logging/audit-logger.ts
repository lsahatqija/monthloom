import type { Request, RequestHandler, Response } from 'express';
import type { RateLimitExceededEventHandler } from 'express-rate-limit';

import { config } from '../../config/index.js';
import { recordRateLimitEvent } from '../analytics/product-events.js';

import { createCategoryLogger, type Logger } from './logger.js';

export type AuditEventName =
  | 'auth.registration'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'auth.initial_password_changed'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.email_verification_requested'
  | 'auth.email_verification_completed'
  | 'household.invitation_sent'
  | 'household.invitation_accepted'
  | 'household.left'
  | 'household.member_removed'
  | 'household.ownership_transferred'
  | 'source.created'
  | 'source.updated'
  | 'source.deleted'
  | 'source.copied'
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.deleted'
  | 'security.rate_limited';

export interface AuditFields {
  actorUserId?: string;
  targetUserId?: string;
  householdId?: string;
  sourceId?: string;
  transactionId?: string;
  transactionKind?: 'income' | 'expense';
  recurrenceScope?:
    | 'past'
    | 'current'
    | 'future'
    | 'past_and_current'
    | 'past_and_future'
    | 'current_and_future'
    | 'past_current_and_future';
  sourceHouseholdId?: string;
  targetHouseholdId?: string;
  sentCount?: number;
  failedCount?: number;
  copiedCount?: number;
}

interface AuditEntry {
  event: AuditEventName;
  fields: AuditFields;
}

interface AuditContext {
  primary: AuditEntry;
  preceding: AuditEntry[];
  includeSecurityContext: boolean;
  logger: Logger;
}

interface AuditEventOptions {
  includeSecurityContext?: boolean;
  logger?: Logger;
}

const auditContextKey: unique symbol = Symbol('auditContext');
type AuditResponse = Response & { [auditContextKey]?: AuditContext };
const auditLogger = createCategoryLogger('audit');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function auditEvent(event: AuditEventName, options: AuditEventOptions = {}): RequestHandler {
  return (req, response, next) => {
    const res = response as AuditResponse;
    const context: AuditContext = {
      primary: { event, fields: {} },
      preceding: [],
      includeSecurityContext: options.includeSecurityContext ?? false,
      logger: options.logger ?? auditLogger,
    };
    res[auditContextKey] = context;

    let recorded = false;
    const recordOnce = (aborted = false) => {
      if (recorded) return;
      recorded = true;
      for (const entry of context.preceding) {
        recordAuditEvent(req, res, context, entry, aborted);
      }
      recordAuditEvent(req, res, context, context.primary, aborted);
    };

    res.once('finish', () => recordOnce());
    res.once('close', () => recordOnce(!res.writableFinished));
    next();
  };
}

export function setAuditFields(response: Response, fields: AuditFields): void {
  const context = (response as AuditResponse)[auditContextKey];
  if (!context) return;
  context.primary.fields = { ...context.primary.fields, ...sanitizeAuditFields(fields) };
}

export function addAuditEventBeforePrimary(
  response: Response,
  event: AuditEventName,
  fields: AuditFields,
): void {
  const context = (response as AuditResponse)[auditContextKey];
  if (!context) return;
  context.preceding.push({ event, fields: sanitizeAuditFields(fields) });
}

export function createAuditRateLimitHandler(
  logger: Logger = auditLogger,
): RateLimitExceededEventHandler {
  return (req, response, _next, options) => {
    const res = response as AuditResponse;
    res.locals.logErrorCode = 'RATE_LIMITED';
    res.locals.logErrorReason = 'RATE_LIMITED';
    res.status(options.statusCode);
    recordRateLimitEvent({
      ip: req.ip,
      routeGroup: req.baseUrl || req.path || 'api',
      secret: config.session.secret,
    });

    if (!res[auditContextKey]) {
      logger.warn(
        {
          event: 'security.rate_limited' satisfies AuditEventName,
          outcome: 'denied',
          requestId: req.id,
          code: 'RATE_LIMITED',
          reason: 'RATE_LIMITED',
          ...securityContext(req),
        },
        'Audit event',
      );
    }

    res.send(options.message);
  };
}

export const auditRateLimitHandler = createAuditRateLimitHandler();

function recordAuditEvent(
  req: Request,
  res: Response,
  context: AuditContext,
  entry: AuditEntry,
  aborted: boolean,
): void {
  const outcome = aborted
    ? 'failure'
    : res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429
      ? 'denied'
      : res.statusCode >= 400
        ? 'failure'
        : 'success';
  const fields = {
    event: entry.event,
    outcome,
    requestId: req.id,
    ...entry.fields,
    ...(!entry.fields.actorUserId && req.authUser && UUID.test(req.authUser.id)
      ? { actorUserId: req.authUser.id }
      : {}),
    ...(res.locals.logErrorCode ? { code: res.locals.logErrorCode as string } : {}),
    ...(res.locals.logErrorReason ? { reason: res.locals.logErrorReason as string } : {}),
    ...(context.includeSecurityContext ? securityContext(req) : {}),
  };

  if (res.statusCode >= 500) context.logger.error(fields, 'Audit event');
  else if (outcome !== 'success') context.logger.warn(fields, 'Audit event');
  else context.logger.info(fields, 'Audit event');
}

function sanitizeAuditFields(fields: AuditFields): AuditFields {
  const safe: AuditFields = {};
  if (fields.actorUserId && UUID.test(fields.actorUserId)) safe.actorUserId = fields.actorUserId;
  if (fields.targetUserId && UUID.test(fields.targetUserId))
    safe.targetUserId = fields.targetUserId;
  if (fields.householdId && UUID.test(fields.householdId)) safe.householdId = fields.householdId;
  if (fields.sourceId && UUID.test(fields.sourceId)) safe.sourceId = fields.sourceId;
  if (fields.transactionId && UUID.test(fields.transactionId)) {
    safe.transactionId = fields.transactionId;
  }
  if (fields.sourceHouseholdId && UUID.test(fields.sourceHouseholdId)) {
    safe.sourceHouseholdId = fields.sourceHouseholdId;
  }
  if (fields.targetHouseholdId && UUID.test(fields.targetHouseholdId)) {
    safe.targetHouseholdId = fields.targetHouseholdId;
  }
  if (fields.transactionKind === 'income' || fields.transactionKind === 'expense') {
    safe.transactionKind = fields.transactionKind;
  }
  if (
    fields.recurrenceScope === 'past' ||
    fields.recurrenceScope === 'current' ||
    fields.recurrenceScope === 'future' ||
    fields.recurrenceScope === 'past_and_current' ||
    fields.recurrenceScope === 'past_and_future' ||
    fields.recurrenceScope === 'current_and_future' ||
    fields.recurrenceScope === 'past_current_and_future'
  ) {
    safe.recurrenceScope = fields.recurrenceScope;
  }
  if (isSafeCount(fields.sentCount)) safe.sentCount = fields.sentCount;
  if (isSafeCount(fields.failedCount)) safe.failedCount = fields.failedCount;
  if (isSafeCount(fields.copiedCount)) safe.copiedCount = fields.copiedCount;
  return safe;
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function securityContext(req: Request): { ip?: string; userAgent?: string } {
  const userAgent = req.get('user-agent');
  return {
    ...(req.ip ? { ip: req.ip } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
  };
}
