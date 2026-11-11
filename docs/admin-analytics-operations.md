# Administration analytics operations

This runbook defines the production boundaries for the administration analytics dashboard.

## Data and privacy policy

- `product_events` is an append-only audit and analytics ledger. Keep it for the lifetime of the
  installation unless a separately reviewed legal or storage policy requires deletion. The
  application database role cannot update or delete these rows.
- `request_hourly_rollups` contains aggregate route-template metrics only. Keep at least 400 days so
  the maximum 366-day dashboard range has a complete comparison period. Delete older rows in a
  scheduled maintenance job only after a successful backup.
- Permitted dimensions are normalized route templates, HTTP method/status class, application/client
  version, event names, pseudonymous IDs, and allow-listed event metadata.
- Never add transaction descriptions, email addresses, raw IP addresses, user-agent strings,
  credentials, request bodies, or raw URLs to events, rollups, logs, or dashboard responses.

## Release verification

1. Run `pnpm config:check`, `pnpm typecheck`, `pnpm test:typecheck`, `pnpm test`, and `pnpm build`.
2. Restore the latest production backup into a disposable database and run `pnpm db:migrate`.
   Confirm the application starts and existing users, households, and transactions are unchanged.
3. Record migration and analytics-backfill duration. Stop the release if it exceeds the deployment
   maintenance window; do not interrupt a running migration.
4. On production-like data, request each analytics view for 7, 30, 90, and 366 days. The initial
   budget is 1 second at API p95 for 90-day views and 2 seconds for 366-day views.
5. Use `EXPLAIN (ANALYZE, BUFFERS)` for a slow query. Range scans must use the
   `product_events` time/event indexes or `request_hourly_rollups_range_idx`; avoid plans that scan
   unrelated full tables as data grows.
6. Confirm a regular user receives 403 and an unauthenticated request receives 401 for every
   `/api/v1/admin/*` endpoint. Inspect one response to confirm it contains no personal fields.

The historical backfill is idempotent through event identity constraints and records
`analytics.collection_started`. Views before that timestamp intentionally show partial coverage.
Do not synthesize activity, failure, deletion, or latency history.

## Rollup cleanup and shutdown

Telemetry upserts each completed request directly into PostgreSQL; there is no in-memory analytics
buffer to flush during shutdown. Graceful shutdown stops HTTP acceptance before closing PostgreSQL.
A hard process failure can omit the final in-flight request metric but must never fail or roll back
the product request.

The API runs this cleanup at startup after migrations. It is safe to run the same statement from a
scheduled maintenance job after backup verification if the API remains up for long periods:

```sql
DELETE FROM request_hourly_rollups
WHERE hour < date_trunc('hour', now()) - interval '400 days';
```

Log the deleted row count and alert on failure. Run `VACUUM (ANALYZE) request_hourly_rollups` after
an unusually large first cleanup. Never apply this cleanup to `product_events`.

## Backup reporting

The dashboard displays backup state as **unknown** until authenticated backup reporting is wired.
Unknown is not success. Until then, monitor the production backup job externally and record its
completion, artifact timestamps, encrypted off-server copy, and latest successful restore drill.

Follow [`deployment-hetzner.md`](deployment-hetzner.md) for backup and restore commands. Do not mark
backup reporting operational until stale reports alert and a restore has been tested.

## Rollback

Application rollback is safe because analytics migrations are additive and product writes do not
depend on dashboard reads. Roll back the application image while leaving new tables and columns in
place; do not reverse migrations or delete event/rollup data during an incident. Restore a backup
only for verified product-data corruption, not for an analytics rendering or query regression.
