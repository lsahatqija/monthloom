# Graph view implementation plan

## Purpose

Add an authenticated Graphs view at `/graph` that gives users an interactive visual summary of a
selected household's transactions. Users can choose a whole-month period, switch between Balance,
Category, and Overview graphs, and refine each graph with graph-specific controls.

Charts are assembled in the browser from transaction data returned by the API. Chart images and
pre-aggregated chart datasets are not generated or stored on the server.

This plan is organized so that every milestone is independently reviewable and leaves the main
branch deployable.

## Agreed product decisions

### Navigation and selection

- The route is `/graph` and its user-facing navigation label is `Graphs`.
- Add Graphs to the authenticated header and account/mobile menu.
- The selected household and compatible month selection carry between Home and Graphs.
- Graph state is URL-addressable so refresh and browser back/forward restore the view.
- The primary graph and period selectors are dropdowns.
- Choices with two or three values use segmented controls:
  - Balance chart: line or area.
  - Balance calculation: daily or cumulative.
  - Category grouping: user, source, or transaction type.
  - Category chart: pie, bar, or radial bar.
  - Overview transaction kind: expense or income.
  - Overview user presentation: combine or compare.

### Periods

- The default period is the current month.
- The available presets are:
  - Current month.
  - Last month.
  - Current year.
  - Last year.
  - Last 12 months.
  - Custom month.
  - Custom period.
- Period selection has month granularity. It never asks for an individual calendar day.
- Custom month uses one month/year picker.
- Custom period uses inclusive start and end month/year pickers.
- A selected month includes its entire first through last calendar day.
- Current year covers January through the current month. The current month may include projected
  transactions after today.
- Last year covers all twelve months of the preceding calendar year.
- Last 12 months covers the current full calendar month and the preceding eleven full calendar
  months.
- Selectable months are bounded to five years before and one year after the current month.
- The start month cannot be after the end month.
- The month granularity applies to period selection. Balance calculations may still use daily data
  points within the selected whole months.

### Realized and projected transactions

- Include both realized and projected recurring transactions.
- Realized and projected values must be distinguishable without relying only on color:
  - Realized values use solid strokes and full-opacity fills.
  - Projected values use dashed strokes, lower-opacity or patterned fills, and explicit labels.
  - Tooltips, legends, summaries, and accessible data tables state realized and projected amounts
    separately.
- Totals and percentages include both realized and projected values unless explicitly labeled as a
  realized-only value.

### Balance graph

- X-axis: calendar days across the selected whole-month period.
- Y-axis: localized household-currency amount.
- Expenses are negative values.
- The line chart contains income, expenses, and balance series centered around a visible zero line.
- The area chart contains a balance line and an area that is green above zero and red below zero.
- Users can switch between:
  - Daily: each point represents that day's income, expenses, and net balance.
  - Cumulative: running income, running negative expenses, and running net balance.
- Cumulative calculations always begin at zero at the start of the selected period. Transactions
  before the selected period do not contribute an opening balance.
- A cumulative series includes an explicit zero anchor before its first accumulated point.

### Category graph

- Category graphs include expenses only.
- Users can group expenses by user, source, or transaction type.
- Users can render the grouping as a pie, bar, or radial bar chart.
- Show every non-zero group. Do not apply a top-N limit or combine smaller groups into `Other`.
- Every group has a deterministic, distinct color that remains stable while changing period or
  chart variant.
- The legend shows each label, percentage, total amount, realized amount, and projected amount.
- Groups are ordered by total amount descending, with a deterministic label tie-breaker.

### Overview graph

- Overview uses a radar chart.
- Expense dimensions are non-zero transaction types.
- Income dimensions are non-zero sources.
- Zero-value dimensions are omitted.
- All selected users are selected by default.
- If an interaction would leave no selected users, all users are selected automatically.
- Combine mode aggregates all selected users into one radar series.
- Compare mode draws one overlapping radar series per selected user, using stable user colors and
  transparent fills.
- In compare mode, all user series use the same dimensions and scale. A dimension is included when
  at least one selected user has a non-zero value for it.
- Amounts use logarithmic normalization against the highest amount visible in the current radar:

  ```ts
  normalized = highestAmount === 0 ? 0 : Math.log1p(amount) / Math.log1p(highestAmount);
  ```

