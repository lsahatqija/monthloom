# Testing Monthloom

The suite uses Vitest for shared contracts and API unit tests, Supertest for API integration
tests, and React Testing Library with jsdom for frontend tests. API integration tests exercise
the real Express composition, middleware, services, PostgreSQL repositories, migrations and
temporary file storage. Frontend integration tests exercise components, forms, query state and
the HTTP client together, replacing only the network boundary and Next.js navigation.

## Run locally

Use the repository's pinned pnpm 9.7.0 and a supported Node.js version (CI uses Node 22).
Install dependencies with `pnpm install --frozen-lockfile`. Docker with Compose is required for
the supplied integration database. You do not need a running API, web server or development
database, and you do not need an `.env` file.

```sh
pnpm test:db:up
pnpm test
pnpm test:db:down
```

The test database runs on `127.0.0.1:55432`. Its Compose project is separate from the development
stack, uses temporary storage, and has no production credentials. Stop it with `test:db:down`
when finished. The runner deliberately fails if the database is unavailable; it never silently
skips integration tests.

| Command                                                 | Scope                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm test`                                             | All unit and integration tests, one run                                    |
| `pnpm test:unit`                                        | All unit tests; no Docker required                                         |
| `pnpm test:integration`                                 | API and frontend integration tests                                         |
| `pnpm test:api`                                         | API unit and integration tests                                             |
| `pnpm test:web`                                         | Frontend unit and integration tests; no Docker required                    |
| `pnpm test:contracts`                                   | Shared schema tests; no Docker required                                    |
| `pnpm test finance`                                     | Finance tests across all packages                                          |
| `pnpm test:api auth`                                    | API authentication tests only                                              |
| `pnpm test --project=api-unit finance`                  | Finance service unit tests only                                            |
| `pnpm test --project=api-integration finance`           | Finance API/database tests only                                            |
| `pnpm test --project=web-integration finance-dashboard` | Dashboard integration tests only                                           |
| `pnpm test:watch --project=web-*`                       | Frontend watch mode                                                        |
| `pnpm test:coverage`                                    | Full suite and coverage checks/reports                                     |
| `pnpm test:ci`                                          | Application/test type checks, full suite, coverage checks and JUnit report |

Package commands also work: `pnpm --filter @template/api test auth`,
`pnpm --filter @template/web test`, and `pnpm --filter @template/contracts test`.
Append `-t "test name"` to select individual cases. Use `pnpm test:watch` for the entire suite
(keep the test database running), or select a project to narrow the watch loop. No matching
test files is an error, helping catch misspelled filters in automation.

## Isolation and external services

Each API integration file creates a uniquely named `monthloom_test_<uuid>` database, applies
every committed migration, truncates application data between cases, closes connection pools,
and drops its database at teardown. Tests can run concurrently and repeatedly without relying
on seed data. A temporary upload directory is created per integration file and removed afterward.
If a process is forcibly terminated, restarting the disposable Compose database clears leftovers.

For an existing **dedicated test PostgreSQL server**, set `TEST_DATABASE_URL` in the shell. Its
database name must be `monthloom_test`, and the role must have `CREATEDB`. The supplied base
database is only used to create and drop uniquely named test databases; migrations and truncation
never run against it. The default is:

```text
postgres://monthloom_test:monthloom_test@127.0.0.1:55432/monthloom_test
```

The harness overrides `DATABASE_URL`, cookie settings, email transport and upload configuration.
The API does not read the root `.env` when `NODE_ENV=test`. Unit tests receive an unusable database
URL to catch accidental persistence access. Email uses the log transport with silent logging;
selected tests capture delivery at the email-service boundary. No real emails are sent. Rate
limits remain enabled with high test limits so independent scenarios cannot exhaust a shared
limit. Rate-limit exhaustion itself is not covered by these scenarios.

The Vite 6 override retains compatibility with the existing Node 20.11 minimum; newer Vite
majors require newer Node versions. Runtime test imports resolve contracts directly to source
to avoid stale built schemas. Normal type checks still verify workspace package boundaries.

## Regression coverage and extending it

Tests live outside production source/builds:

```text
apps/api/tests/unit/            Service rules with typed repository/storage doubles
apps/api/tests/integration/     HTTP + PostgreSQL + migrations + temporary uploads
apps/web/tests/unit/            Redirect and API-client behavior
apps/web/tests/integration/     Forms and dashboard interactions
packages/contracts/tests/      Shared request/response validation
```

The initial suite covers registration/login/logout, session expiry, email verification,
password reset/change, profile updates, household authorization and ownership transfer,
single-use invitations, source conflicts/copying, transaction CRUD, financial totals, recurring
projections and edit/delete scopes, file ownership/upload/download/deletion, health endpoints,
origin protection, validation errors, login form behavior, transaction forms and dashboard
sorting/filtering/deletion.

For a feature, add a unit test for each new business rule and an integration case for its
persistence/HTTP or UI behavior. For a bug, add a case that fails before the fix. Cover success,
invalid inputs and authorization boundaries. Prefer observable results over snapshots or
assertions that only repeat the implementation. Use `apps/api/tests/http.ts` for authenticated
HTTP fixtures, `vitest-mock-extended` for typed dependency doubles, and
`apps/web/tests/render.tsx` for a fresh QueryClient with retries disabled. Name files after the
module so command-line filters continue to work. Never mark database tests skipped when setup
fails; fix the setup or fail the run.

`coverage/index.html` is the browsable report; `coverage/lcov.info` supports coverage tools;
`coverage/coverage-summary.json` supports automation. CI also writes `test-results/junit.xml`.
All reports are ignored by Git. Coverage includes untested source files. Thresholds in
`vitest.config.ts` enforce global floors (60% lines/statements, 75% branches, 65% functions)
and separate package floors, so one package cannot hide a large coverage loss in another.
Raise these floors as tests are added. Run coverage on the full suite; deliberately filtered
runs cannot meet the full-codebase thresholds.

This is an extensible regression baseline, not exhaustive coverage of every screen or branch.
jsdom tests do not verify browser layout, actual cookie/CORS enforcement, Next.js server
rendering or deployed infrastructure. Full browser end-to-end tests and deployment smoke tests
are separate future layers. Coverage percentages alone do not establish correctness.

## GitHub Actions and deployment gates

`.github/workflows/tests.yml` runs on pull requests, pushes and manual dispatch. It provisions
PostgreSQL 16, installs the frozen pnpm lockfile, runs lint and `pnpm test:ci`, and uploads test
and coverage reports even when tests fail. No repository secrets are needed. The workflow is
also reusable through `workflow_call`.

After the first pushed run, require **Unit and integration tests** in the branch ruleset for
protected branches. This repository setting must be enabled on GitHub; a workflow file alone
does not prevent merging. Require branches to be current or use a merge queue with an
appropriate `merge_group` trigger if you adopt one.

After the `Tests` workflow succeeds for a push to `main` (including a merged pull request), the
separate `.github/workflows/publish.yml` workflow checks out the exact commit that passed and
publishes its images. Failed tests, pull requests, other branches, manual runs and reusable
workflow calls do not publish. Keep the branch ruleset enabled to ensure changes reach `main`
only through passing pull requests.

Configure these repository secrets under **Settings > Secrets and variables > Actions**:

- `DOCKERHUB_USERNAME`: the Docker Hub account with push access to `lsahatqija/monthloom`.
- `DOCKERHUB_TOKEN`: a Docker Hub access token with read/write permission for that repository.

Optionally configure the Actions repository variable `NEXT_PUBLIC_API_URL` with the public
API URL used by browsers. It defaults to `http://localhost:4000` and is baked into the web
image at build time; changing a running container's environment does not replace it.

The job uses `compose.yml` with `compose.publish.yml` to build the API and web images, then
pushes both to the single Docker Hub repository with separate service tags:

- `lsahatqija/monthloom:api-<commit-sha>` and `lsahatqija/monthloom:web-<commit-sha>`.
- `lsahatqija/monthloom:api-latest` and `lsahatqija/monthloom:web-latest`.

Both builds must succeed before publishing begins. Publishing jobs are serialized; pushes of
multiple images/tags are not atomic, so use matching commit tags for deployments. PostgreSQL
continues to use its official image and is not republished. This workflow publishes images;
it does not start containers on a hosting server. Post-deployment smoke tests should be added
separately when a hosting target exists.

The root `.dockerignore` excludes local dependencies, generated builds and `.env` files from
the shared build context used by both Dockerfiles.

Authentication follows the [Docker GitHub Actions guidance](https://docs.docker.com/build/ci/github-actions/).

References: [Vitest coverage](https://vitest.dev/guide/coverage.html),
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), and
[GitHub PostgreSQL services](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
