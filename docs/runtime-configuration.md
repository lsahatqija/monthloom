# Runtime configuration

This document is the canonical map from each runtime workflow to its Compose definition. Run all
commands from the repository root.

## Canonical workflows

| Workflow                    | Definition                            | Canonical command                                                                                                                                              |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local container development | `compose.yml`                         | `docker compose -f compose.yml up --build -d`                                                                                                                  |
| Integration-test database   | `compose.test.yml`                    | `pnpm test:db:up`, then `pnpm test:integration`; finish with `pnpm test:db:down`                                                                               |
| Build and publish images    | `compose.yml` + `compose.publish.yml` | `$env:IMAGE_TAG = '<tag>'; docker compose -f compose.yml -f compose.publish.yml build; docker compose -f compose.yml -f compose.publish.yml push` (PowerShell) |
| Production deployment       | `compose.prod.yml`                    | `docker compose --env-file .env.production -f compose.prod.yml up -d`                                                                                          |

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
- `compose.prod.yml` explicitly owns public URLs, secure cookies, trusted-proxy configuration,
  production secret interpolation, network isolation, and persistent storage mounts.
- `.env.production` is an uncommitted, mode-`0600` server file based on
  `infrastructure/production/env.example`.

The API rejects invalid configuration before listening. `DATABASE_URL` and `SESSION_SECRET` are
always required. Production Compose explicitly enables secure session cookies. Selecting
`EMAIL_TRANSPORT=resend` also requires `RESEND_API_KEY`; log delivery deliberately needs no
provider secret. Compose uses required interpolation for production infrastructure credentials,
the public domain, image tag, and sender address, so omissions fail during Compose evaluation.

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

## Production durability

`postgres_data`, `uploads_data`, `caddy_data`, and `caddy_config` are named Docker volumes. The
first two contain irreplaceable application state and must be backed up off-host together: database
records can reference uploaded files, so restoring only one can leave inconsistent state. Never run
`docker compose down -v` or prune volumes on the production host. The single-server layout is not
highly available; before storing irreplaceable data, configure tested off-host backups, restore
drills, disk alerts, and external `/health/ready` monitoring. See the deployment runbook for the
backup commands and migration rollback constraints.