- Axis labels, tooltips, legends, summaries, and the data table show actual currency values rather
  than only normalized values.

### Production data and database migrations

- Production already contains user data. Preserving that data is a release requirement for every
  milestone.
- The planned graph feature is database-schema-neutral by default: the range endpoint should read
  the existing income, expense, recurrence, household, member, and source tables without changing
  their stored representation.
- Shared Zod transport schemas may be extended without a database migration when the persisted data
  model does not change. Database schema changes must never be implied merely by a transport schema
  change.
- If implementation discovers that a database change is necessary, it belongs to the milestone
  that first needs it. For this plan, the earliest expected decision point is Milestone 2, before
  range API code relies on a persistent occurrence key or new index.
- Never edit an already-applied migration. Add a new ordered migration under the existing Drizzle
  migration system.
- Production migrations must be backward-compatible with both the previously deployed API and the
  new API so an application-image rollback remains possible.
- Prefer an expand-and-migrate rollout:
  1. Add nullable columns, new tables, or non-conflicting indexes without removing or reinterpreting
     existing fields.
  2. Backfill existing rows deterministically and idempotently.
  3. Validate row counts, null counts, uniqueness, relationships, and representative finance totals.
  4. Deploy code that can read the migrated representation while remaining compatible with old
     rows during the rollout.
  5. Add stricter constraints only after the backfill is proven complete.
  6. Defer destructive cleanup to a later, separately reviewed release.
- A schema-changing pull request must include migration tests starting from the full previously
  released schema with representative existing data. Tests must prove both data preservation and
  application behavior after migration; creating only a fresh database is insufficient.
- Rehearse every data-transforming migration against a production-shaped database copy or an
  anonymized snapshot before release. Record expected runtime and locking behavior.
- The production updater already creates a pre-deployment backup and the API runs migrations before
  accepting traffic. A schema-changing release must verify that the backup completed successfully,
  identify the restore procedure, and include post-migration checks before the release is considered
  healthy.
- A destructive or non-backward-compatible migration must not use the automatic deployment channel.
  It requires an explicit maintenance plan, tested restore path, and product-owner approval.

## UX and data behavior specification

### URL state

Use stable, validated search parameters. The exact internal names may change during implementation,
but the resulting URL must represent all user-visible selections.

```text
/graph?household=<id>&period=current-month&graph=balance&chart=line&mode=daily
/graph?household=<id>&period=custom-period&from=2026-01&to=2026-06&graph=overview
```

Graph-specific parameters should be ignored when another graph is active, but retained in local
component state during an in-page graph switch so returning to a graph restores its previous
configuration. Invalid or inaccessible household IDs fall back to the user's primary household,
then their first available household. Invalid period values fall back to current month.

When moving between Home and Graphs:

- Home's `household` parameter maps directly to Graphs.
- Home's `month` parameter opens Graphs with `custom-month` for that month, except that the current
  month may use the equivalent `current-month` preset.
- A single-month Graphs period maps back to Home's `month` parameter.
- A multi-month Graphs period carries the household and opens Home on the current month because Home
  cannot represent a range.

### Projected-value presentation by chart

Use one consistent semantic convention, adapted to each chart type:

- Balance line:
  - Solid realized series.
  - Dashed same-series extension or delta for projected values.
  - Hollow point markers where a date contains a projected contribution.
- Balance area:
  - Solid realized area.
  - Patterned or lower-opacity projected contribution.
  - Positive and negative coloring remains visible in both states.
- Category bar and radial bar:
  - Stack realized and projected portions within each category using the same base hue.
  - Projected portions use a pattern or lower opacity plus a visible boundary.
- Category pie:
  - Render realized and projected portions as adjacent sub-slices of the same category hue.
  - Projected sub-slices use a pattern or lower opacity.
  - The custom legend groups the two sub-slices into one category row.
- Overview:
  - Solid polygon/fill represents realized values.
  - A dashed outline represents the total including projections.
  - In compare mode, both outlines reuse the user's color; projected state is distinguished by
    stroke pattern and label rather than an additional color.

### Responsive behavior

- Desktop: selectors form a compact toolbar above a wide chart surface and adjacent or below-chart
  legend, depending on available width.
