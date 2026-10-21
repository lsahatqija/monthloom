# UI/UX improvement plan

This document turns the dashboard review and user feedback into an implementation backlog. Work
through the phases in order and keep each item small enough to implement and verify independently.

## Agreed product decisions

- Transactions may be dated outside the month currently shown on the dashboard.
- A cross-month transaction must clearly state its destination month before and after saving.
- Transaction rows must remain single-line at every viewport width.
- The table must not require horizontal page or table scrolling.
- The transaction row order is: icon/color, recurring state, date, amount, source, type, user,
  actions.
- Icon, recurring state, date, and amount use only the width they need. Source receives the flexible
  space and truncates with an ellipsis.
- When space is limited, hide the transaction type first, then hide the user name while retaining
  the avatar.
- The avatar is the final informational item. The action menu remains the final interactive item.
- Icon and color belong to each transaction, not to its source.
- A source with transaction history reuses the icon and color from its most recent transaction.
- A source without transaction history receives a random icon/color pair when selected. Randomize
  once per selection and never overwrite a manual choice.
- Icon and color controls remain visible in the form, but icon names and color hex values do not.
- Monochromatic transaction-type icons are deferred until testing shows that omitting the type label
  causes a real scanning problem.

## Phase 1: Prevent lost cross-month transactions

- [x] Pass the dashboard's selected month into the add/edit transaction form.
- [x] Choose a date in the viewed month by default when adding a transaction from a non-current
      month. Continue to default to today when viewing the current month.
- [x] When the transaction date is outside the viewed month, show a non-error inline notice below
      the date field naming both months.
- [x] Change the submit label to include the destination month, for example `Add to November`.
- [x] After saving outside the viewed month, keep the user on the current dashboard and show a
      persistent confirmation with a `View November` action.
- [x] Apply the same warning when editing a transaction into another month.
- [x] Include the destination month in recurring-transaction confirmation where applicable.
- [x] Add integration tests for current-month, past-month, future-month, edit, and recurring cases.

Acceptance criteria:

- Cross-month entry remains allowed.
- Before submission, the destination month cannot reasonably be mistaken for the viewed month.
- After submission, the user can navigate directly to the month containing the transaction.
- Date behavior is covered by tests and works across year boundaries.

## Phase 2: Make the transaction table single-line and responsive

- [ ] Reorder columns to icon/color, recurring state, date, amount, source, type, user, actions.
- [ ] Give icon, recurring state, date, amount, avatar, and actions fixed or content-sized columns.
- [ ] Give source the remaining width and truncate it with an ellipsis.
- [ ] Keep the full source available through an accessible title or tooltip when truncated.
- [ ] Right-align amount, use tabular figures, include the household currency, and prevent wrapping.
- [ ] Keep date compact, readable, and visually quieter than amount.
- [ ] Remove the table's fixed `42rem` minimum width and eliminate horizontal scrolling.
- [ ] Hide transaction type at the first constrained-width breakpoint.
- [ ] Hide the user name at the next breakpoint while keeping the avatar.
- [ ] Keep every row single-line; do not convert rows to cards or stacked mobile layouts.
- [ ] Keep recurring/projected meaning accessible without relying on color, italics, or hover alone.
- [ ] Add responsive tests for full desktop data and reduced tablet/mobile data.

Acceptance criteria:

- Rows never wrap at 1440px, 768px, or 390px.
- The table does not scroll horizontally at those widths.
- Icon/color, recurring state, date, amount, source, avatar, and actions remain available on portrait
  mobile.
- Source, date, and amount remain easy to scan, with date and amount never truncated.

## Phase 3: Improve transaction appearance defaults and controls

- [ ] Keep icon and color as separate transaction fields.
- [ ] Remove the visible icon name from the selected icon control.
- [ ] Remove the visible color hex value from the selected color control.
- [ ] Retain accessible names for icon and color choices.
- [ ] Keep both controls visible in the main form rather than placing them behind a disclosure.
- [ ] When a source is selected, reuse the most recent transaction's icon/color if history exists.
- [ ] When no history exists, choose a random icon/color pair.
- [ ] Avoid regenerating the random pair on rerender or unrelated field changes.
- [ ] Stop applying automatic values after the user manually changes either field.
- [ ] Preserve existing values when editing a transaction.
- [ ] Add tests for historical reuse, first-use randomization, manual overrides, source changes, and
      editing.

Acceptance criteria:

- The form exposes the visual result rather than implementation names or hex values.
- First-use sources do not all receive the same default appearance.
- Existing source behavior remains predictable and editable.

## Phase 4: Recompose the add/edit transaction modal

