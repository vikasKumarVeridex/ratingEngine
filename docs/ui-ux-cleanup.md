# Prototype UI cleanup

Updated 2026-09-09. Applies across all 41 HTML pages.

## What changed

- Shared spacing, readable labels, quieter cards and badges, consistent buttons, wider working areas and responsive layouts.
- Page descriptions move behind an information sign beside the page title.
- Field hints and explanatory section subtitles move beside their own labels/headings. Existing “More” help gets the same treatment.
- Help opens on hover, keyboard focus or click. Escape and outside click dismiss it. Longer help containing links opens an accessible popover; links remain usable.
- Warnings, missing-data messages, approval status, prices, validation and essential choices remain visible.
- Ordinary explanatory banners become a compact heading plus information sign. Warnings keep their summary in view.
- Wide AG Grid lists initially show up to six main fields, including status where present. Existing saved column choices win. All fields remain in Table options → Columns and record details.
- View/Edit remain in each row. Clone, history, custom actions and Delete move into a keyboard-accessible row menu. Original action callbacks and confirmation flows are retained.
- Add remains visible. Columns, Import and Export move into Table options without replacing their original IDs or handlers.
- Dashboard secondary metrics, activity and supporting charts are collapsible. Supporting analytics, loss-run, role, API and integration sections use the same pattern. Quote JSON keeps mapping detail behind its own disclosure after results exist.
- Sidebar groups start collapsed except the current group. Existing expansion choices remain respected. Previously hard-to-find prototype screens now have grouped navigation links.
- Removed the temporary Formula Builder diagnostic banner. Kept formula editing, testing and approval behavior.
- Fixed an existing evaluator compatibility issue found during cleanup: the builder emits function tokens with type `fn`; those now pass the same strict token validation as supported operators. No rating arithmetic changed.

## Files

`assets/css/workspace.css` holds the shared presentation changes. `assets/js/ui-ux.js` handles contextual help, progressive disclosure and row menus. Every HTML page loads both, plus one shared tooltip dictionary.

The existing `app.css` palette and core dimensions remain. No new production dependencies. No rating configuration reset. No database or hosted deployment changes.

The old `column-tooltips.js` remains on disk for reference, but pages use the new unified accessible information buttons instead of two competing tooltip systems.

## Testing

Run existing checks:

```sh
node tests/static-integrity.test.js
node tests/framework-compliance.test.js
node tests/audit-tooltips.js
node tests/rating-determinism.test.js
node tests/rating-context.test.js
```

DOM unit/integration tests use temporary test dependencies, separate from the prototype:

```sh
npm install --prefix /tmp/veridex-ux-tests jsdom@26.1.0 ag-grid-community@31.3.2 bootstrap@5.3.3 --ignore-scripts --no-audit --no-fund
NODE_PATH=/tmp/veridex-ux-tests/node_modules node tests/ui-ux.test.js
NODE_PATH=/tmp/veridex-ux-tests/node_modules node tests/ui-pages.test.js
```

Unit coverage: label associations, keyboard/touch help, Escape/focus restoration, linked help, visible warnings, collapsible sections, original toolbar handlers, valid table headers, dynamic fields, idempotent enhancement, row-menu keyboard actions and shared asset coverage for every page.

Integration tests execute existing pages with their real grid/modal libraries in a DOM environment, without network access. They verify loading, main-column defaults, row actions and edit controls. They are not screenshot or device-rendering tests.

Reference premiums remain TRUCK 10,717; GL 51,975; PROP 19,010; MPL 3,026; CYBER 5,830; WC 61,178.
