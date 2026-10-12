# Production concerns

The Hetzner single-server deployment implements TLS termination, private container networks,
secure cookies, and persistent local volumes. The following concerns remain environment- and
organization-specific and must be addressed before relying on the service for irreplaceable data:

- **Managed database** — the Hetzner stack runs PostgreSQL in a local Docker volume. This is
  suitable for an initial single-server deployment but is not highly available. Use managed/HA
  Postgres when availability requirements justify it.
- **Object storage** — `LocalFileStorage` is a development adapter. Implement a `FileStorage`
  adapter backed by S3, Azure Blob Storage, or Google Cloud Storage for production (see ADR 0004).
- **Backup policy** — a backup helper is included, but scheduling, encrypted off-server transfer,
  retention, monitoring, and restore drills must be configured operationally.
- **Secret management** — the initial deployment uses an owner-only `.env.production` file.
  Move to a secret manager when the operational environment supports one.
- **Monitoring, metrics and tracing** — only structured request/error logging is included. No
  hosted logging, metrics, tracing, analytics, or error-reporting provider is wired up.
- **Horizontal scaling of sessions** — sessions are stored in Postgres (not in-memory), so multiple
  API instances already share session state; however, no load balancer or autoscaling
  configuration is provided.

See [`deployment-hetzner.md`](deployment-hetzner.md) for the implemented topology and launch
runbook.