- Tablet: selectors wrap by logical groups; charts retain readable labels and tooltips.
- Mobile:
  - Selectors stack in task order.
  - The chart remains within the viewport with no page-level horizontal scrolling.
  - Category bar charts switch to a horizontal orientation.
  - Dense legends become a vertically scrolling list outside the chart, not a nested chart canvas.
  - Time-axis ticks are sampled while all data remains available through interaction and the table.
- Long ranges keep daily data but sample rendered X-axis labels. Do not discard transactions or
  silently change the selected period.

### Accessibility

- Every control has a visible label and keyboard-operable semantics.
- Segmented controls expose selected state with native radio semantics or `aria-pressed` as
  appropriate.
- Charts use Recharts' accessibility support and receive a useful title and description.
- Color is never the sole carrier of series, projection, sign, or selection meaning.
- Tooltips are reachable without hover-only interaction.
- Every chart has:
  - A concise text summary of the main values.
  - A visible `Show data table` disclosure.
  - A semantic table containing the exact values represented in the graph.
- Chart animation respects `prefers-reduced-motion`; data is readable immediately when animation is
  disabled.
- Focus remains stable when chart type or filters change.
- Controls meet existing application target-size and focus-visibility rules.
- Currency, percentages, dates, and month names use the active locale.

### Loading, empty, and error states

- Reserve chart height during loading to prevent layout shift.
- Show a chart-shaped skeleton only when loading takes long enough to avoid a visual flash.
- A failed range request shows a localized error and retry action.
- A household with no transactions in the period shows a clear empty state while keeping the
  selectors usable.
- A graph-specific empty result explains the active filters, for example that selected users have no
  income in the period.
- The existing no-household state links to household settings.

## Technical architecture

### Frontend structure

Suggested organization:

```text
apps/web/src/app/(authenticated)/graph/
  page.tsx

apps/web/src/features/finance/graph/
  graph-view.tsx
  graph-view.css
  graph-controls.tsx
  graph-state.ts
  period.ts
  use-graph-selection.ts
  aggregation/
    balance.ts
    category.ts
    overview.ts
    colors.ts
  charts/
    balance-chart.tsx
    category-chart.tsx
    overview-chart.tsx
    chart-tooltip.tsx
    chart-data-table.tsx
    projection-patterns.tsx

apps/web/src/features/finance/selectors/
  household-picker.tsx
  month-picker.tsx
  period-picker.tsx
```

Keep the App Router page a server component and place state, querying, aggregation, and Recharts in
client-component leaves. Dynamically load the chart surface if bundle analysis shows that doing so
keeps Recharts out of the initial Home route bundle.

### Chart dependency

Add Recharts to `apps/web`. It supports the requested line, area, bar, pie, radial bar, and radar
charts in one React-oriented SVG library. Wrap it behind feature-local chart components so data
aggregation and product rules do not depend on Recharts component APIs.

### Shared contracts

Add month-granularity range schemas to `@monthloom/contracts`:

```ts
const calendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const householdTransactionRangeQuerySchema = z
  .object({ from: calendarMonthSchema, to: calendarMonthSchema })
  .refine(({ from, to }) => from <= to, {
    path: ['to'],
    message: 'End month cannot be before start month',
  });
```

The response should return raw transaction DTOs plus the household, members, sources, and selected
month bounds:

```ts
interface HouseholdTransactionRangeResponse {
  household: HouseholdDto;
  from: string;
  to: string;
  members: HouseholdMember[];
  sources: HouseholdSource[];
  transactions: HouseholdTransaction[];
}
```

The controller validates the requested bounds relative to the current calendar month. The API must
also enforce the five-years-past and one-year-future policy so a modified client cannot bypass it.

### API endpoint

Add:

```http
GET /api/v1/households/:id/transactions?from=YYYY-MM&to=YYYY-MM
```

The endpoint:

- Requires authentication and household membership.
- Treats `from` and `to` as inclusive full months.
- Returns actual transactions within the interval.
- Synthesizes projected recurring occurrences through the selected end month using existing
  recurrence rules.
- Does not return occurrences outside the requested bounds.
- Returns transaction-level data rather than chart aggregates.
- Orders transactions by date and then stable identity.
- Preserves the `projected` flag.

