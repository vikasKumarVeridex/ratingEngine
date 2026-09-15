---
name: verify
description: Drive the real VeriDex platform (headless Chrome via CDP) to verify a change instead of reading code or running tests.
---

# Verifying VeriDex (static HTML/JS, no build step, no server)

There is no build, no dev server, no test runner that exercises the UI. `tests/*.test.js`
are static/data-integrity checks (syntax compile, cross-file reference resolution, rating
math). They do **not** prove a UI change rendered or works — use them as a fast regression
net, not as verification.

## The handle: headless Chrome + CDP, real navigation, real clicks

Pages are plain files opened via `file://`. Launch Chrome headless, connect over the DevTools
protocol, navigate, and drive it like a user would:

```js
const { spawn } = require('child_process');
const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new','--disable-gpu','--window-size=1440,1000',
   `--user-data-dir=<scratch-dir>`,'--allow-file-access-from-files',
   `--remote-debugging-port=<port>`,'about:blank'], { stdio: 'ignore' });
// poll http://127.0.0.1:<port>/json/version until it answers, then
// PUT /json/new?about:blank to get a tab + its webSocketDebuggerUrl,
// connect a `ws`, and use Runtime.evaluate / Page.navigate / Input.dispatchMouseEvent /
// Page.captureScreenshot over it.
```

Base URL: `file:///c:/Users/VikasKumar/development/veridex/platform/<page>.html`.

**Wait for real completion**, not a fixed sleep: poll `document.readyState === 'complete'`,
then an extra ~1.2-1.5s settle (the shell (`vxShell()`) renders async-ish and some pages
pull in ag-grid).

**Use real mouse events for clicks that matter**, not `.click()`. `Input.dispatchMouseEvent`
(mousePressed + mouseReleased at the element's actual bounding-rect center) has caught real
layout bugs (an off-screen link from a flexbox overflow) that a synthetic `.click()` sailed
straight through. Exception: a collapsed nav group gives its link a zero-size bounding rect —
if you need a specific page, navigate directly by URL instead of clicking a possibly-collapsed
sidebar link.

**Capture evidence**: `Page.captureScreenshot({format:'png'})` returns base64 — write it to a
file and actually look at it (Read tool supports images). Screenshots are the primary evidence
for this app; text-only DOM dumps miss real rendering/collision issues.

## Workspace mode gotcha (affects almost every page)

`vxEnforceWorkspace()` runs at the top of every page's `vxShell()` call and redirects if the
current page isn't in the active workspace's nav:
- A **fresh profile defaults to `vxWorkspaceMode: "admin"`**, whose nav is only 3 items
  (Tenant Management, Tenant Stat Dashboard, Rate Tables). Landing on `dashboard.html`,
  `quote-portal.html`, `factors.html`, etc. in admin mode **silently redirects to
  `tenants.html`** — no error, just the wrong page loaded, and any page-local `const`/function
  (`S`, `paint()`, `calc()`, ...) will throw `ReferenceError: ... is not defined` if you try to
  poke it, because you're not even on that page.
- Fix: before testing a tenant-workspace page, run
  `localStorage.setItem("vxWorkspaceMode","tenant")` (a stub/no active tenant is fine for most
  static content) then navigate.
- To log into a *specific* real tenant: `vxLoginToTenant(tenantId)` (sets active tenant +
  workspace mode + navigates) beats trying to click through the real tenant picker UI.

## Form field wiring pattern

Generic form fields use `class="... F"` + `data-k="fieldName"`, wired via **`onchange`**, not
`oninput` — `document.querySelectorAll(".F").forEach(e => e.onchange = ...)` in `core.js`. If
you set `.value` via CDP and want the page's state object to pick it up, dispatch a `change`
event, not `input`:
```js
el.value = 'x'; el.dispatchEvent(new Event('change', {bubbles:true}));
```

## Tooltip dictionary is a flat string-keyed map — watch renames

`assets/js/tooltip-dictionary.js` keys tooltips by the **exact rendered `<th>`/label text**
(see its own header comment). If two different columns on two different pages end up with the
literal same header text (e.g. both renamed to plain "Coverage"), they **silently share one
tooltip entry** — whichever definition is in the dictionary applies to both, even if it's only
accurate for one of them. `tests/audit-tooltips.js` only checks that every rendered header
string has *some* dictionary entry (0 missing) — it does **not** check the content is
contextually correct. This has to be checked visually/by reading the dictionary entry against
each page it now applies to; it won't show up as a test failure.

## Useful smoke checks

- `node tests/rating-determinism.test.js` — premiums byte-identical, fast regression net for
  anything touching `engine.js` or `data.js`.
- `node tests/framework-compliance.test.js` — structural/CSS conventions across all pages.
- `node tests/static-integrity.test.js` — every inline script parses, every cross-file
  reference (ids, keys) resolves.
- `node tests/audit-tooltips.js` — every rendered `<th>`/label has a tooltip-dictionary entry
  (presence only, not correctness — see above).

None of these substitute for actually loading the page.
