# Administration analytics implementation plan

## Status and scope

- Status: in progress — Phase 0 complete
- Updated: 2026-11-09
- Goal: extend the administrator area with historical product usage, adoption, retention,
  reliability, performance, and security reporting.
- Constraint: analytics must not expose transaction descriptions, email addresses, IP addresses,
  user-agent strings, or other user-level personal data in dashboard responses.

This plan extends, but does not replace, the operational work in
`docs/admin-dashboard-implementation-plan.md`.

## Information architecture

Keep the existing administration shell and add one view per subject:

1. **Overview** — health, headline usage metrics, and links to exceptional states.
2. **Usage** — daily activity and transaction usage.
3. **Adoption** — registration and onboarding funnel.
4. **Retention** — new-user retention, cohorts, dormancy, and reactivation.
5. **Reliability** — traffic, errors, latency, dependencies, jobs, email, deploy, and backup state.
6. **Security** — authentication failures, rate limiting, and account state.
7. **Health** — retain the existing event ledger and health-policy view.

All analytics views share a date-range control in the URL:

- `range=current-month` is the default.
- Presets: current month, last 7 days, last 30 days, and last 90 days.
- Custom range: inclusive local calendar dates, capped at 366 days.
- The API converts the administrator's calendar range to an exclusive UTC end instant.
- Every response includes the resolved range, timezone, generation time, and the immediately
  preceding comparison range of equal duration.
- Charts use daily buckets up to 90 days and weekly buckets above 90 days.

The Overview remains intentionally compact. Detailed charts belong only in their subject view.

## Metric definitions

Definitions must be fixed before implementation so later queries and labels do not drift.

### Usage

- **Active user:** a non-admin user with at least one `user.active` event in a bucket.
- **Active household:** a household with at least one successful household-scoped product event.
- **New user:** a user whose `users.created_at` falls in the selected range.
- **Transaction created/updated/deleted:** successful operations, counted from product events by
  operation time, not the financial transaction's effective date.
- **Transactions per active household:** successful transaction creations divided by distinct
  active households; show `—` when the denominator is zero.
- **DAU/MAU stickiness:** daily active users divided by distinct users active in the trailing 30
  days ending on that day. The summary value is the mean daily ratio in the selected range.
- **Transactions per active user:** transaction creations divided by distinct active users.
- **Registered-user activity rate:** distinct active users divided by eligible registered users.
- **Active-household rate:** distinct active households divided by households existing by the end
  of the range.
- **Returning after 7/30 days:** registration cohorts with activity on the exact numbered day,
  using a one-day window and only mature cohorts in the denominator.

The daily chart supports DAU, transaction creations, updates, deletions, registrations, and active
households. Default enabled series are DAU and transaction creations; no more than three series
may be selected simultaneously.

The transaction-mix panel shows, for the selected period:

- income and expense creation count and percentage;
- current-record amount, average, and median by kind;
- recurring versus one-off count;
- expense-type breakdown; and
- comparison with the preceding period.

Amounts must never be summed across currencies. Return one breakdown per household currency and
provide a currency selector when more than one currency is present. Deleted transaction amounts
are excluded from amount statistics and the UI labels this limitation. Counts of deletes remain
accurate from events.

### Adoption

- **Registration trend:** users grouped by registration day/week.
- **No household:** registered users with no `household_members` row at the end of the range.
- **Time to first household:** duration from registration to earliest membership `joined_at`, with
  median and p75; exclude users who have not joined and show their count separately.
- **Time to first transaction:** duration from registration to the user's first successful
  transaction creation, with median and p75; exclude users with no transaction and show their
  count separately.
- **Invitation conversion:** accepted invitations divided by invitations created in the selected
  range. Show sent, accepted, expired/unaccepted, and still-open counts. Acceptance is attributed
  to the invitation's creation cohort.

### Retention

- **D1/D7/D30 retention:** percentage of new non-admin users with a `user.active` event on the
  exact numbered day after registration. Exclude cohorts too recent to have reached that day.
