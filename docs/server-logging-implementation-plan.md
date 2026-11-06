# Server logging implementation plan

## Status

- Phase: implementation in progress; Tasks 1-6 complete
- Approved: 2026-11-06
- Scope: durable server, HTTP, and selected audit logging for the Express API
- Implementation rule: complete and verify one task before starting the next

## 1. Goals

Implement a file-only server logging system that:

- preserves structured operational and HTTP logs;
- records approved meaningful user actions as audit events;
- rotates logs at exactly midnight UTC;
- keeps 90 complete days and deletes a file on day 91;
- survives API container replacement through a dedicated Docker volume;
- excludes secrets, personal content, and financial content;
- limits IP address and user-agent storage to account-security events;
- continues serving if logging becomes unavailable; and
- leaves a JSONL format suitable for a possible future admin dashboard.

This extends the existing Pino logger and request-ID infrastructure. It is not a new logging
framework.

## 2. Decisions

### 2.1 Output and storage

- Production application logs go to files only. Routine records are not duplicated to stdout.
- Emergency logger failures may be written directly to stderr so Docker can retain the failure
  signal independently of the broken destination.
- Output is newline-delimited JSON (JSONL), one complete object per line.
- Timestamps use ISO-8601 UTC.
- The active dated file is `server.YYYY-MM-DD.log`.
- `current.log` points to the active dated file.
- Rotation occurs at `00:00:00 UTC`, including when there is no request traffic.
- Cleanup runs after rotation and during startup.
- A dated file is deleted after 90 complete days, on day 91.
- The log directory uses mode `0700`; log files use mode `0600` where supported.
- Log files live in a dedicated Docker named volume, separate from database and uploads.
- Logging is asynchronous. A hard process or host failure may lose the final buffered records.

### 2.2 Severity scale

Use Pino's existing levels with string labels in stored records:

| Level | Intended use |
| --- | --- |
| `trace` | Extremely detailed diagnostics; normally disabled |
| `debug` | Developer diagnostics |
| `info` | Successful operations and normal HTTP responses |
| `warn` | Authentication failures, authorization denials, rate limits, and suspicious behavior |
| `error` | Failed operations and HTTP 5xx responses |
| `fatal` | A process cannot safely start or continue |

Audit importance is represented by `category`, `event`, and `outcome`, not by inflating severity.
A successful sensitive action remains `info`.

### 2.3 Categories

- `system`: lifecycle, database, email, migrations, and unexpected process failures
- `http`: sanitized HTTP request completion
- `audit`: approved meaningful user actions and security-relevant failures

### 2.4 Retention and tamper protection

- Retention is fixed at 90 days for this version.
- Protection consists of restricted filesystem permissions.
- Cryptographic hash chaining, signing, immutable storage, and off-server archival are deferred.

### 2.5 Failure policy

If the destination cannot be initialized or fails at runtime:

1. Write one concise emergency record to stderr.
2. Switch to a discard destination without throwing into application requests.
3. Continue serving traffic.
4. Avoid repeated stderr messages for the same failure state.
5. Recover only on process restart in this version.

This fail-open policy is intentional. An unavailable audit file must not make the expense tracker
unavailable.

## 3. Record schema

All records share this stable base:

```json
{
  "schemaVersion": 1,
  "time": "2026-11-06T18:42:15.123Z",
  "level": "info",
  "service": "api",
  "category": "audit",
  "msg": "User login succeeded"
}
```

Optional structured fields are added only when relevant:

- `event`
- `outcome`: `success`, `failure`, or `denied`
- `requestId`
- `actorUserId`
- `targetUserId`
- `householdId`
- `sourceId`
- `transactionId`
- `transactionKind`
- `recurrenceScope`
- `sentCount`
- `failedCount`
- `method`
- `route`
- `statusCode`
- `durationMs`
- `code`
- `reason`
- `ip` and `userAgent`, only for approved security events
- `err`, using Pino's error serializer for operational errors

Fields remain at the top level to keep JSONL filtering simple. No arbitrary request objects or DTOs
are passed to the logger.

