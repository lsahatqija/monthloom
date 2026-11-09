# Administration dashboard implementation plan

## Status

- Phase: functional MVP complete; production-readiness work remains
- Updated: 2026-11-09
- Scope: administration metrics, application health, administrator provisioning, and future operational capabilities

## Decisions

### User activity metrics

- A user is active when they use the authenticated application in any form within a rolling period. This includes logging in, viewing data, and creating, editing, or deleting records.
- DAU, WAU, and MAU represent distinct users active within the last 1, 7, and 30 days respectively.
- `currentlyLoggedInUsers` is a separate metric representing distinct users with a valid, unrevoked, unexpired session.
- The dashboard must not use valid sessions as a substitute for activity.
- Record a user's latest authenticated activity centrally so feature controllers do not each need custom tracking. Login must also count as activity.
- Avoid writing on every request; update a user's latest activity at a bounded interval while preserving the accuracy needed for rolling 1/7/30-day counts.

### Application health policy

Approved policy:

- any fatal event in the last 24 hours is `critical`;
- any error in the last 24 hours is `degraded`;
- expected 401, 403, 409, and 429 client/security warnings remain visible but do not independently degrade health; and
- five or more other warnings within a rolling 24-hour window degrade health.

## Remaining implementation

### Correct health aggregation

- Calculate seven-day and 24-hour severity totals from every matching event before limiting displayed entries.
- Limit or paginate only the event list.
- Return the actual configured log window instead of a separate hard-coded value.
- Continue when an individual dated log file is unreadable where possible, while reporting partial availability.
- Add regression coverage for more than 100 events and partial file-read failures.

Completion condition: severity totals remain accurate regardless of the event display limit.

### Implement distinct activity and session metrics

- Add persisted latest-activity data for users, with a migration and appropriate index.
- Update activity for successful login and authenticated application use.
- Add repository queries for DAU, WAU, MAU, and currently logged-in users.
- Replace the ambiguous `activeUsers` contract field with explicit activity and session metrics.
- Update the Overview and Usage views, translations, and explanatory labels.
- Cover cutoff boundaries, revoked and expired sessions, and distinct-user counting.

Completion condition: the dashboard separately reports DAU, WAU, MAU, and currently logged-in users using the agreed definitions.

### Apply the agreed health policy

- Classify expected client/security warnings separately from actionable application warnings.
- Apply the five-warning threshold and approved health-state rules.
- Keep all warning events available for investigation even when they do not change headline health.
- Cover warning-only, error, fatal, threshold, and unavailable-log scenarios.

Completion condition: normal authentication failures and access denials cannot create a permanently degraded application state.

### Establish administrator provisioning

- Keep local development seeding safe and repeatable.
- Handle an existing seed email explicitly instead of silently leaving a regular user unchanged.
- Provide a deliberate production bootstrap procedure, preferably a one-time CLI command using deployment secrets.
- Never ship fixed production credentials or allow the development seed to run in production.
- Document credential rotation and recovery for the first administrator.

Completion condition: a first administrator can be created safely in each environment, and rerunning development setup has deterministic results.

### Final acceptance

- Run contracts and application builds, typechecks, lint, unit tests, integration tests, and translation tests.
- Verify the production Next.js artifact in Linux or CI.
- Reinspect the dashboard at desktop, tablet, and mobile widths with long messages and large metric values.
- Confirm that non-admin users cannot discover the navigation entry or access the page or API.

Completion condition: all automated checks and production-environment verification pass.

## Later feature roadmap

### Operational investigation

- Date-range, severity, category, and route filters
- Full-text search and pagination
- Click-through severity totals
- Expandable log details with request IDs and sanitized metadata
- CSV or JSON export
- Incident acknowledgement and notes

### Product analytics

- Registration, retention, household creation, and transaction trends
- Transaction volume and value over time
- Income-versus-expense trends
- Feature-adoption and cohort metrics
- Historical DAU/WAU/MAU charts backed by daily rollups rather than only latest activity

### Runtime performance

- Request throughput and p50/p95/p99 latency
- 4xx and 5xx rates
- Database query latency
- Readiness, dependency, and background-job status
- Client application version breakdown

### Administration tools

- User search and account details
- Role management, account suspension, and session revocation
- Password-reset and email-verification support
- Household support and data-integrity tools
- Feature flags and operational settings
- Immutable audit trail for administrator actions

### Observability and scale

- Indexed or hosted log storage
- OpenTelemetry and error-monitoring integration
- Cached metric rollups and retention policies
- Threshold-based email or chat alerts
- Privacy controls and PII-redaction verification