- **Weekly returning-user cohort:** registration week by activity week matrix. A user is retained
  in a week when they have at least one activity event in that week.
- **Dormant user:** previously active user with no activity in the last 30 complete days.
- **Dormant household:** household that previously had a successful household-scoped event and has
  had none in the last 30 complete days.
- **Reactivated user:** user active in the selected range after at least 30 complete days without
  activity. Count once per selected period and show a daily trend.

Use 30 days as a named server-side constant shared by queries and UI copy, not a configurable
dashboard option in the first version.

### Reliability and performance

- Requests per day and per route template.
- 4xx and 5xx rate, grouped by route template and error code.
- Request-duration p50 and p95, plus slowest route templates by p95 with a minimum sample count.
- Database health and query-duration p50/p95.
- Readiness, dependency, and background-job status and last successful run.
- Email delivery attempts and failures by template.
- Current application version, deployment timestamp, and version breakdown reported by clients.
- Last successful backup and the age of that backup.

Never use raw URLs as dimensions because IDs create unbounded cardinality. Record normalized route
templates. Do not promise p99 until traffic volume justifies it.

### Security and account state

- **Failed login rate:** denied or failed login attempts divided by all login attempts, with counts
  and a daily trend.
- **Suspicious rate-limit activity:** total rate-limit events, affected pseudonymous clients, route
  group, and repeated-client count. A repeated client has at least three rate-limit events inside
  one limiter window.
- **Unverified accounts:** users with `email_verified = false`.
- **Locked accounts:** users whose `locked_until` is in the future.
- **Suspended accounts:** users with a non-null `suspended_at`.

The dashboard returns only aggregate security data. It must not return raw IP addresses, email
addresses, credential input, or user-agent strings.

## Data model

### Append-only product events

Add a `product_events` table:

| Column                          | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `id` UUID                       | Primary key                                          |
| `event_name` varchar/enum       | Stable event taxonomy                                |
| `occurred_at` timestamptz       | Successful operation time                            |
| `actor_user_id` UUID nullable   | Pseudonymous actor identifier                        |
| `household_id` UUID nullable    | Pseudonymous household identifier                    |
| `subject_id` UUID nullable      | Transaction, invitation, or other subject identifier |
| `subject_kind` varchar nullable | Income, expense, invitation, etc.                    |
| `metadata` jsonb                | Small allow-listed, non-sensitive dimensions         |

Do not add foreign keys from events to mutable product rows: deleting an account, household, or
transaction must not cascade-delete history. Index `(event_name, occurred_at)`,
`(actor_user_id, occurred_at)`, and `(household_id, occurred_at)`. Add a database trigger that
rejects updates and deletes by the application role. Administrative retention cleanup, if later
required, must use a separate privileged role and explicit procedure.

Initial event taxonomy:

- `user.registered`, `user.active`, `user.reactivated`
- `household.created`, `household.joined`
- `invitation.created`, `invitation.accepted`
- `transaction.created`, `transaction.updated`, `transaction.deleted`
- `auth.login.succeeded`, `auth.login.failed`
- `security.rate_limited`
- `email.delivery.succeeded`, `email.delivery.failed`
- `job.succeeded`, `job.failed`
- `readiness.checked`
- `deployment.started`
- `backup.succeeded`, `backup.failed`

Use one `user.active` event per user per UTC day, enforced with a partial/event-specific unique
index or an `activity_date` column plus a unique constraint. Authenticated request handling inserts
with `ON CONFLICT DO NOTHING`; it must not write on every request. This daily event is sufficient
for DAU and retention without retaining page-level browsing history.

Event recording is best-effort only for low-value activity events, but transactional events such as
registration, invitations, and transaction mutations are written in the same database transaction
as the product change. Event metadata uses per-event Zod schemas and an allow-list; arbitrary
request bodies are never stored.

### Account state prerequisite