Projected transactions currently reuse a source transaction ID, so frontend keys and any new range
logic must use a collision-safe occurrence identity such as `id + date + projected`. The contract
may introduce a computed occurrence key if testing shows that this is safer across recurrence
edits. Prefer a computed transport field over a new persisted column. If persistence is genuinely
required, Milestone 2 must add and validate the backward-compatible migration before the range API
depends on it.

### Repository and recurrence strategy

Do not implement the range endpoint by sending one browser request per month. Extend the transaction
repository with a cohesive range operation.

The repository should:

1. Resolve the first and last calendar dates from the month keys.
2. Query realized income and expenses for the entire interval.
3. Load the recurrence history necessary to project occurrences through the end month.
4. Generate missing projected occurrences once per recurrence series.
5. Avoid synthesizing a projection when a realized occurrence already exists on that series/date.
6. Respect recurrence interval, unit, expiration date, edited series state, and current projection
   behavior.
7. Return one sorted transaction collection.

Extract shared row selection and mapping helpers before adding a second large query path. Keep money
and recurrence calculations in pure functions where possible.

### Frontend query and cache

Add:

```ts
financeKeys.householdRange(householdId, from, to);
useHouseholdTransactionRange(householdId, from, to);
```

Mutations that create, edit, or remove transactions must invalidate both affected monthly queries
and applicable range queries. Initially, invalidating all cached ranges for the household is safer
than attempting incomplete date-overlap logic. Optimize only after measuring a real cache problem.

### Aggregation rules

All aggregators are pure, independently tested functions. Convert amounts to integer cents before
summing and format only at the presentation boundary.

#### Balance aggregation

1. Generate every calendar date in the inclusive month range, including dates with zero activity.
2. Split realized and projected contributions.
3. Compute daily income, negative expenses, and net balance.
4. For cumulative mode, seed zero and compute running totals across the selected range only.
5. Expose realized, projected, and combined values needed by the chart and table.
6. Derive a symmetric Y-axis domain around zero from the largest absolute visible value.

#### Category aggregation

1. Filter to expenses.
2. Group by the selected user's ID, source ID, or transaction type key.
3. Sum realized and projected cents separately.
4. Calculate totals and percentages from the combined period expense total.
5. Remove zero-total groups.
6. Sort by combined total descending and label ascending for ties.
7. Assign stable colors from semantic palette helpers.

#### Overview aggregation

1. Filter by expense or income and the selected user IDs.
2. Build dimensions from the union of non-zero keys across selected users.
3. In combine mode, aggregate selected users into one realized series and one total-with-projection
   outline.
4. In compare mode, produce realized and total-with-projection series for each selected user.
5. Find the maximum combined value across all visible dimensions and series.
6. Apply `log1p` normalization while retaining raw cents alongside normalized values.
7. Use the same ordered dimensions and maximum for every series.

### Stable colors

- Use the existing user desired color for user grouping and compare mode when it has sufficient
  contrast; otherwise derive an accessible chart-safe variant.
- Use deterministic keys for transaction types and sources so colors do not change with ordering.
- Use semantic tokens for income, expense, balance, realized, and projected states.
- Build and test light- and dark-theme mappings.
- When the number of groups exceeds the palette, vary patterns or stroke styles as well as hue so
  categories remain distinguishable.

## Milestones

## Milestone 0: confirm baseline and add characterization coverage

### Goal

Protect the current selector, recurrence, and projection behavior before adding a range read path or
extracting reusable controls.

### Tasks

- [x] Run and record the existing lint, typecheck, unit, integration, and build gates.
- [x] Add or verify characterization tests for current-month and future-month projections.
- [x] Cover recurring series with daily, weekly, monthly, and yearly intervals across month
      boundaries.
- [x] Cover recurrence expiration, edited series, and realized occurrences replacing projections.
- [x] Add focused tests for current Home household/month URL restoration.
- [x] Record the current Home bundle size for comparison after adding Recharts.

### Definition of done

- The existing suite is green before feature changes begin.
- Current recurrence and URL-selection behavior is captured by tests that would fail on an
  accidental semantic change.
- The bundle baseline is recorded in the implementation pull request or project notes.

### Milestone 0 result (2026-10-30)

- Lint passed with one pre-existing `react-hooks/exhaustive-deps` warning in
  `onboarding-tour.tsx`.
- Production and test TypeScript checks passed.
- The pre-change suite passed 282 tests in 39 files. The completed milestone passes 284 tests in 40
  files after adding two characterization cases.
