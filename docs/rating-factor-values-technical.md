# Rating Factor Value Configuration — Technical Notes

Scope: `veridex/platform` (the Bootstrap/vanilla-JS prototype — not
`veridex/admin-portal`, an earlier, separate mock that this feature does not
touch). No build step; every page is a static HTML file that loads
`assets/js/data.js` → `assets/js/core.js` → `assets/js/grid.js` and then an
inline `<script>` for page-specific logic.

## Background: how the platform already worked

- `data.js` builds an in-memory store `VX` (`D` internally, assigned to
  `window.VX`) from a seeded PRNG, so the same 500 `VX.ratingFactors` records
  exist on every page load.
- `grid.js`'s `vxGrid(opt)` is the generic CRUD grid used by every list page
  (`factors.html`, `products.html`, `lob.html`, …): search/sort/filter/paginate
  against a simulated REST layer (`API.list/get/create/update/remove/clone`,
  all just `setTimeout`-delayed operations on `VX[key]`), a generic
  add/edit `formModal()` built from an `opt.form` field spec, `viewModal()`,
  `histModal()` (static, cosmetic), and CSV import/export.
- Until now, a factor's *value* was just its single `defaultValue` number —
  there was no concept of a per-factor row table anywhere in the app.

## What was added

### 1. `assets/js/grid.js` — generic `rowActions` extension point

`vxGrid` now accepts an optional `opt.rowActions: [{ i, t, fn }]` array
(icon class, tooltip, and a `(rec) => void` handler). Each entry renders as an
extra icon button in the row's action cell (after History, before Delete) and
as an extra context-menu item, alongside the existing view/edit/clone/hist/del
actions. This was deliberately added to `vxGrid` itself rather than bolted
onto `factors.html` alone, so any future page can attach a page-specific row
action without forking the grid component — the same "configuration, not
code" principle the rest of the app follows.

No existing call site passes `rowActions`, so this is additive and changes no
existing page's behavior.

### 2. `assets/js/data.js` — `VX.factorValues`

```js
D.factorValues = (() => {
  try { return JSON.parse(localStorage.getItem("vxFactorValues") || "{}"); }
  catch (e) { return {}; }
})();
```

A plain object keyed by `ratingFactors[i].id` → array of row objects. Loaded
once at page load from `localStorage` under the key `vxFactorValues`. This is
the same pattern used for `MOCK.customRatingFactors` in the sibling
`admin-portal` prototype: the app has no backend, so `localStorage` is the
only way a value saved on one page is still there after navigating to
another page (`vxAutoSave()` in `core.js` is a purely cosmetic "Saving…"
indicator — it does not persist anything on its own).

Because `data.js`'s PRNG seed is fixed (`_s = 20260805`), `ratingFactors[i].id`
is stable across reloads, so keying by `id` is safe.

### 3. `factors.html` — the editor itself

- `VALUE_ROW_SCHEMAS`: maps each table-shaped `lookupType` to its column
  spec (`key`/`label`/input `type`):
  - `Table Lookup` → `key, value, factor`
  - `Decision Table` → `condition, factor`
  - `Interpolated Table` → `x, y`
  - `Banded Range` → `min, max, factor`
  - `Constant` and `Formula` are handled as special cases with no row
    schema (see below) — they're not in this map.
- `valueRowsCell(r)`: the grid's "Value Rows" column renderer. Reads
  `VX.factorValues[r.id]` and returns a row count, or a `Formula
  Builder`/`Constant` badge for those two types, or an amber **Not
  configured** badge when a table-type factor has zero rows.
- `openValuesModal(rec)`: built on `vxModal()` from `core.js` (the same
  Bootstrap-modal helper every other page uses).
  - `Formula` → informational modal with a button that navigates to
    `formula-builder.html` (formulas are authored there; this feature does
    not duplicate that UI).
  - `Constant` → informational modal pointing at the factor's own
    `defaultValue` (edited via the grid's existing Edit action).
  - Everything else → an editable row table: `rows` starts from a deep copy
    of `VX.factorValues[rec.id]` (or one blank row). Add/remove row buttons
    mutate the local `rows` array and call `redraw()`, which re-renders
    `#vfvBody` and rebinds input `oninput` handlers (`bindRowEvents()`).
    **Save Values** filters out fully-blank rows, writes the result to
    `VX.factorValues[rec.id]`, persists the whole map via
    `localStorage.setItem("vxFactorValues", …)`, toasts, and calls
    `grid.reload()` (the `{ reload, state }` handle `vxGrid` returns) so the
    "Value Rows" column updates without a full page reload.
  - `vxGrid`'s call is now bound to `const grid = …` specifically so this
    modal can call `grid.reload()`.

## Data model

```
VX.factorValues = {
  "<ratingFactor.id>": [
    { key: "...", value: "...", factor: 1.05 },   // Table Lookup
    // or { condition: "...", factor: 1.10 }       // Decision Table
    // or { x: 50000, y: 1.00 }                     // Interpolated Table
    // or { min: 0, max: 25000, factor: 0.95 }       // Banded Range
  ]
}
```

Row objects are untyped beyond what the input's `type` attribute coerces on
change (`+value` for `number` inputs). There is no validation beyond "not
entirely blank" — duplicate keys, overlapping bands, or non-monotonic
interpolation points are not checked (the AI Validation box in the modal is
cosmetic copy consistent with the rest of the app, not a real check, same as
elsewhere in this prototype).

## Known limitations / what a real implementation would need

- **Persistence.** `localStorage` is per-browser, per-origin, unbounded only
  by browser quota, and invisible to other users. A production version needs
  a real API (`POST /rating-factors/{id}/values`) and the same
  version/effective-date model the rest of the platform simulates
  (`v2026.03`, Draft vs. Active) rather than overwriting in place.
- **Validation.** Duplicate-key, overlapping-range, and monotonicity checks
  for Interpolated Table/Banded Range rows should be real, not decorative.
- **Scale.** This editor is intentionally unsuited to the large migrated
  lookup tables in `lookup-tables.html` (tens of thousands of rows) — those
  still only register metadata (row count, source sheet) in this prototype.
  Row-level data at that scale belongs behind Bulk Import, not a hand-typed
  grid.
- **No automated tests.** Verification here was `node -e "new Function(...)"`
  syntax checks against every edited file (`grid.js`, `data.js`,
  `factors.html`) — this environment has no browser automation available, so
  the interaction (drag rows, save, reload) has not been visually verified
  in an actual browser. Recommend a manual pass in Chrome/Edge before
  treating this as done: open `factors.html`, use **Configure Values** on a
  `Table Lookup` factor, add a couple of rows, Save, and confirm the "Value
  Rows" column updates and the rows are still there after a page refresh.
