# Runtime configuration

This document is the canonical map from each runtime workflow to its Compose definition. Run all
commands from the repository root.

## Canonical workflows

| Workflow                    | Definition                            | Canonical command                                                                                                                                              |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local container development | `compose.yml`                         | `docker compose -f compose.yml up --build -d`                                                                                                                  |
| Integration-test database   | `compose.test.yml`                    | `pnpm test:db:up`, then `pnpm test:integration`; finish with `pnpm test:db:down`                                                                               |
| Build and publish images    | `compose.yml` + `compose.publish.yml` | `$env:IMAGE_TAG = '<tag>'; docker compose -f compose.yml -f compose.publish.yml build; docker compose -f compose.yml -f compose.publish.yml push` (PowerShell) |
| Production reference        | `compose.prod.yml`                    | Tracked reference topology; do not deploy it when file logging is required                                                                                     |
| Production deployment       | `compose.production.local.yml`        | `COMPOSE_FILE=compose.production.local.yml ./infrastructure/production/deploy.sh`                                                                              |

For source-level development, start PostgreSQL with `docker compose -f compose.yml up -d postgres`
and run `pnpm dev`. The full container command above remains the reproducible local-stack check.
Production operators should follow the complete [Hetzner deployment runbook](deployment-hetzner.md),
which wraps the production command with migration, backup, update, and rollback handling.

## Configuration ownership

- `.env.example` is the inventory for API, web, seed, and local Compose variables. Run
  `pnpm config:check` to compare it with the API and web Zod schemas. CI runs the same check.
- `infrastructure/docker/api.defaults.env` owns safe, non-secret defaults shared by local and
  production Compose. Never add credentials or provider keys to it.
- `compose.yml` explicitly owns local URLs, local database credentials, insecure local cookies,
  and the development upload volume.
- `compose.prod.yml` is the tracked production reference. The complete
  `compose.production.local.yml` is intentionally ignored and operator-managed; it carries the
  reference topology plus the production log volume and must be transferred to the server
  manually.
- `.env.production` is an uncommitted, mode-`0600` server file based on
  `infrastructure/production/env.example`.

The API rejects invalid configuration before listening. `DATABASE_URL` and `SESSION_SECRET` are
always required. Production Compose explicitly enables secure session cookies. Selecting
`EMAIL_TRANSPORT=resend` also requires `RESEND_API_KEY`; log delivery deliberately needs no
provider secret. Compose uses required interpolation for production infrastructure credentials,
the public domain, image tag, and sender address, so omissions fail during Compose evaluation.

`LOG_LEVEL` selects the minimum Pino severity and `LOG_DIRECTORY` selects the application log
directory, defaulting to `logs` relative to the API working directory. Production sets it to
`/app/logs` in the dedicated `api_logs` volume. Logs rotate at midnight UTC and retain 90 complete
days. See [Server logging operations](server-logging.md) for inspection, privacy, permissions, and
failure behavior.

## Health probes

The local API health check uses `/health/live`: it proves the process serves HTTP without making a
temporary database interruption restart the app. Local startup already gates the API on the
PostgreSQL container's `pg_isready` check. Production uses `/health/ready`, which includes a real
database query, because Caddy must not route traffic to an API that cannot serve requests. The web
probe checks its root page, the PostgreSQL probe uses `pg_isready`, and the Caddy probe checks its
local admin endpoint. PostgreSQL has no published production port and remains on the internal
backend network.

## Email template lifecycle

All five templates are retained and synchronized by `pnpm email:templates:sync`:

| Template             | Invocation status                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome              | Sent after registration and includes the initial verification link.                                                                                       |
| Email verification   | Sent when an authenticated user requests a replacement verification link.                                                                                 |
| Password reset       | Sent by the password-reset request flow.                                                                                                                  |
| Household invitation | Sent by the household invitation flow for email recipients.                                                                                               |
| Monthly balance      | Intentionally dormant; retained for a future scheduled monthly-report job. `AutomatedEmailService.sendMonthlyReport` is the prepared invocation boundary. |

The synchronization-only `RESEND_ADMIN_KEY` is an operational option, not an application runtime
secret. Keep it out of `.env.production`; production delivery only receives `RESEND_API_KEY`.

## Administrator bootstrap

Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` together in the deployment-local `.env`
to create the first administrator when the API starts. The bootstrap is safe to rerun: it only
creates a missing email and never changes an existing account. Remove the password after successful
provisioning; use the normal password-reset flow or database-backed operational recovery for later
credential rotation.

## Production durability

`postgres_data`, `uploads_data`, `api_logs`, `caddy_data`, and `caddy_config` are named Docker
volumes. Database and uploads contain irreplaceable application state and must be backed up off-host
together: database records can reference uploaded files, so restoring only one can leave
inconsistent state. The log volume is separate and follows its own automatic 90-day retention.
Never run `docker compose down -v` or prune volumes on the production host. The single-server layout
is not highly available; before storing irreplaceable data, configure tested off-host backups,
restore drills, disk alerts, and external `/health/ready` monitoring. See the deployment runbook for
the backup commands and migration rollback constraints.