- Existing tests already covered current/future projections, recurrence expiration, edited series,
  and daily, weekly, monthly, and yearly recurrence across month boundaries.
- A new PostgreSQL integration case proves that a realized occurrence suppresses only the matching
  projected recurrence date.
- A new frontend hook case proves that Home restores both `household` and `month` from the initial
  URL and a later `popstate` event.
- The native Windows build compiled, type-checked, and generated all routes, then encountered the
  repository's documented `EPERM` restriction while creating standalone-output symlinks. The Linux
  Docker production builds for both API and web completed successfully.
- The production Home route baseline is 26.5 kB route JS, 178 kB first-load JS, and 87.3 kB
  shared first-load JS, as reported by the Next.js Linux production build.

---

## Milestone 1: create reusable month and household selection foundations

### Goal

Make the Graphs view reuse Home behavior without duplicating the large dashboard implementation.

### Tasks

- [x] Extract the Home month picker into a reusable month/year component.
- [x] Preserve its translated month labels, year handling, keyboard dismissal, focus restoration,
      responsive label variants, and current-month action.
- [x] Extract or introduce a reusable household picker with primary-household fallback.
- [x] Add a range-aware period resolver and pure preset functions.
- [x] Add validation for custom month bounds and start/end ordering.
- [x] Add `useGraphSelection` with validated URL parsing and history behavior.
- [x] Add Home-to-Graphs and Graphs-to-Home link-state helpers.
- [x] Add unit and component tests before changing Home to consume the extracted controls.

### Definition of done

- Home behaves identically after extraction.
- The reusable controls work independently in tests.
- Every preset resolves to the agreed inclusive month bounds, including leap years and year
  boundaries.
- Invalid URL values recover predictably without an error loop or inaccessible household request.

### Milestone 1 result (2026-10-30)

- Home now consumes reusable household and month/year picker components. Existing localized labels,
  responsive contraction, previous/next navigation, current-month action, Escape dismissal, and
  focus restoration remain intact.
- Household selection resolves an unavailable ID to the primary household, then the first available
  household. Home waits for that resolution before enabling its month query, so an inaccessible URL
  ID never produces a household-data request.
- Pure period helpers resolve every preset to inclusive whole months, handle leap years and year
  boundaries, and enforce the five-years-past/one-year-future bounds plus start/end ordering.
- `useGraphSelection` validates URL state, writes canonical parameters, pushes user changes, and
  restores state on `popstate`. Link helpers preserve compatible household/month state between Home
  and Graphs.
- The full suite passes 304 tests in 43 files. Lint passes with the one pre-existing onboarding hook
  warning, and production/test TypeScript checks pass.
- The Linux web production build passes. Home is 27.1 kB route JS and 179 kB first-load JS, a 0.6 kB
  route and 1 kB first-load increase from the Milestone 0 baseline; shared first-load JS remains
  87.3 kB.
- No persistent schema, database data, shared transport contract, or migration changed in this
  milestone.

---

## Milestone 2: implement the transaction range contract and API

### Goal

Serve one authorized, bounded collection containing the raw transactions needed for any graph.

### Tasks

- [x] Add shared range query and response schemas and exported TypeScript types.
- [x] Enforce `from <= to`, five-year past, and one-year future limits.
- [x] Record whether the range implementation requires a database schema change. The expected
      result is `no`; do not create a migration without a concrete persistence need.
- [x] If a database change is required, add an expand-and-migrate migration, deterministic backfill,
      old-schema-to-new-schema integration fixture, data-preservation assertions, rollback-compatible
      API behavior, and deployment/restore notes before merging dependent range code.
- [x] Extend the transaction repository interface with a range operation.
- [x] Implement realized income and expense range queries.
- [x] Generalize projection generation across multiple months without duplicating occurrences.
- [x] Add a range-view service method with household membership enforcement.
- [x] Add the controller method and `GET /:id/transactions` route.
- [x] Register the endpoint in module-local OpenAPI metadata.
- [x] Add the web API function, query key, and TanStack Query hook.
- [x] Update transaction mutation invalidation for household range queries.

### Verification

