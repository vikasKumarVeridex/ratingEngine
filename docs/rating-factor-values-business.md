# Rating Factor Value Configuration — Business Overview

## The problem

The Rating Factor Management screen already let a rating analyst register a new
factor — its name, code, category, line of business, scope, lookup type, and a
single default value. What it did **not** let anyone do was enter the actual
table of values that makes a factor useful: the code-to-factor mapping, the
mileage bands, the decision rules. A factor could be *declared* but not
*populated* — an analyst still had to ask engineering to load real values,
which defeated the platform's core promise that "a new factor becomes
available without a code change."

This gap was the most concrete blocker raised when reviewing the prototype:
there was no way to finish creating a rating factor end-to-end inside the UI.

## What changed

Every rating factor in **Rating Factor Management** (`factors.html`) now has a
**Configure Values** action (the grid icon next to View/Edit/History). Clicking
it opens an editor scoped to that factor's lookup type:

| Lookup Type | What the analyst enters |
|---|---|
| Table Lookup | Key → Value/Label → Factor rows |
| Decision Table | Condition → Factor rows |
| Interpolated Table | Input (X) → Factor (Y) breakpoints |
| Banded Range | Min → Max → Factor rows |
| Constant | Nothing to configure — points back to the factor's single Default Value |
| Formula | Nothing to configure here — routes the analyst to the Formula Builder |

Rows can be added, edited inline, or removed, and are saved with one click.
The grid immediately shows how many value rows exist for each factor (or
flags it **Not configured**), so an analyst can see at a glance which of the
500 registered factors are still missing their data — something that was
previously invisible.

## Who this is for

Rating/product analysts who own a line of business's rating logic and need to
stand up or adjust a factor without filing a ticket against engineering — the
same audience the rest of the platform (Product Management, Lines of
Business, Formula Builder) already serves.

## Business value

- **Closes the factor lifecycle.** Register → populate → reference in a
  formula is now possible without leaving the browser.
- **Visibility into configuration debt.** The "Not configured" flag surfaces
  factors that exist in name only, which previously had no way to be tracked.
- **Consistent with the platform's story.** "No code change" now actually
  covers the full factor, not just its metadata.

## Current limitations (prototype scope)

- This is a front-end prototype with no backend: values are saved to the
  browser's local storage, not a shared database. They are visible again on
  reload in the *same* browser, but are not visible to another user or
  device, and a version history is not yet tracked for value changes the way
  it's simulated for factor metadata.
- Large migrated reference tables (e.g. the 57,000-row ZIP-to-territory
  table) are intentionally out of scope for this row-by-row editor — it's
  sized for the kind of factor an analyst hand-authors (a handful to a few
  dozen rows), not bulk-imported data, which belongs in Bulk Import instead.
- Promoting this from prototype to production would mean replacing the
  local-storage persistence with a real versioned data store, and wiring
  "Save Values" into the same draft/publish and impact-analysis workflow the
  Formula Builder already simulates.