## 4. Privacy and redaction policy

Never record:

- names or email addresses;
- passwords or password hashes;
- cookies, authorization values, session tokens, reset tokens, verification tokens, invitation
  tokens, API keys, or other secrets;
- household names, source names, or other user-entered labels;
- transaction amounts, descriptions, dates, or other financial values;
- filenames, file contents, or feedback text;
- request bodies or response bodies;
- raw URLs, query strings, or raw dynamic route values; or
- full application input/output objects.

Internal UUIDs are allowed where needed to connect an audit trail. The existing Pino redaction list
remains as defense in depth and must be expanded if tests reveal an uncovered secret shape.

IP and user-agent fields are allowed only for:

- registration;
- login success and failure;
- logout;
- password change;
- password-reset request and completion;
- email-verification request and completion;
- authentication and authorization denials involving account access; and
- rate-limit events.

HTTP request records and ordinary finance audit records must not contain IP or user agent.

## 5. HTTP logging behavior

Each completed HTTP record contains only:

- request ID;
- HTTP method;
- Express route template;
- status code;
- duration in milliseconds; and
- authenticated user ID when available.

Examples of stored route templates:

```text
/api/v1/households/:id/transactions
/api/v1/invitations/:token/accept
```

Query strings and actual route parameter values are not stored. For an unmatched route, record a
safe normalized pathname with the query string removed; do not attempt to reconstruct or retain
parameter-like segments.

HTTP severity rules:

- `info`: 2xx, 3xx, and ordinary 400, 404, and 409 responses
- `warn`: 401, 403, 429, and security-sensitive conflicts
- `error`: 5xx responses and failed health checks
- no record: successful `/health/live` and `/health/ready` requests

The central error handler must not create a duplicate warning for every expected 4xx response.
Unexpected errors still receive a structured operational error record with their request ID.

## 6. Audit events

### 6.1 Authentication and account security

| Event | Success fields | Failure behavior | IP/user agent |
| --- | --- | --- | --- |
| `auth.registration` | created `actorUserId` | expected conflict is a warning without submitted identity | yes |
| `auth.login` | `actorUserId` | generic failure; include no email or account-existence signal | yes |
| `auth.logout` | `actorUserId` | record an operational error only if session revocation fails | yes |
| `auth.password_changed` | `actorUserId` | generic failure/denial code | yes |
| `auth.password_reset_requested` | target user ID only when internally resolved | external behavior and message remain identical for known/unknown accounts | yes |
| `auth.password_reset_completed` | resolved `actorUserId` | rejected, expired, or reused token is a warning; never store token | yes |
| `auth.email_verification_requested` | `actorUserId` | generic failure/denial code | yes |
| `auth.email_verification_completed` | resolved `actorUserId` | rejected, expired, or reused token is a warning; never store token | yes |

Authentication failures, authorization denials, and rate limits use `warn`. Successful operations
use `info`.

### 6.2 Household and invitations

| Event | Fields |
| --- | --- |
| `household.invitation_sent` | actor, household, successful count, failed count |
| `household.invitation_accepted` | actor and household |
| `household.left` | actor and household |
| `household.member_removed` | actor, target user, and household |
| `household.ownership_transferred` | old owner, new owner, and household |

Invitation acceptance represents both joining the household and accepting the invitation. Do not
emit a redundant second `household.joined` record.

When an owner leaves with `newOwnerId`, emit `household.ownership_transferred` followed by
`household.left`. The ownership transfer prevents an orphaned household.

### 6.3 Sources

| Event | Fields |
| --- | --- |
| `source.created` | actor, household, source ID |
| `source.updated` | actor, household, source ID |
| `source.deleted` | actor, household, source ID |
| `source.copied` | actor, source/destination household IDs, copied count |

Do not log source names or aliases.

### 6.4 Transactions

| Event | Fields |
| --- | --- |
| `transaction.created` | actor, household, transaction ID, kind |
| `transaction.updated` | actor, household, transaction ID, kind, recurrence scope when applicable |
| `transaction.deleted` | actor, household, transaction ID, kind, recurrence scope when applicable |

