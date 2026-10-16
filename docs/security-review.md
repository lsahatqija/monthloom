# Security review and remediation plan

**Review date:** 2026-10-16  
**Scope:** application source, database schema and migrations, web/API configuration, Docker and Caddy deployment, CI workflows, backup/update scripts, and the committed dependency lockfile.  
**Method:** manual static review and trust-boundary tracing. No production system, running deployment, cloud host, DNS, email account, Docker registry, or real user data was accessed. This is not a penetration test.

## Executive summary

Monthloom has a sound security baseline. Passwords use Argon2id; session, reset, verification, and invitation tokens are generated with a CSPRNG and stored as SHA-256 hashes; SQL is constructed with Drizzle rather than string concatenation; file reads are owner-scoped; uploads are size-limited and content-sniffed; API errors do not expose stack traces; containers run as non-root users; and production puts PostgreSQL on an internal network behind Caddy TLS.

No confirmed critical vulnerability or direct unauthenticated route to financial records was found in this review. The most important remaining risks are operational: sensitive backups are created unencrypted, security-relevant activity is not auditable, and CI/release automation lacks automated security gates and immutable dependency references. Application-level weaknesses include incomplete CSRF defense, sessions surviving an in-session password change, invitations not being bound to their email recipient, and insufficient production validation of security-sensitive configuration.

The recommended release posture is to resolve SEC-01 through SEC-05 before treating the service as production-ready for sensitive financial data, then complete the medium-priority hardening work in the next release cycle.

## Threat model

Protected assets include credentials and session tokens; household membership; transaction amounts, dates, categories, and income/expense sources; uploaded images and metadata; email/reset/invitation tokens; database and upload backups; and deployment credentials.

Primary threats are credential stuffing, session theft, CSRF and XSS, broken object-level authorization between households, malicious uploads, token leakage through email/browser history/logs, dependency or image compromise, theft of the host or backup media, and privileged or compromised-operator access. The API, browser, email provider, Docker registry, reverse proxy, PostgreSQL, upload volume, backup destination, and CI runner are distinct trust boundaries.

## Findings

Severity reflects likely impact and exploitability for an internet-facing service storing personal financial information. “Open” means remediation is not present in the reviewed revision.

### SEC-01 — High — Backups contain plaintext sensitive data

**Status:** Remediation implemented in the repository; production provisioning, off-site storage,
and a successful restore drill are still required before closure.

**Original evidence:** before remediation, `infrastructure/production/backup.sh` wrote a
gzip-compressed PostgreSQL dump and uploads archive directly to `$BACKUP_DIR`. It created
restrictive local directory permissions and a checksum, but provided no encryption or protected
off-site transfer.

**Impact:** compromise of the host, backup volume, snapshot, or copied archive exposes all financial and identity data. A checksum detects accidental corruption but provides neither confidentiality nor authenticity against an attacker who can replace both archive and checksum.

**Implemented:** production PostgreSQL now binds only to a dm-crypt/LUKS-backed path that is checked
before deploy/update/backup/restore. Backups stream PostgreSQL and upload data directly through
authenticated `age` encryption without a plaintext archive, can be copied to an rclone remote,
and have atomic completion markers and checksums. A daily systemd timer and database restore tool
are included. Restore authenticates and decompresses the complete archive, imports into a temporary
database, swaps it into service, health-checks the application, and rolls back on failure.

**Remaining operational work:** provision and unlock the encrypted filesystem, generate and
escrow the age identity away from the application host, configure a private versioned/immutable
off-site remote with narrowly scoped credentials, set and enforce retention, install the timer,
monitor failures/capacity, and pass a documented restore drill. Neither LUKS nor backup encryption
protects an unlocked compromised host.

### SEC-02 — High — Security and financial actions lack an audit trail

**Evidence:** `apps/api/src/infrastructure/logging/http-logger.ts` records request method, URL, status, and duration. Auth, household, invitation, transaction, source, password, and file services do not emit a durable, append-only audit event for successful or rejected sensitive actions.