- [x] Unit-test range validation and calendar-bound calculations.
- [x] Unit-test multi-month projection generation.
- [x] Integration-test authentication and household membership boundaries.
- [x] Integration-test empty, realized-only, projected-only, and mixed ranges.
- [x] Integration-test last-12-month and cross-year ranges.
- [x] Verify returned amounts remain exact decimal strings and ordered deterministically.
- [x] Verify Express routes and OpenAPI paths remain in exact sync.

### Definition of done

- One API request returns all raw data required by every graph for any valid selected period.
- Unauthorized and out-of-bounds requests fail through the standard API error model.
- Projection results match existing single-month semantics for equivalent months.
- No stored chart output or server-side graph aggregation is introduced.
- The milestone either records that no database migration is required or contains a successfully
  rehearsed, backward-compatible migration that preserves all existing production data.

### Milestone 2 result (2026-10-30)

- The authenticated range endpoint returns household metadata, members, sources, and raw realized
  and projected transactions for inclusive month bounds.
- The API enforces ordered month keys and the five-years-past/one-year-future policy. Range reads
  reuse one repository projection path with existing monthly reads, preserve exact decimal strings,
  omit projected duplicates when a realized series occurrence exists, and sort by date then ID.
- The web client exposes the range request, household-scoped query keys, and a TanStack Query hook.
  Existing transaction mutation invalidation already targets the `finance` key prefix, so it also
  invalidates every new household range query.
- No database schema change or migration is required. The existing transaction dates and recurrence
  IDs provide all persisted data; clients can form collision-safe occurrence keys from transaction
  ID, occurrence date, and projected state.
- Production and test TypeScript checks pass. Contracts, API, and web lint pass with one pre-existing
  onboarding hook warning. All 224 unit tests pass, and all 18 finance integration tests pass against
  PostgreSQL. The route/OpenAPI synchronization test passes.

---

## Milestone 3: build and test the frontend aggregation layer

### Goal

Turn raw range transactions into stable, chart-independent view models.

### Tasks

- [x] Add shared date iteration and integer-cent helpers where existing helpers are not reusable.
- [x] Implement daily and cumulative Balance aggregators.
- [x] Implement Category aggregators for user, source, and transaction type.
- [x] Implement Overview combine and compare aggregators.
- [x] Implement logarithmic radar normalization and raw-value retention.
- [x] Implement deterministic color and pattern assignment.
- [x] Define reusable formatter helpers for currency, percentage, day, and month labels.
- [x] Define projection-aware chart view-model types.

### Verification

- [x] Test zero-transaction days and ranges.
- [x] Test positive, negative, and zero daily/cumulative balances.
- [x] Test that cumulative calculations begin at zero and ignore earlier transactions.
- [x] Test every category grouping and all-group retention.
- [x] Test realized/projected splits and combined percentages.
- [x] Test Overview with one user, multiple users, combine, compare, and automatic all-user reset.
- [x] Test omission of zero-value radar dimensions.
- [x] Test normalization when all values are zero and when values differ by several orders of
      magnitude.
- [x] Test stable colors across reordered data and changed periods.

### Definition of done

- Aggregation code contains no React or Recharts imports.
- All monetary aggregation uses integer cents.
- Given the same inputs and options, every aggregator returns deterministic output.
- Realized and projected components can be presented separately without recomputing transaction
  data inside chart components.

### Milestone 3 result (2026-10-30)

- Pure frontend aggregators now produce projection-aware Balance, Category, and Overview view
  models without React or chart-library imports.
- Monetary parsing and totals use checked integer cents. Balance ranges include every calendar day,
  cumulative data starts with an explicit zero anchor, and symmetric domains include every exposed
  realized, projected, and combined value.
- Category results retain every non-zero group, split realized/projected totals, calculate combined
  percentages, and sort deterministically. Overview results support combine and compare modes,
  automatically restore all users after an empty selection, retain raw cents, and share one
  logarithmic scale across visible radar series.
- Stable light/dark chart colors, overflow patterns, semantic series colors, and locale-aware
  currency, percentage, day, and month formatters are available to later chart milestones.
- All 151 web unit tests pass, including 15 focused aggregation cases. Web production TypeScript
  checking and lint for the new aggregation files pass.

---

## Milestone 4: deliver the Graphs route and control surface

### Goal

Create a complete, responsive Graphs screen shell before adding the final chart implementations.

### Tasks