Do not log amounts, dates, descriptions, categories, source names, or before/after DTOs.

### 6.5 Explicitly outside audit scope

These still produce sanitized HTTP logs but no dedicated audit event in this version:

- profile edits other than password change;
- household create, rename, visual update, primary selection, and deletion;
- file upload, download, and deletion;
- feedback submission; and
- read-only finance operations.

## 7. Implementation design

### 7.1 Logger destination

Use a small application-owned rotating writable built on Node's file streams. `pino-roll` was
evaluated and rejected during Task 2 because version 4 always adds a numeric filename segment,
uses local time for calendar formatting, and omits its declared TypeScript file from the published
package. The local destination keeps the exact UTC filename and fail-open behavior without an
additional runtime dependency.

Wrap the rotating destination behind a resilient writable destination:

- initialization verifies/creates the directory and permissions;
- runtime destination errors are handled rather than allowed to become unhandled stream errors;
- the wrapper atomically switches its current sink to a no-op writable after failure;
- an emergency stderr message bypasses Pino to avoid recursion; and
- graceful shutdown closes and flushes the healthy destination.

Do not implement a general transport framework or multiple output targets.

### 7.2 Audit instrumentation

Use route-level audit metadata so both successful and rejected selected operations can produce one
consistent record. The audit middleware should:

- declare the event before rate limits, authentication, or the controller can fail;
- observe response completion;
- derive `outcome` from the response/error metadata;
- read actor identity only after authentication has had a chance to populate it;
- accept narrowly typed safe fields supplied by controllers after a successful service operation;
- attach IP and user agent only when that route/event explicitly permits them; and
- never accept arbitrary DTOs or request bodies.

Controllers supply result IDs and safe operation metadata that cannot be known before the service
call. Services remain focused on domain behavior and do not receive Express request objects.

Rate-limit handlers need explicit audit integration because some rate limits run before controllers.

### 7.3 Logger lifecycle

The server startup/shutdown path must:

- initialize the destination before recording normal startup messages;
- use `fatal` for unrecoverable startup and uncaught-process failures;
- flush logs before a normal process exit;
- preserve the existing forced-shutdown timeout; and
- avoid waiting indefinitely for a broken destination.

## 8. Configuration and deployment

### 8.1 Runtime configuration

Add:

```dotenv
LOG_DIRECTORY=logs
```

Keep:

```dotenv
LOG_LEVEL=info
```

Retention and timezone are fixed policy constants in this version: 90 days and UTC. Tests use a
discard destination by default so importing API modules does not create test log files.

### 8.2 Docker image

Update the API image to create `/app/logs` and assign it to the existing non-root `apiapp` user.
The application must continue running as `apiapp`; do not run it as root to simplify volume access.

### 8.3 Complete local production Compose

Preserve the tracked `compose.prod.yml` as a repository reference. Do not remove or untrack it.

Create a complete, intentionally untracked production file named:

```text
compose.production.local.yml
```

Add an exact root-level ignore entry for that filename. The complete file will contain the full
production topology rather than acting as an override and will configure the API with:

```yaml
environment:
  LOG_DIRECTORY: /app/logs
  TZ: UTC

volumes:
  - api_logs:/app/logs
```

It will declare `api_logs` as a named volume distinct from `postgres_data` and `uploads_data`.
Routine application logs will not use Docker's stdout log driver; Docker may still retain emergency
stderr output.

The untracked file is local operational state and must be transferred and modified manually by the
operator as approved.

## 9. Task checklist

Each task ends with its own checks. Do not begin the next task while the current task has unresolved
failures.

### Task 1: Configuration and dependency

- [x] Evaluate the rotation dependency and keep the implementation dependency-free when it does
      not satisfy the approved filename, UTC, and TypeScript requirements.
- [x] Add and validate `LOG_DIRECTORY`.
- [x] Map it into `config.logging.directory`.
- [x] Document it in `.env.example` and runtime configuration docs.
- [x] Add configuration-schema tests for default, override, and invalid empty values.
- [x] Run API typecheck and the environment-schema unit tests.