**Impact:** account takeover, insider misuse, household membership changes, or tampering with financial records may be impossible to reconstruct or alert on. Request logs alone do not capture actor, target, action, or outcome reliably and may be rotated with container logs.

**Remediation:** add a structured audit-event abstraction and durable sink. Record actor ID, action, target type/ID, household ID where relevant, result, timestamp, request ID, and coarse network/client context. Never record credentials, raw cookies, reset/invitation tokens, full request bodies, or unnecessary financial values. Protect audit records from application-level modification, set retention, and alert on password resets, repeated login failures, membership/ownership changes, bulk access, and administrative actions.

### SEC-03 — High — CI and release pipelines have no security gates

**Evidence:** `.github/workflows/tests.yml` runs install, lint, type checking, tests, and coverage only. `.github/workflows/publish.yml` builds and pushes images without dependency auditing, static analysis, secret scanning, container scanning, SBOM/provenance generation, or signature verification. GitHub Actions are pinned to mutable major-version tags rather than full commit SHAs.

**Impact:** a vulnerable dependency, leaked secret, compromised action release, or vulnerable container can reach production despite the functional test suite passing.

**Remediation:** add lockfile-aware dependency review on pull requests, secret scanning, CodeQL or an equivalent TypeScript SAST tool, container/filesystem scanning, and license policy checks. Generate an SBOM and build provenance, sign published images, and verify signatures before deployment. Pin every third-party action to a reviewed commit SHA and use Dependabot/Renovate to keep those pins current. Fail releases on exploitable high/critical findings, with a documented time-limited exception process.

**Verification note:** `pnpm audit` was attempted during this review but could not complete in the restricted/offline environment. Dependency vulnerability status is therefore unknown, not clean.

### SEC-04 — High — Deployments trust mutable, unverified container images

**Evidence:** `compose.prod.yml` selects images by `${IMAGE_TAG}`; `infrastructure/production/update.sh` explicitly pulls `api-latest` and `web-latest`, then deploys based on local image IDs and an informational revision label. Images and base images (`node:22-alpine`, `caddy:2-alpine`, `postgres:16-alpine`, `alpine:3.22`) are not pinned by digest, and no signature or attestation is checked.

**Impact:** registry compromise, tag replacement, or upstream tag drift can introduce code that did not pass this repository’s tests. Matching self-declared revision labels do not establish authenticity.

**Remediation:** publish immutable digest-addressed images, sign them in CI using keyless OIDC or an offline-controlled key, verify signature and provenance in the updater, and deploy the verified digest. Pin build/runtime base images by digest and automate reviewed refreshes. Keep rollback artifacts digest-addressed as well.

### SEC-05 — High — Production security configuration is weakly validated

**Evidence:** `apps/api/src/config/env.schema.ts` accepts any `SESSION_SECRET` of 16 characters, permits `SESSION_COOKIE_SECURE=false` and arbitrary HTTP `WEB_PUBLIC_URL`/CORS origins even in production, accepts unrestricted `DATABASE_URL` strings, and does not reject development defaults in production. `compose.yml` contains predictable development credentials and exposes PostgreSQL on all host interfaces by default.

The configured `SESSION_SECRET` is not used by the opaque server-side session implementation; its presence can give operators a false sense that it protects sessions.

**Impact:** a production deployment assembled from the wrong Compose file or weak environment can silently run with insecure cookies, plaintext origins, predictable credentials, or an externally reachable database. Configuration mistakes are a common route to compromise.

**Remediation:** add production-only schema refinements: require HTTPS public/CORS URLs, `SESSION_COOKIE_SECURE=true`, an explicit non-placeholder database credential, an allowlisted cookie name, and a validated proxy setting. Either remove and document the unused session secret or use it for a clearly defined cryptographic purpose. Bind development PostgreSQL to `127.0.0.1:5432` and prominently mark `compose.yml` as development-only. Add automated negative tests for every rejected production configuration.

