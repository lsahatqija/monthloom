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
- The immutable Git commit SHA to deploy. CI publishes `api-<sha>` and `web-<sha>` images after
  tests pass on `main`; do not deploy `latest` if you want deterministic rollback.
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

## 4. Install the release files

Use `/opt/monthloom` as the application directory. Either clone the private repository with a
read-only deploy key or copy just these release files to the server:

- `compose.prod.yml`
- `infrastructure/production/Caddyfile`
- `infrastructure/production/deploy.sh`
- `infrastructure/production/backup.sh`
- `infrastructure/production/env.example`

On the server:

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /opt/monthloom
cd /opt/monthloom
cp infrastructure/production/env.example .env.production
chmod 600 .env.production
openssl rand -hex 32
```

Edit `.env.production`, replacing every placeholder. `POSTGRES_PASSWORD` and the password inside
`DATABASE_URL` must represent the same value. URL-encode reserved characters in `DATABASE_URL`.
Never commit or copy this file into logs or tickets.

If Docker Hub images are private, run `docker login` using a read-only access token. Confirm the
selected SHA images exist before proceeding.

## 5. First deployment

Run:

```bash
cd /opt/monthloom
chmod +x infrastructure/production/deploy.sh infrastructure/production/backup.sh
./infrastructure/production/deploy.sh
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=100
```

The API applies database migrations before it starts accepting traffic. The deployment waits for
PostgreSQL, the API, Next.js, and Caddy health checks. On first start, Caddy obtains the TLS
certificate and stores it in the `caddy_data` volume.

Verify from another machine:

```bash
curl --fail --silent --show-error https://app.example.com/health/live
curl --fail --silent --show-error https://app.example.com/health/ready
curl --fail --silent --show-error --head https://app.example.com/
```

Then register, sign in, upload and download a small image, and confirm the browser receives a
`Secure`, `HttpOnly`, `SameSite=Lax` session cookie. Check that ports 3000, 4000, and 5432 are not
reachable externally.

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

## 7. Routine releases and rollback

After CI publishes a tested commit, change only `IMAGE_TAG` in `.env.production`, create a backup,
and run `deploy.sh`. Review readiness and application logs after each release.

To roll back application code, set `IMAGE_TAG` to the previous known-good SHA and rerun the deploy
script. Database migrations currently run automatically and may not be reversible, so review every
migration for backward compatibility before deployment. A destructive migration requires a
tested database restore or an explicit down-migration plan.

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