Completion condition: configuration is typed and tested; logging behavior is unchanged.

### Task 2: Rotating resilient destination

- [x] Add directory setup with restrictive permissions.
- [x] Add a daily UTC rotating destination and `current.log` link.
- [x] Add exact date-based 90-day cleanup at startup and rollover.
- [x] Add the fail-open writable wrapper and one-time emergency stderr reporting.
- [x] Add explicit close/flush support.
- [x] Unit-test naming, UTC boundary calculation, retention, failure fallback, and shutdown flush.
- [x] Integration-test writes and rollover in a temporary directory.

Completion condition: a standalone logger destination rotates, cleans, flushes, and fails open
without changing application call sites.

### Task 3: Structured logger schema

- [x] Connect the shared Pino logger to the new destination.
- [x] Emit ISO UTC timestamps and string severity labels.
- [x] Add `schemaVersion`, `service`, and explicit `category` fields.
- [x] Preserve and test secret redaction.
- [x] Use a discard destination in tests unless a test opts into a temporary directory.
- [x] Update existing logger mocks/types only where compilation requires it.
- [x] Run logger tests, API typecheck, and lint.

Completion condition: existing operational calls produce valid JSONL files with the approved base
schema and no secrets.

### Task 4: HTTP logging and sanitization

- [x] Replace raw URL storage with route-template storage.
- [x] Strip query strings and avoid raw parameter values for unmatched routes.
- [x] Add authenticated user ID when available.
- [x] Implement approved severity mapping.
- [x] Suppress successful liveness/readiness records while retaining failures.
- [x] Remove duplicate expected-4xx warnings from the central error handler.
- [x] Test tokenized invitation routes, query strings, unmatched routes, health checks, and levels.
- [x] Run focused HTTP tests, the system integration tests, typecheck, and lint.

Completion condition: no HTTP record can expose an invitation token, query value, body, cookie, or
authorization header.

### Task 5: Audit infrastructure

- [x] Define the closed audit event-name and safe-field types.
- [x] Add route-level audit metadata middleware.
- [x] Add narrowly scoped controller helpers for safe result fields.
- [x] Map response status/error metadata to `success`, `failure`, or `denied`.
- [x] Support opt-in IP/user-agent recording for security events only.
- [x] Integrate rate-limit audit records.
- [x] Test success, expected failure, denial, and field allowlisting.
- [x] Prove that arbitrary bodies/DTOs cannot be passed through the audit API.

Completion condition: audit plumbing works on a representative test route without instrumenting
the full event list yet.

### Task 6: Authentication audit events

- [x] Instrument registration.
- [x] Instrument login success and generic failure.
- [x] Instrument logout.
- [x] Instrument password change.
- [x] Instrument password-reset request and completion.
- [x] Instrument email-verification request and completion.
- [x] Test rate limits, invalid/expired/reused tokens, and authentication denials.
- [x] Test that submitted email, passwords, cookies, and tokens never appear.
- [x] Test that IP/user agent appear on these events and nowhere else.
- [x] Run auth unit/integration tests, typecheck, and lint.

Completion condition: all approved account-security events are complete and privacy-tested.

### Task 7: Household and invitation audit events

- [ ] Instrument invitation send with counts only.
- [ ] Instrument invitation acceptance as the household join event.
- [ ] Instrument member removal.
- [ ] Instrument household leave.
- [ ] Emit ownership transfer before leave when `newOwnerId` is used.
- [ ] Test failures and authorization denials.
- [ ] Test that invitation tokens, email recipients, and household names never appear.
- [ ] Run finance unit/integration tests, typecheck, and lint.

Completion condition: approved membership lifecycle events are complete, including the
non-orphaning owner-leave flow.

### Task 8: Source and transaction audit events

- [ ] Instrument source create, update, delete, and copy.
- [ ] Instrument transaction create, update, and delete.
- [ ] Include IDs, kind, counts, and recurrence scope only where approved.
- [ ] Test successful operations, failures, and denials.
- [ ] Test that amounts, dates, descriptions, categories, source names, and DTOs never appear.
- [ ] Run finance unit/integration tests, typecheck, and lint.