### SEC-06 — Medium — CSRF validation permits missing Origin headers

**Evidence:** `apps/api/src/middleware/verify-origin.middleware.ts` accepts every unsafe request when `Origin` is absent. The comment relies on `SameSite=Lax` and CORS. The session cookie in `apps/api/src/modules/auth/auth.cookies.ts` does use `SameSite=Lax`, which materially reduces exploitability, but it is not a complete CSRF protocol and can be undermined by same-site subdomain compromise or unusual clients/proxies.

**Impact:** a request that carries a victim’s cookie but has no Origin bypasses the only explicit origin check. This affects password, household, transaction, invitation, and file mutations.

**Remediation:** for every cookie-authenticated unsafe method, require a valid Origin (with a carefully justified legacy Referer fallback) and add a synchronizer or signed double-submit CSRF token. Reject `Sec-Fetch-Site: cross-site` as defense in depth. Exempt only endpoints that truly do not use cookie authentication and test missing, opaque/null, sibling-subdomain, and hostile origins.

### SEC-07 — Medium — Password change does not revoke other sessions

**Evidence:** password-reset handling atomically revokes all sessions in `apps/api/src/modules/auth/adapters/postgres-session.repository.ts`, but `apps/api/src/modules/users/user.service.ts` changes the password through `userRepository.update` only.

**Impact:** if a user changes their password because another device/session is compromised, the attacker remains authenticated for up to the configured session lifetime (seven days by default).

**Remediation:** change passwords in a database transaction that updates the hash and revokes every session for the user. Optionally issue one fresh session to the initiating client after successful reauthentication. Add integration tests proving all previous cookies fail immediately.

### SEC-08 — Medium — Email invitations are bearer links, not recipient-bound

**Evidence:** `apps/api/src/modules/finance/invitation.service.ts` lowercases an email only for delivery. The stored invitation contains no recipient identity, and `acceptInvitation` accepts any authenticated user who possesses the token.

**Impact:** a forwarded, misdelivered, or mailbox-compromised invitation can enroll an unintended account into a household and expose financial data. Users may reasonably assume an invitation sent to a specific email is restricted to that address.

**Remediation:** store a normalized recipient email hash or recipient user ID for email-mode invitations and require the authenticated, verified account to match it. Keep explicitly labeled shareable-link invitations as bearer tokens if desired. Notify the owner and recipient after acceptance, allow revocation, and rate-limit acceptance attempts.

### SEC-09 — Medium — Brute-force controls are single-process and IP-only

**Evidence:** `apps/api/src/middleware/rate-limit.middleware.ts` uses the default in-memory store and default IP keying. Login is limited to ten requests per fifteen minutes per apparent client IP; there is no per-account throttling, breached-password check, progressive delay, or MFA.

**Impact:** limits reset on restart, do not coordinate across replicas, and are bypassable with distributed source IPs. Credential stuffing against financial accounts remains practical. A proxy-hop misconfiguration can either collapse all users into one bucket or expose spoofable client IPs.

**Remediation:** use a shared Redis/PostgreSQL-backed limiter; combine privacy-preserving account and trusted-client keys; add exponential backoff and monitoring; validate proxy behavior in deployment tests; check new passwords against a compromised-password corpus using a privacy-preserving method; and offer WebAuthn/passkeys or TOTP MFA, prioritizing owners/admins.

### SEC-10 — Medium — Browser security policy is incomplete

**Evidence:** Helmet protects API responses in `apps/api/src/app.ts`, and Caddy adds HSTS, but `apps/web/next.config.mjs` and `infrastructure/production/Caddyfile` define no application Content Security Policy, Permissions Policy, or explicit framing policy for web pages.

**Impact:** React’s output encoding reduces XSS risk, but any future injection or compromised third-party script would have few browser-enforced limits and could make authenticated API calls or read rendered financial data.

