# Server logging operations

Monthloom writes API operational, HTTP, and approved audit records as newline-delimited JSON
(JSONL). Routine application records go to files only; Docker stdout/stderr is reserved for a
one-time emergency message if the file destination fails.

## Storage and lifecycle

Production sets `LOG_DIRECTORY=/app/logs` and mounts the dedicated `api_logs` named volume there.
The Compose project name is `monthloom-prod`, so Docker normally names the volume
`monthloom-prod_api_logs`. Database, upload, and log data use separate volumes.

- The active dated file is `server.YYYY-MM-DD.log`, using the UTC date.
- `current.log` identifies the active dated file.
- Rotation occurs at midnight UTC even when the API receives no traffic.
- Startup and rotation delete files after 90 complete days, on day 91.
- The directory is mode `0700`; dated files are mode `0600` and owned by the non-root `apiapp`
  container user.
- Normal shutdown flushes and closes the destination. A hard process or host failure can lose a
  small buffered tail.

The severity scale is:

| Level   | Meaning                                                                              |
| ------- | ------------------------------------------------------------------------------------ |
| `trace` | Extremely detailed diagnostics; normally disabled                                    |
| `debug` | Developer diagnostics                                                                |
| `info`  | Successful operations and normal HTTP responses                                      |
| `warn`  | Authentication failures, authorization denials, rate limits, and suspicious behavior |
| `error` | Failed operations and HTTP 5xx responses                                             |
| `fatal` | The process cannot safely start or continue                                          |

Successful `/health/live` and `/health/ready` requests are not recorded. Failed health requests
are recorded.

## Administrator inspection

Run these commands on the server from `/opt/monthloom`. Use the operator-managed production
Compose file and owner-only `.env.production`:

```bash
compose=(docker compose --env-file .env.production -f compose.production.local.yml)
"${compose[@]}" exec -T api sh -c 'ls -la /app/logs'
"${compose[@]}" exec -T api sh -c 'tail -n 100 /app/logs/current.log'
```

To locate the Docker volume and its host mount point:

```bash
docker volume ls --filter name=monthloom-prod_api_logs
docker volume inspect monthloom-prod_api_logs --format '{{.Mountpoint}}'
```

Prefer inspection through the API container. Direct host access to Docker's volume directory
normally requires root privileges. Do not change ownership or permissions to make inspection more
convenient.

Each line is an independent JSON object. Validate the current file without printing its contents:

```bash
"${compose[@]}" exec -T api node -e '
const fs = require("node:fs");
for (const line of fs.readFileSync("/app/logs/current.log", "utf8").split("\n")) {
  if (line) JSON.parse(line);
}
console.log("valid JSONL");
'
```

For a locally filtered view, pipe only the fields needed for the investigation through host `jq`:

```bash
"${compose[@]}" exec -T api sh -c 'tail -n 200 /app/logs/current.log' |
  jq -c '{time,level,category,event,outcome,requestId,actorUserId,statusCode,code,reason}'
```

Log access is server-administrator access. Keep copied extracts owner-readable, delete them when the
investigation ends, and do not paste raw records into public tickets or chat systems. There is no
log-reading HTTP API or admin-dashboard integration in this version.

## Privacy boundary

Logs intentionally exclude names, email addresses, passwords, cookies, authorization values,
session/reset/verification/invitation tokens, API keys, request and response bodies, raw query
strings, raw dynamic URLs, household/source labels, transaction amounts, dates, descriptions,
categories, filenames, file contents, and feedback text.

Internal UUIDs connect related records. IP addresses and user-agent values are permitted only for
registration, login, logout, password change/reset, email verification, account-access denials,
and rate-limit events. Ordinary HTTP and finance audit records do not include them.

## Failure behavior

Logging fails open. If the destination cannot initialize or fails at runtime, the API writes one
concise emergency message to stderr, switches to a discard destination, and continues serving.
Automatic destination recovery is not attempted until the process restarts. Graceful shutdown
waits for logging, but the existing ten-second forced-shutdown timer still terminates a stuck
process.

Because routine records are file-only, `docker compose logs api` is not the audit trail. It can
still contain emergency logger failures and container/runtime diagnostics.

## Operator-managed Compose file

`compose.production.local.yml` is a complete production topology containing the `api_logs` volume,
`/app/logs` mount, `LOG_DIRECTORY=/app/logs`, and `TZ=UTC`. It is intentionally ignored by Git and
must be preserved, reviewed, transferred to `/opt/monthloom`, and modified manually by the server
operator.

Validate it before every deployment:

```bash
docker compose --env-file .env.production -f compose.production.local.yml config --quiet
COMPOSE_FILE=compose.production.local.yml ./infrastructure/production/deploy.sh
```

Git pulls do not update this file. Compare it with tracked `compose.prod.yml` after deployment
changes and manually carry forward relevant topology, image, health-check, or security updates.
Configure the automatic updater to use the same file with a systemd override:

```ini
[Service]
Environment=COMPOSE_FILE=/opt/monthloom/compose.production.local.yml
```

After creating the override, run `sudo systemctl daemon-reload` and manually start
`monthloom-update.service` once to verify the effective configuration.
