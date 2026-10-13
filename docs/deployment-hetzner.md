# Production deployment on Hetzner

This runbook deploys Monthloom to one Ubuntu CX23 server with Docker Compose. Caddy is the only
internet-facing container and obtains and renews TLS certificates automatically. Web and API
traffic share one origin: Caddy sends `/api/*` and `/health/*` to the API and all other paths to
Next.js. PostgreSQL, the API, and Next.js have no published host ports.

This is a sound small-production topology, but the server remains a single point of failure.
Database and upload backups must be copied to separate, encrypted storage.

## 1. Decide the production values

Before changing DNS, choose:

- The hostname, such as `app.example.com`. `DOMAIN` never includes `https://` or a path.
- An operations email for ACME expiry/account notices.
- Whether to follow the automatic `latest` channel or pin an immutable Git commit SHA. CI publishes
  both `api-<sha>`/`web-<sha>` and paired `api-latest`/`web-latest` images after tests pass on
  `main`.
- The production sender domain and Resend API key, or `EMAIL_TRANSPORT=log` for a launch without
  outbound email. Account verification and password-reset messages are not delivered in `log`
  mode.
- An off-server backup destination and retention policy.

## 2. Secure the server

In Hetzner Cloud, create a firewall and attach it to the server:

| Direction | Protocol | Port | Source                               |
| --------- | -------- | ---- | ------------------------------------ |
| Inbound   | TCP      | 22   | administrator IP/CIDR only           |
| Inbound   | TCP      | 80   | any IPv4 and IPv6                    |
| Inbound   | TCP      | 443  | any IPv4 and IPv6                    |
| Inbound   | UDP      | 443  | any IPv4 and IPv6 (HTTP/3; optional) |
| Outbound  | any      | any  | any                                  |

Do not open 3000, 4000, or 5432. Keep the Hetzner firewall even if UFW is also enabled. Before
disabling SSH password authentication, verify a second terminal can log in using a non-root sudo
user and an SSH key. Enable automatic security updates and take a Hetzner snapshot before major
host-level changes; a snapshot is not a database backup.

Ubuntu 26.04 uses Chrony as its default time daemon, so `systemd-timesyncd` is normally absent.
Verify synchronization with `systemctl status chrony` and `chronyc tracking`.