**Remediation:** deploy a nonce- or hash-based CSP after a report-only tuning period; at minimum restrict `default-src`, `script-src`, `connect-src`, `img-src`, `style-src`, `object-src`, `base-uri`, `form-action`, and `frame-ancestors`. Add `Permissions-Policy` and an explicit `Referrer-Policy`; avoid third-party scripts on authenticated pages; add CSP regression tests.

### SEC-11 — Medium — Data at rest relies entirely on host controls

**Evidence:** transactions and identity fields are ordinary PostgreSQL columns in `apps/api/src/infrastructure/database/schema/identity.ts` and `transactions.ts`; uploads are plain files in a Docker volume. Production documentation/configuration does not enforce encrypted disks, encrypted snapshots, managed key rotation, or selective application-layer encryption.

**Impact:** theft or compromise of disk, VM snapshots, volume exports, or privileged host access exposes the full dataset. This is distinct from SEC-01’s portable backup risk.

**Remediation:** require encrypted host volumes and snapshots, document provider/key settings, restrict operator access, and consider envelope encryption for the most sensitive fields where search/reporting requirements permit. Keep keys separate from ciphertext, define rotation, and test recovery. Database encryption does not replace access control or encrypted backups.

### SEC-12 — Low — Registration reveals whether an email is registered

**Evidence:** `apps/api/src/modules/auth/auth.service.ts` returns a specific conflict for an existing registration email, while login and password reset intentionally use non-enumerating responses.

**Impact:** an attacker can enumerate users and use the result for phishing or credential stuffing. This is privacy-sensitive even if it does not grant account access.

**Remediation:** return a uniform registration response and send an account-exists notice to the address, or explicitly accept this usability tradeoff and monitor/rate-limit it. Preserve identical status, body shape, and similar timing where feasible.

### SEC-13 — Low — Sensitive token URLs need an explicit leakage policy

**Evidence:** password reset, verification, and invitation secrets are embedded in frontend URL paths. Raw tokens are correctly hashed in the database and API request logging redacts token fields, but browsers, screenshots, analytics added later, reverse-proxy logs, and outbound referrers can still expose URL tokens.

**Impact:** a leaked unused token can reset an account, verify an address, or join a household before expiry.

**Remediation:** ensure token pages contain no third-party resources, set `Referrer-Policy: no-referrer`, immediately exchange the path token for a short-lived HttpOnly transaction cookie or move it into the URL fragment before network navigation, retain single-use/short expirations, and redact these paths in every proxy/analytics/error-reporting layer. Caddy access logs should be reviewed because they may record the full path.

### SEC-14 — Low — Security lifecycle and privacy controls are undocumented

**Evidence:** no repository policy defines vulnerability reporting, supported versions, patch SLAs, access review, incident response, data retention/deletion, session review, disaster-recovery objectives, or periodic restore/security testing.

**Impact:** technical controls degrade without ownership and response procedures; user data may be retained longer than intended; incidents take longer to contain.

**Remediation:** add `SECURITY.md`, an incident-response runbook, data classification/retention schedule, least-privilege access review, RPO/RTO and restore drill, key/credential rotation procedure, and a recurring threat-model review. Add user-facing account/data export and deletion flows as required by the applicable privacy regime.

## Positive controls confirmed

- Authentication cookies are `HttpOnly`, `SameSite=Lax`, path-scoped to `/`, and Secure in the production Compose configuration.
- Session/reset/verification/invitation tokens have 256 bits of randomness and only hashes are persisted.
- Password reset is single-use, expires, updates the password and revokes existing sessions atomically.
- Login and forgot-password responses resist email enumeration; error responses omit internals.
- Household transaction/source/month operations consistently check membership, and nested object queries include the household ID.
- File metadata/content/deletion checks ownership and uses the same not-found response for missing and unauthorized records.
- Uploads are memory/size limited, extension filtered, content-sniffed, renamed with server-generated identifiers, and served through an authenticated endpoint.
- Storage paths are resolved beneath a fixed root with traversal protection.
- PostgreSQL is not published in production and lives on an internal Docker network.
- Production uses TLS/HSTS, containers use non-root users, Docker logs rotate, and local `.env` is ignored and was not read during this review.