The current user model has no locked or suspended state. Add:

- `failed_login_attempts integer not null default 0`
- `locked_until timestamptz nullable`
- `suspended_at timestamptz nullable`

Enforce these states in login and session validation, reset failed attempts after successful login,
and revoke sessions when an account is suspended. Suspension needs a minimal audited administrator
action before the suspended count is meaningful; detailed user-management tooling remains outside
this analytics plan.

### Reliability rollups

Do not store every request in `product_events`. Add bounded rollups:

- `request_metrics_hourly`: hour, route template, method, status class/error code, count, and a
  mergeable duration histogram.
- `database_metrics_hourly`: hour, operation/query label, count, failures, and duration histogram.
- `client_version_daily`: date, version, and distinct pseudonymous installation count.
- `operational_status`: one row per dependency/job containing current state, last attempt, last
  success, duration, and sanitized error code.

Flush in-memory request/database accumulators periodically and during graceful shutdown. If exact
histogram merging is too large for the first implementation, store fixed latency buckets and derive
approximate p50/p95 in SQL. Do not add a metrics dependency solely for this dashboard.

Backup scripts must report success/failure, completion time, and artifact timestamp through a small
authenticated internal endpoint or a database command using a dedicated credential. A missing
report is displayed as “unknown”, never as successful.

### Backfill and accuracy

Backfill events that can be derived reliably:

- users → `user.registered`
- households and memberships → `household.created` / `household.joined`
- invitations → `invitation.created` / `invitation.accepted`
- existing incomes and expenses → `transaction.created`

Do not synthesize historical activity, updates, deletes, failed logins, rate limits, reactivations,
email outcomes, request latency, or job results. Mark affected charts with “Data collected since
<deployment date>” until their selected range is fully covered.

## API and service design

Split the current all-in-one response into focused endpoints so expensive cohort and reliability
queries are not run on every admin page:

- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/usage?from=&to=&timezone=&bucket=`
- `GET /api/v1/admin/adoption?from=&to=&timezone=&bucket=`
- `GET /api/v1/admin/retention?from=&to=&timezone=`
- `GET /api/v1/admin/reliability?from=&to=&timezone=&bucket=`
- `GET /api/v1/admin/security?from=&to=&timezone=&bucket=`
- retain `GET /api/v1/admin/health`

Keep the existing `AdminService`/`AdminRepository` layering, but use one repository method per view
and small query-result types. Validate ranges in shared contracts. Reject invalid, reversed, or
over-366-day ranges. All endpoints remain admin-only and return aggregates, not event rows.

Each metric returns `current`, `previous`, and a nullable percentage change. For time series, fill
missing buckets with zero in the service so chart components receive a continuous sequence.

## Frontend plan

- Replace the three hard-coded tab values with the seven views above, preserving URL-deep links.
- Add a server-rendered shared date-range form that writes URL search parameters. Changing views
  preserves the selected range.
- Use metric cards only for the four to six figures needed to scan each view.
- Use accessible SVG charts built on the project's existing chart approach; do not add a second
  chart library. Every chart includes a visible legend, tooltip, tabular-number formatting, and a
  screen-reader-accessible data table or summary.
- Use line charts for rates and activity, stacked bars for transaction operations, horizontal bars
  for type mix, and a table/heatmap with numeric labels for weekly cohorts. Never encode meaning by
  color alone.
- Add loading, empty, unavailable, partial-coverage, and zero-denominator states.
- On narrow screens, stack metric cards and charts; tables may use a labelled card layout rather
  than forcing page-level horizontal scrolling.
- Add all labels and explanations to every supported locale and extend translation tests.

## Delivery phases

### Phase 0 — definitions and contract fixtures

1. Confirm the definitions above and add representative response fixtures.
2. Add range parsing/bucketing utilities with timezone and DST boundary tests.
3. Split the existing admin contract into overview and health without changing visible behavior.

Acceptance: existing admin behavior is unchanged and range utilities pass DST, leap-day, and
comparison-period tests.

### Phase 1 — event foundation

1. Add the event table, indexes, append-only protection, repository, and typed metadata validators.
2. Record daily activity and successful registration, household, invitation, and transaction events.
3. Record authentication failure/success and rate-limit events with hashed rotating client keys,
   never raw IPs.
4. Run the safe historical backfill and store the collection-start timestamp.

Acceptance: product mutations and their durable events commit atomically; event rows cannot be
updated/deleted by the app role; sensitive fields are rejected by tests.

### Phase 2 — Usage view

1. Add headline metrics and previous-period comparisons.
2. Add the selectable daily operations/activity chart.
3. Make transaction mix range-aware and add count, currency-scoped amount, average, median,
   recurring, and expense-type breakdowns.
4. Add engagement ratios and returning-after-7/30-day metrics.

Acceptance: every requested Usage metric respects the same selected range and comparison period,
and currency values are never combined incorrectly.

### Phase 3 — Adoption view

1. Add registration trend and no-household count.
2. Add time-to-first-household and time-to-first-transaction distributions.
3. Add invitation cohort conversion and state breakdown.

Acceptance: invitation conversion uses sent cohorts rather than mixing unrelated accepted dates;
percentile and censored-user behavior is covered by tests.

### Phase 4 — Retention view

1. Add mature-cohort D1/D7/D30 retention.
2. Add the weekly cohort matrix.
3. Add dormant user/household snapshots and daily reactivation trend.

Acceptance: recent cohorts are excluded from unavailable retention denominators and reactivation
requires a real prior active period followed by the full inactivity threshold.

### Phase 5 — Reliability view

1. Add normalized-route request instrumentation and hourly rollups.
2. Add error-rate, latency, slow-route, and database metrics.
3. Add email, readiness/dependency, and background-job reporting.
4. Add application/deployment and client-version reporting.
5. Connect backup reporting and surface stale/unknown state.

Acceptance: instrumentation does not store raw URLs or request data, dashboard queries stay bounded,
and losing telemetry never fails a product request.

### Phase 6 — Security and account state

1. Add locked/suspended account fields and enforce them throughout authentication/session handling.
2. Add the minimal audited suspension action and session revocation.
3. Add failed-login, rate-limit, and account-state aggregates.

Acceptance: login enumeration remains impossible, raw client identifiers never reach the response,
and suspended or currently locked accounts cannot create or continue sessions.

### Phase 7 — hardening and rollout

1. Add repository integration tests with boundary-heavy fixtures and query-plan checks.
2. Add API authorization, range-validation, empty-state, and partial-coverage tests.
3. Add frontend rendering, interaction, accessibility, responsive, and translation tests.
4. Verify production migrations, backfill runtime, rollup cleanup, and graceful-shutdown flushing.
5. Document event retention, metric definitions, backup reporting, and administrator privacy rules.

Acceptance: all workspace checks pass, non-admin access is denied, dashboard queries meet an agreed
latency budget on production-like data, and deployment can be rolled back without losing product
data.

## Files and layers expected to change

- Database schema, relations, migrations, and seed fixtures under
  `apps/api/src/infrastructure/database/`.
- New analytics event/telemetry infrastructure and composition wiring.
- Auth, activity, household/invitation, transaction, email, job, readiness, and rate-limit call
  sites.
- Admin repository, service, controller, routes, and OpenAPI registration.
- Shared admin contracts and contract tests.
- Admin page/view components, styles, locale files, and frontend tests.
- Production deploy/backup scripts and environment documentation.

## Explicitly deferred

- Individual-user analytics drill-down or export.
- Raw event browsing in the administrator UI.
- Currency conversion or a global cross-currency monetary total.
- Arbitrary event metadata and a generic analytics query builder.
- External observability vendors, OpenTelemetry, alerts, and p99 latency.
- Configurable dormancy thresholds and custom cohort definitions.