- [ ] Add the authenticated `/graph` server route and client Graph view.
- [ ] Add the Graphs header action and account/mobile menu item with current-page state.
- [ ] Add translated page metadata and navigation labels.
- [ ] Build the household, period, graph, and contextual option controls.
- [ ] Show one picker for custom month and inclusive start/end pickers for custom period.
- [ ] Connect URL state, browser history, household fallback, and Home/Graphs state transfer.
- [ ] Connect the range query and graph aggregation selection.
- [ ] Implement loading, retryable error, no-household, and empty-period states.
- [ ] Reserve a responsive chart surface and legend/data-table regions.
- [ ] Add Recharts and verify it is isolated from unrelated route bundles.

### Definition of done

- `/graph` is authenticated, navigable, localized, and usable before chart-specific polish.
- Every agreed selector changes the URL and restores correctly after refresh and back/forward.
- Custom period validation is visible and keyboard accessible.
- Home and Graphs carry compatible household/month state in both directions.
- Loading and error transitions do not erase the user's current selection.

---

## Milestone 5: implement Balance charts

### Goal

Deliver the daily/cumulative line and area views with exact tooltips and projection semantics.

### Tasks

- [ ] Implement the centered-zero line chart with income, negative expense, and balance series.
- [ ] Implement daily and cumulative segmented controls.
- [ ] Implement the balance area chart with positive green and negative red fill.
- [ ] Add realized/projected stroke, point, fill, pattern, and legend treatments.
- [ ] Add symmetric Y-axis calculation and a labeled zero reference line.
- [ ] Add responsive X-axis tick sampling without reducing the data.
- [ ] Add localized currency/date tooltips and exact-value table.
- [ ] Add a concise screen-reader and visible text summary.

### Definition of done

- Daily and cumulative results match aggregation fixtures exactly.
- Cumulative mode visibly starts at zero.
- Expenses plot below zero.
- Positive and negative areas render correctly when a line crosses zero.
- Realized and projected values remain distinguishable in light/dark mode, grayscale, keyboard
  interaction, and the data table.

---

## Milestone 6: implement Category charts

### Goal

Deliver all grouping and chart variants without dropping low-value categories.

### Tasks

- [ ] Implement the User / Source / Transaction type segmented control.
- [ ] Implement pie, responsive bar, and radial bar variants.
- [ ] Render every non-zero category.
- [ ] Add stable category colors and overflow-safe pattern differentiation.
- [ ] Add projection-aware sub-slices or stacks for each variant.
- [ ] Add a custom legend with label, percentage, combined total, realized amount, and projected
      amount.
- [ ] Use horizontal bars on narrow screens and ensure long translated labels remain available.
- [ ] Add exact-value table and text summary.

### Definition of done

- All three groupings and all three chart types show identical totals for the same period.
- No non-zero group is hidden, collapsed, or combined into `Other`.
- Legend totals equal the period expense total.
- Categories remain identifiable when colors repeat or cannot be perceived.
- Large category counts remain operable without causing page-level horizontal scrolling.

---

## Milestone 7: implement Overview radar charts

### Goal

Deliver logarithmically scaled household and per-user comparisons across non-zero dimensions.

### Tasks

- [ ] Implement the Expense / Income segmented control.
- [ ] Implement the member checklist with all users selected by default.
- [ ] Restore all users automatically when the final selected user is deselected.
- [ ] Implement Combine / Compare segmented control.
- [ ] Render combined and overlapping per-user radar series.
- [ ] Use transparent compare fills, stable user colors, and explicit user labels.
- [ ] Render realized polygons and total-with-projection dashed outlines.
- [ ] Apply one logarithmic maximum and dimension set to all visible series.
- [ ] Add raw-value tooltips, legend, exact-value table, and text summary.
- [ ] Verify label layout with the maximum realistic non-zero dimension count.

### Definition of done

- Combine equals the sum of the selected users' underlying values.
- Compare shows one labeled user series per selected user on an identical scale.
- No zero-only dimension is displayed.
- Raw amounts remain discoverable even though geometry uses normalized values.
- Realized and projected values and overlapping users are distinguishable without relying solely on
  hue.

---

## Milestone 8: localization, accessibility, performance, and release hardening

### Goal

Bring the complete feature to the repository's production quality bar.

### Tasks