Completion condition: every approved finance mutation produces a minimal safe audit record.

### Task 9: Process lifecycle and failure severity

- [ ] Update unrecoverable startup/process records to `fatal`.
- [ ] Flush during graceful shutdown.
- [ ] Preserve the forced-shutdown timeout without hanging on the logger.
- [ ] Confirm database/email operational errors retain useful request or entity IDs without PII.
- [ ] Test graceful and failed destination shutdown behavior where practical.
- [ ] Run server tests, typecheck, and lint.

Completion condition: normal shutdown flushes; a broken logger cannot prevent process shutdown or
request handling.

### Task 10: Docker and local production Compose

- [ ] Create `/app/logs` with `apiapp` ownership in the API image.
- [ ] Add the exact ignore entry for `compose.production.local.yml`.
- [ ] Create the complete ignored production Compose file.
- [ ] Add the separate `api_logs` volume and `/app/logs` mount.
- [ ] Set `LOG_DIRECTORY=/app/logs` and `TZ=UTC` for the API.
- [ ] Confirm the application remains non-root.
- [ ] Build the API image.
- [ ] Validate the Compose file with `docker compose config` when Docker is available.
- [ ] Manually verify volume persistence across API container recreation when Docker is available.

Completion condition: production-style container recreation preserves dated log files in a volume
that is not shared with PostgreSQL or uploads.

### Task 11: Documentation and final verification

- [ ] Document file locations, naming, severity, retention, permissions, and failure behavior.
- [ ] Document JSONL inspection with safe local tools.
- [ ] Document how a server administrator locates the named volume and current file.
- [ ] Document the privacy exclusions and limited IP policy.
- [ ] Document the untracked Compose file workflow.
- [ ] Run formatting checks.
- [ ] Run complete typecheck, lint, API unit/integration tests, and production build.
- [ ] Review the final diff specifically for accidental PII, token, or raw URL logging.

Completion condition: all checks pass and documentation matches implemented behavior.

## 10. Final acceptance criteria

The feature is complete only when all of the following are demonstrated:

- Every stored line is valid JSON and contains a named severity.
- A new dated file becomes active at midnight UTC without request traffic.
- `current.log` identifies the active file.
- A dated file is automatically removed on day 91.
- Logs survive API container replacement in their own named volume.
- The API runs as a non-root user and log access is restricted.
- Successful health probes create no records; failures do.
- HTTP records contain route templates, never raw invitation tokens or queries.
- Every approved audit event is covered by an automated test.
- IP and user agent occur only in approved security records.
- No forbidden personal, secret, or financial content appears in fixtures or captured logs.
- A logger startup/runtime failure does not stop the API.
- A graceful shutdown flushes buffered records.
- Typecheck, lint, tests, formatting, and production build pass.

## 11. Deferred work

Do not implement these as part of this plan:

- compression;
- a log-reading or download API;
- the future admin dashboard;
- cryptographic tamper evidence;
- immutable or off-server archival;
- automated destination recovery without restart;
- metrics, tracing, hosted error reporting, or alerting;
- log content search/indexing;
- size-based within-day rotation; or
- multi-instance coordination or centralized logging.

## 12. Known risks and upgrade triggers

- A hard crash can lose a small buffered tail. Upgrade to stronger durability only if audit policy
  requires it.
- Restricted permissions do not reveal administrator tampering. Add signed daily digests and
  off-server storage if tamper evidence becomes required.
- A single daily file has no size ceiling. Add size segments if real traffic or abuse makes daily
  files operationally unsafe.
- The file strategy assumes one API instance writes to the volume. Before horizontal scaling, move
  to per-instance files or centralized logging.
- File-only routine logging makes `docker logs` unsuitable for normal investigation. Operators must
  inspect the mounted volume; stderr remains only an emergency channel.
- The complete production Compose file is intentionally untracked and therefore is not protected by
  repository history. The operator is responsible for preserving the deployed copy.