Install Docker Engine and the Compose plugin from
[Docker's official Ubuntu repository](https://docs.docker.com/engine/install/ubuntu/). Add the
deployment user to the `docker` group only if accepting that the group grants root-equivalent host
access; otherwise run Docker commands with `sudo`. Docker-published ports can bypass UFW rules, so
the external [Hetzner Cloud Firewall](https://docs.hetzner.com/cloud/firewalls/overview/) is the
primary allowlist for this topology.

## 3. Point GoDaddy DNS at Hetzner

Create a [GoDaddy `A` record](https://www.godaddy.com/help/add-or-edit-an-a-record-42546) for the
chosen host pointing to the server's public IPv4 address. If the server has working public IPv6,
also create an `AAAA` record; otherwise remove stale `AAAA` records. For an apex domain, the
host/name is normally `@`; for `app.example.com`, it is `app`. Remove conflicting records for the
same hostname.

Wait until public resolvers return the new address:

```bash
dig +short A app.example.com
dig +short AAAA app.example.com
```

Ports 80 and 443 must reach this server before
[Caddy can issue the certificate](https://caddyserver.com/docs/quick-starts/https).

## 4. Put the deployment files on the server

Docker Hub contains the built API and web application images only. It does **not** contain the
Compose file, Caddy configuration, `.env.production`, backup script, update script, or systemd
units. Those files must exist on the Ubuntu server.

| Location                       | What it contains                                                    | How it changes                                                |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| GitHub                         | Source code and deployment files                                    | Updated by normal Git pushes                                  |
| Docker Hub                     | Built `api-*` and `web-*` images                                    | Updated by GitHub Actions                                     |
| `/opt/monthloom` on the server | Compose, Caddy, scripts, systemd source units and `.env.production` | Initially cloned; deployment-file changes are pulled manually |
| Docker volumes on the server   | PostgreSQL data, uploads and Caddy certificates                     | Changed by the running application                            |

The recommended approach is to keep a Git checkout at `/opt/monthloom`. Run the following commands
**on the Ubuntu server**, not on the development computer:

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /opt/monthloom
git clone --branch main --single-branch https://github.com/lsahatqija/monthloom.git /opt/monthloom
cd /opt/monthloom
cp infrastructure/production/env.example .env.production
chmod 600 .env.production
chmod +x infrastructure/production/*.sh
openssl rand -hex 32
```

If the repository is private, configure a read-only GitHub deploy key before cloning. An
alternative is to copy `compose.prod.yml`, `docs/deployment-hetzner.md`, and the complete
`infrastructure/production/` directory to `/opt/monthloom`, preserving that directory structure.
The Git checkout is preferable because future deployment-file changes can be installed with:

```bash
cd /opt/monthloom
git pull --ff-only
```

The server does not build or execute the checked-out application source. Docker Compose pulls and
runs the prebuilt images from Docker Hub. Likewise, the automatic image updater does not run
`git pull`: application image releases are automatic, while changes to Compose, Caddy, scripts, or
systemd units are deliberately applied manually.

Generate a session secret with the `openssl` command above, then edit `.env.production` and put its
output in `SESSION_SECRET`.

Edit `.env.production`, replacing every placeholder. `POSTGRES_PASSWORD` and the password inside
`DATABASE_URL` must represent the same value. URL-encode reserved characters in `DATABASE_URL`.
Never commit or copy this file into logs or tickets.

If Docker Hub images are private, run `sudo docker login` using a read-only access token because
the automatic update service runs as root. Confirm the selected images exist before proceeding.

## 5. First deployment

Run:

```bash
cd /opt/monthloom
chmod +x infrastructure/production/*.sh
./infrastructure/production/deploy.sh
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=100
```

The API applies database migrations before it starts accepting traffic. The deployment waits for
PostgreSQL, the API, Next.js, and Caddy health checks. On first start, Caddy obtains the TLS
certificate and stores it in the `caddy_data` volume. If a service does not become healthy,
`deploy.sh` prints the Compose status and the last 100 log lines for diagnosis.

Verify from another machine:

```bash
curl --fail --silent --show-error https://app.example.com/health/live
curl --fail --silent --show-error https://app.example.com/health/ready
curl --fail --silent --show-error --head https://app.example.com/
```

Then register, sign in, upload and download a small image, and confirm the browser receives a
`Secure`, `HttpOnly`, `SameSite=Lax` session cookie. Check that ports 3000, 4000, and 5432 are not
reachable externally.

If a container is unhealthy, inspect the health command and service logs rather than relying on
Compose's dependency summary:

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
docker inspect --format '{{json .State.Health}}' \
  "$(docker compose --env-file .env.production -f compose.prod.yml ps -q caddy)" | jq
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 caddy
```

Browser API traffic is same-origin in production. If the browser reports CORS, first inspect the
failed request URL in its Network panel. It must start with
`https://<DOMAIN>/api/`, never `http://localhost:4000`. Then verify the API's effective setting:

```bash
grep '^DOMAIN=' .env.production
docker compose --env-file .env.production -f compose.prod.yml exec api \
  sh -c 'printf "%s\n" "$CORS_ALLOWED_ORIGINS"'
```

Both values must correspond exactly to the browser origin, including `https` and excluding a
trailing slash.

## 6. Backups before launch

The included helper creates a compressed logical PostgreSQL dump, a compressed upload archive,
and checksums:

```bash
sudo BACKUP_DIR=/var/backups/monthloom ./infrastructure/production/backup.sh
```

Schedule it with a systemd timer or cron, then copy each completed directory to encrypted storage
outside this server. Restrict backup directory permissions. Define retention, alert on failures,
and perform a restore drill before considering backups operational. Back up `.env.production`
securely as a separate secret; do not place it in the data archive.

Example restore drill on an isolated host:

```bash
gunzip -c postgres.sql.gz | docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Uploads can be restored by extracting `uploads.tar.gz` into the `monthloom-prod_uploads_data`
volume while the API is stopped. Never test a restore over the live volumes.

## 7. Automatic releases and rollback

Set `IMAGE_TAG=latest` in `.env.production`. Once the first deployment is healthy, install the
systemd timer:

```bash
cd /opt/monthloom
sudo ./infrastructure/production/install-auto-update.sh
sudo systemctl start monthloom-update.service
systemctl status monthloom-update.service --no-pager
systemctl list-timers monthloom-update.timer --no-pager
```

The timer checks Docker Hub five minutes after boot and five minutes after each completed check.
It pulls only the API and web images, confirms both `latest` tags carry the same CI commit label,
and compares their image IDs with the running containers. If nothing changed, it exits without
restarting anything. For an update it:

1. Tags the running application images locally as `api-rollback` and `web-rollback`.
2. Creates a database and upload backup.
3. Recreates the changed services and waits for all health checks.
4. Attempts to restore the previous application images if the new stack is unhealthy.

After a failed release, the updater records its commit and will not repeatedly redeploy that same
revision. A later CI revision is tried normally. After diagnosing a transient failure, retry the
same revision by removing `/var/lib/monthloom-updater/failed-revision` and starting the service
manually.

Inspect automatic-update logs with:

```bash
journalctl -u monthloom-update.service --since today
```

Database migrations run when the new API starts. An application-image rollback cannot reverse a
database migration, so every production migration must remain backward-compatible. A destructive
migration requires a separately tested rollout and restore plan; do not let it ride the automatic
channel.

To stop automatic releases and pin a version:

```bash
sudo systemctl disable --now monthloom-update.timer
```

Then set `IMAGE_TAG` to the previous known-good commit SHA and run `deploy.sh`. The immutable SHA
tags remain available even though normal deployments follow `latest`.

The timer updates application images only. Pull repository changes manually before applying
updates to Compose, Caddy, deployment scripts, or systemd units, then rerun
`install-auto-update.sh` if a unit changed.

Useful operations:

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=200 api web caddy
docker compose --env-file .env.production -f compose.prod.yml pull
docker system df
```

Do not run `docker compose down -v`: `-v` deletes the named database, upload, and certificate
volumes. Do not prune volumes on the production host.

## 8. Production follow-ups

Before storing irreplaceable data, add external uptime checks for `/health/ready`, centralized log
shipping or at least disk/journal monitoring, disk-space alerts, and tested off-server backups.
For higher availability, move PostgreSQL and uploaded files to managed services/object storage;
the current local volumes tie recovery and uptime to this single CX23.