These controls should receive regression tests and must not be weakened while addressing the findings.

## Remediation roadmap

### Phase 0 — Before accepting sensitive production data (0–2 weeks)

1. Encrypt backups end-to-end, configure protected off-site storage and retention, and complete a restore drill (SEC-01).
2. Add durable audit events for authentication, membership/ownership, transaction/source, file, and administrative actions (SEC-02).
3. Add dependency, secret, SAST and image scans; pin Actions; generate SBOM/provenance; block unsafe releases (SEC-03).
4. Sign images and deploy only verified digests; pin base images (SEC-04).
5. Enforce fail-closed production configuration and bind the development database to loopback (SEC-05).

**Exit criteria:** an operator cannot start production with insecure cookie/origin/default credentials; every deployed image maps cryptographically to a reviewed commit and SBOM; backup theft does not disclose data; a restore is demonstrated; high-risk actions can be reconstructed without logging secrets.

### Phase 1 — Account and request hardening (2–4 weeks)

1. Implement CSRF tokens plus fail-closed Origin/Fetch-Metadata checks (SEC-06).
2. Revoke sessions on password changes and expose a “log out all devices” control (SEC-07).
3. Bind email invitations to verified recipients and add invitation revocation/notification (SEC-08).
4. Move rate limiting to a shared store, add account-aware throttling and alerts, and plan passkey/MFA support (SEC-09).
5. Deploy CSP in report-only mode, resolve violations, then enforce it with the remaining browser headers (SEC-10).

**Exit criteria:** automated tests cover hostile/missing origins, stolen old sessions, cross-account invitation acceptance, distributed/restarted limiter behavior, and CSP on authenticated pages.

### Phase 2 — Data protection and operational maturity (1–2 months)

1. Enforce encrypted volumes/snapshots and evaluate field-level encryption (SEC-11).
2. Decide and document the registration-enumeration tradeoff (SEC-12).
3. Harden token pages and redact sensitive URLs across proxy and observability systems (SEC-13).
4. Publish security, incident, retention/deletion, access-review, and recovery policies (SEC-14).
5. Commission an independent authenticated penetration test covering two ordinary accounts in different households, an owner/member pair, upload parser abuse, CSRF/XSS, session lifecycle, invitation theft, concurrency/race conditions, and deployment configuration.

**Exit criteria:** data-retention and deletion behavior is testable; keys and privileged access have owners and rotation schedules; token URLs do not reach logs/referrers; penetration-test high/critical findings are closed and retested.

## Verification checklist for each security change

- Add a regression test that fails before the fix and passes after it.
- Test both authorization dimensions: actor identity and household/resource ownership.
- Exercise concurrent/replayed requests for tokens, invitations, ownership transfer, and recurring transaction mutations.
- Confirm logs, traces, errors, analytics, and audit records contain no secrets or unnecessary financial values.
- Run lint, type checks, unit/integration tests, dependency/SAST/secret scans, image scan, and production configuration validation.
- Review schema migrations for safe rollback, least privilege, indexes, constraints, and unintended data copies.
- Update threat model, runbooks, and user-facing behavior; have a second reviewer approve authentication, authorization, cryptography, and deployment changes.

## Residual risk and review limitations

This was a source review, not proof of absence of vulnerabilities. Runtime-only issues such as proxy header behavior, TLS configuration, host firewalling, Docker daemon exposure, filesystem permissions, cloud snapshots, SMTP/domain protections, DNS, monitoring access, production secrets, and actual response headers require deployment testing. Dependency advisories could not be fetched in the restricted review environment. No fuzzing, dynamic scanning, race testing, browser CSP validation, restore exercise, or adversarial multi-account penetration testing was performed.

Re-run this review after Phases 0 and 1, after material authentication/authorization changes, and at least annually.