- [ ] Add graph strings to English, German, French, Albanian, and Turkish message files.
- [ ] Add accessible names, summaries, live status behavior, and table disclosures.
- [ ] Audit keyboard order, tooltip access, segmented controls, checklists, and focus stability.
- [ ] Audit contrast and projection patterns across every theme in light and dark modes.
- [ ] Respect reduced motion and verify charts remain readable with animation disabled.
- [ ] Verify layouts at 390px, 620px, 768px, 1024px, and 1440px plus 200% browser zoom.
- [ ] Measure Home and Graphs bundles against the Milestone 0 baseline.
- [ ] Memoize range resolution and aggregation only where profiling shows meaningful work.
- [ ] Update architecture and user documentation with the route and range endpoint.
- [ ] For every migration added by an earlier milestone, rehearse the complete production deployment
      sequence: verified backup, migration from the previously released schema with existing data,
      post-migration integrity checks, application health checks, and application-image rollback.
- [ ] Record the production migration result or explicitly record that the graph feature introduces
      no database schema changes.
- [ ] Run all workspace validation and production builds.

### Definition of done

- All supported locales render without missing keys, clipped essential controls, or untranslated
  graph terminology.
- Every chart can be understood through text/table output without seeing the SVG.
- The feature is fully keyboard operable and meets the application's contrast and focus standards.
- Adding Recharts does not increase the Home route's initial client bundle materially.
- Any required migration has a verified backup/restore path, preserves existing rows and finance
  totals, and remains compatible with the previously deployed API image. If no migration is needed,
  that decision is recorded.
- Lint, type checks, unit tests, integration tests, OpenAPI checks, and production builds pass.
- Manual smoke tests cover all graph/variant combinations with realized-only, projected-only, mixed,
  and empty datasets.

## Delivery and pull request strategy

Prefer reviewable vertical changes rather than one feature-sized pull request:

1. Baseline and selector extraction.
2. Shared range contract and API implementation.
3. Pure aggregation layer.
4. Route, navigation, controls, and query wiring.
5. Balance charts.
6. Category charts.
7. Overview chart.
8. Localization and release hardening.

API contract and recurrence work should merge before chart implementation depends on it. Chart pull
requests may use committed test fixtures while the API work is under review, but production code
must use the range query before release.

Any database migration must merge with the first milestone that requires the new persisted shape,
never as an untracked deployment follow-up. The migration and its compatibility tests must merge
before or atomically with code that depends on it. Destructive cleanup, if ever justified, ships in
a later release only after the expanded schema has been live and verified.

Every pull request should state:

- Which milestone tasks it completes.
- Whether it changes visible behavior or only structure.
- Which automated and manual checks were run.
- Any bundle-size change.
- Whether persistent schemas changed; if so, the migration, backfill, rehearsal evidence, integrity
  checks, locking/runtime assessment, backup/restore procedure, and rollback compatibility.
- Screenshots for desktop/mobile and light/dark mode when UI changes are included.

## Full feature definition of done

The Graphs feature is complete when:

- Authenticated users can open `/graph` from both desktop and mobile navigation.
- The selected household and compatible month state carry between Home and Graphs.
- Every preset and custom month range resolves to the agreed inclusive whole-month bounds.
- Requests outside five years past or one year future are rejected consistently by UI and API.
- One authorized API range request provides raw realized and projected transactions.
- Balance supports line/area and daily/cumulative combinations.
- Category supports all three groupings and all three chart variants without hiding non-zero groups.
- Overview supports expense/income, user selection, combine/compare, non-zero dimensions, and
  logarithmic normalization.
- Realized and projected values are visibly and textually distinct in every graph.
- All calculations use exact cent aggregation and reconcile with their accessible data tables.
- URL state survives refresh and browser navigation.
- Empty, loading, unavailable-household, invalid-period, and request-error states are complete.
- The view is localized in all supported languages, responsive, keyboard operable, screen-reader
  understandable, reduced-motion aware, and theme compatible.
- The existing Home view, recurrence behavior, API authorization, and transaction workflows remain
  regression-free.
- Existing production rows survive every required migration with household membership, sources,
  transaction amounts, dates, recurrence relationships, and realized/projected behavior intact.
- Every database change is represented by a new tested migration from the previously released
  schema, is backward-compatible with the prior API image, and has a rehearsed backup/restore path.
- All repository quality gates and production builds pass.