- [ ] Use the field order: kind, source, amount/date, type/user, icon/color, recurrence, actions.
- [ ] Increase the desktop modal width only as much as needed to prevent clipped values.
- [ ] Give amount at least as much width as date and show the household currency in the control.
- [ ] Show the selected user's profile image in the user selector.
- [ ] Keep labels and selected values visible without unnecessary truncation.
- [ ] Stack paired fields when either field becomes too narrow.
- [ ] Keep actions reachable when recurrence makes the form tall, using a sticky footer if needed.
- [ ] Verify that modal, form, and popovers do not create competing nested scroll regions.
- [ ] Move focus into the modal on open, trap focus, and restore it to the trigger on close.
- [ ] Confirm before dismissing a dirty form.
- [ ] Connect field errors to their inputs and focus the error summary after a failed submit.

Acceptance criteria:

- No field content is clipped at desktop, tablet, or portrait-mobile widths.
- Amount is at least as visually prominent as date.
- The selected member is recognizable by avatar and name.
- The complete modal is operable by keyboard and screen reader.

## Phase 5: Simplify filters

- [ ] Group filters into transaction, date, and amount sections.
- [ ] Give the filter surface consistent edge padding and larger gaps between groups than within
      groups.
- [ ] Add household currency context to amount filters.
- [ ] Show active filters after collapse as removable chips or an equivalent compact summary.
- [ ] Keep result count and `Clear filters` together.
- [ ] Replace the portrait-mobile two-column filter grid with a filter sheet.
- [ ] Keep the most frequently used controls first; put secondary controls later without removing
      them.
- [ ] Verify keyboard focus, dismissal, and retained filter state.

Acceptance criteria:

- Filter controls do not touch panel edges or each other.
- Active filters remain obvious while the controls are collapsed.
- Opening filters does not push the transaction list unnecessarily far down on mobile.

## Phase 6: Improve month navigation

- [ ] Treat the selected month as part of the dashboard heading rather than an isolated pill select.
- [ ] Replace text arrows with the project's existing Lucide icon set.
- [ ] Keep previous and next controls at least 44px square.
- [ ] Let the month label open a compact month/year picker.
- [ ] Offer a `Current month` action when another month is selected.
- [ ] Preserve the selected month in the URL and retain browser back/forward behavior.
- [ ] Verify long localized month names without clipping important controls.

Acceptance criteria:

- Household, selected month, and navigation form one clear heading group.
- Month changes remain keyboard accessible and URL-addressable.

## Phase 7: Rebalance the monthly recap

- [ ] Make balance the leading figure and keep income, expenses, and savings subordinate.
- [ ] Replace uppercase tracked labels with sentence case.
- [ ] Use signs and labels so meaning does not depend on red/green alone.
- [ ] Remove the resting card shadow and use a flat divided surface or spacing instead.
- [ ] Replace the duplicate filtered recap with a smaller, explicitly labeled filtered state.
- [ ] Verify negative, zero, positive, savings, and filtered totals in every supported currency.

Acceptance criteria:

- The user's monthly position is the first financial fact read.
- Filtered totals cannot be confused with full-month totals.
- Figures remain aligned, currency-formatted, and accessible in light and dark themes.

## Phase 8: Visual-system and accessibility cleanup

- [ ] Reserve shadows for floating elements such as dialogs, menus, and popovers.
- [ ] Remove recurrence-wheel gradients or replace them with flat contrast cues.
- [ ] Remove unnecessary backdrop blur and verify the modal scrim against every theme.
- [ ] Reduce panel/control radius variation to one coherent family.
- [ ] Audit text, icon, border, focus, success, and danger contrast across all themes.
- [ ] Verify visible focus states and minimum pointer target sizes.
- [ ] Ensure projected and recurring states have accessible text equivalents.
- [ ] Review empty, loading, error, and no-match states after layout changes.

Acceptance criteria:

- Resting surfaces are visually quieter than interactive overlays.
- All meaningful text meets WCAG AA contrast.
- Keyboard focus is visible and no focused control is obscured.

## Verification for every phase

- Run the relevant unit and integration tests.
- Run web type checking and linting.
- Inspect the result at 1440px, 768px, and 390px.
- Check light and dark themes, including at least one theme with low-contrast risk.
- Check keyboard-only navigation and 200% browser zoom.
- Preserve existing URLs, sorting, filtering, recurring behavior, and transaction actions unless the
  phase explicitly changes them.

## Deferred ideas

- A separate monochromatic icon system for transaction types.
- Automatically navigating away from the viewed month after a cross-month save.
- Binding an icon or color permanently to a source.
- Multi-line or card-style transaction rows.

These should only be reconsidered after the implemented table and cross-month flow are tested with
real users.
