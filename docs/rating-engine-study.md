# Rating engine folder study

Review date: 2026-09-08. Input: supplied Carrier/MGU context plus this folder.

Folder has a working browser prototype. Six calculators work. Admin screens, factor editing, formulas, versions and quote traces already exist. Keep that work. Main gap: a version label is not a complete, frozen rating package.

This review checks implementation. It does not certify filed rates, tax law, ISO licensing or the source workbooks. The folder references workbooks and backend SQL that are not included. Claims of source verification in existing comments remain claims from the prior implementation.

## Folder map

| Area | Files | What runs today |
|---|---|---|
| App shell | `index.html`, `dashboard.html`, `assets/js/core.js`, `assets/css/app.css` | Static pages, navigation, tenant/user switching, browser persistence, sample sign-in |
| Data | `assets/js/data.js`, `rate-data-full.js`, `rate-tables-registry.js` | Seed configuration, sample volume data, embedded reference tables, partial dated rows |
| Rating | `assets/js/engine.js` | Trucking, GL, property, MPL, cyber and WC calculators; shared charges; formula evaluation; traces |
| Underwriting | `assets/js/eligibility.js` | Registered eligibility conditions, declines, referrals, unevaluable rules |
| Configuration | Products, coverages, LOB, units, factors, lookup tables, formula builder, versions | Real browser edits mixed with reference and illustrative content |
| Price components | Base rates, rate tables, discounts, surcharges, fees, premium rules | Config views; engine wiring varies by component |
| Geography | States, counties, ZIP codes, territories, taxes, county taxes | Reference/configuration views and some direct rating inputs |
| Quote surfaces | `quote-portal.html`, `quote-json.html`, `quotes.html` | Interactive quoting, AMS-shape adapter, JSON results, sample quote records |
| Platform model | `cosmos-model.js`, `data-model.dbml`, `schema-data.js`, `db-schema.html` | Document model and in-memory facade; no live database |
| Integrations | `api.html`, `integration.html`, `export.html`, `sample-imports/` | Contracts, local examples, export/import paths; no hosted REST service |
| Operations | Tenants, users, roles, tenant setup, settings, audit | Browser admin model; not server-enforced authentication or authority |
| Analysis | Analytics, loss runs, AI assistant, config health | Local/sample summaries; not a trained underwriting service |
| Prior design notes | `rating-factor-values-business.md`, `rating-factor-values-technical.md` | Earlier factor-editor design. Later code now adds approvals/history and some runtime factor wiring |
| Tests | `tests/` | Premium regression, theme compliance, tooltips, plus new context and static-integrity checks |

41 HTML pages. Plain JavaScript. No package manifest, build pipeline, backend or repository history supplied. External CSS/fonts/grid libraries come from CDNs. Local storage is the persistence boundary.

## Supplied context mapped to existing work

| Requested capability | Existing implementation | Gap / action |
|---|---|---|
| ISO content ingestion | Embedded tables and product/lookup import tools | No licensed ISO feed/circular ingestion, source checksum, import reconciliation or forms repository |
| ISO effective dates | `VX.tableAsOf`, transaction date resolution, some trucking table windows | Not every table/factor resolves by date; no immutable package ties all rows to one filing |
| Class/territory/symbol crosswalks | Trucking class resolution, territory and ZIP reference data, application-type adapters | No general versioned ISO-to-internal crosswalk entity with validation and rejects |
| Carrier LCM | Existing calculators have LCM terms | Shared parameter data; not a complete carrier/program/state LCM hierarchy |
| Manual selection | Product versions, transaction pins, filing labels | Formula attachment selection now enforced; a chosen label still does not freeze all rate data |
| ISO rules | Limit/deductible factors, experience/schedule terms, minimums | Line-specific approximations remain. No complete ISO manual interpreter |
| Program identity | Products, tenants, LOB, app type, versions | Tenant is not a separate writing-carrier/delegated-MGU relationship. No full program authority model |
| Proprietary rating | Custom saved formulas and custom factor bridge | No generic execution of arbitrary program algorithms. Cyber has no saved-formula hook |
| Segmentation | Coverage-specific risk factors | Admin lookup bridge averages rows; it does not generically look up each risk's matching key |
| Eligibility/appetite/referral | Registered rules in `eligibility.js` | Engine now returns same evaluation to every caller. Unknown rules require review. Free-text rules do not execute |
| Override hierarchy | Tenant configuration, product paper, version pins | Global → state → carrier → broker precedence is not modeled as a complete hierarchy |
| Premium rollup | Per-vehicle trucking; WC exposure schedule; shared charge assembly | Some location schedules are captured but not fully rated; do not call this complete multi-location pricing |
| Fees/taxes/commission | Fixed/percentage fees, taxable-fee basis, state/county tax | No complete commission accounting stage. Tax data is not certified by this review |
| Versioned algorithm steps | Token formulas, attachments, calculation trace | Formula history is authoring history, not approved historical execution snapshots |
| Governance | Draft/publish UI, approvals, audit records, local tests | No CI/CD deployment gate, immutable audit store, server authorization or production UAT service |
| Stateless rating service | Synchronous `ENGINE.rate(lobCode, input)` | Runs in browser against mutable `VX`. No network service or isolated immutable request snapshot |

## Changes applied

1. **Formula selection follows product and version.** When input names a product, active formulas must be unattached defaults or attached to that product and selected version. Optional formula `states`, `effectiveStart`, `effectiveEnd` restrict selection. Existing calls without product keep the sandbox route. Multiple applicable formulas return a visible failure and built-in fallback instead of choosing array order.
2. **One request tenant.** `input.tenantId` takes priority over browser tenant for engine-owned formulas, custom factors, lookup tables, price adjustments, fees, products and versions. Shared records remain available. Tenant context restores even if calculation throws. This is configuration scoping, not authentication.
3. **Formula saves retain ownership.** Formula Builder keeps the existing tenant ID, or assigns active tenant for a new formula. Previously an edited record could lose that field.
4. **Engine returns underwriting results.** Existing rule module stays separate, but `ENGINE.rate` calls it before pricing. Portal and JSON view use the returned evaluation. API example now loads the rule module too.
5. **Unknown rules do not imply approval.** Decision is `decline`, `refer`, `approve` or `not_evaluated`. Missing rule module returns `not_evaluated`; unknown rules and formula failures require referral. A calculation can still return indicative premium for a declined risk. Existing portal decline gate remains.
6. **Execution basis is explicit.** Added `ratingBasis` says which tenant/product and execution mode were used, distinguishes shared rate data from version/formula attachment selection, and states `immutableSnapshot: false`.
7. **Formula tokens are validated before evaluation.** Only supported arithmetic/functions, numeric literals and finite numeric variables enter the evaluator. Executable free text is rejected. Malformed token arrays produce a visible fallback rather than breaking the fallback handler.
8. **Configuration health is corrected.** Removed obsolete claim that only the first two discounts and first surcharge apply. Current engine evaluates conditions for all matching rows.
9. **Product and flow copy is corrected.** Custom calculator is distinguished from proprietary rate content. Admitted paper is acknowledged. Flow no longer claims every table is effective-dated or that engine produces no premium on a decline. Added ISO/program explanation on Engine Flow.
10. **Existing tooltip failure fixed.** Added missing “Created by” entry.

No seed version bump. No rate-table replacement. No storage reset introduced. No new rates, regulatory rules or LCMs invented.

## Runtime contract

```javascript
// Load data.js, engine.js and eligibility.js before making a call.
const result = ENGINE.rate("GL", {
  state: "TX",
  product: "Standard GL Program",
  tenantId: 1,
  policyType: "New Business",
  effectiveDate: "2026-09-01",
  revenue: 2500000,
  classCode: "238160",
  limit: 1000000,
  products: false,
  schedMod: 0,
  expMod: 1
});
// Existing premium/group/trace fields remain.
// result.eligibility: declines, refers, notEvaluable
// result.underwriting: decision, complete, premiumIsIndicative
// result.ratingBasis: tenantId, product, execution, versionSelection,
//                     rateData, immutableSnapshot
```

`approve` means configured evaluable checks passed. It is not bind authority or production certification. `complete` refers to those configured checks and formula failures, not completeness of ISO content or underwriting data. Every returned premium is marked indicative.

Dates keep the existing convention: inclusive start/end; explicit `asOf` wins, then endorsement original effective date, then earlier rate lock, then effective date, then fixed platform reference date. Transaction pins retain the prior behavior, including a warning for unpublished pins. Do not infer that a pinned draft is approved production content.

Owned formulas take precedence over shared defaults. Two candidates at the same ownership level are treated as a conflict. There is no invented broker/carrier specificity ranking. A product-specific call with no matching saved formula runs the existing built-in chain. The trace shows that mode.

No-product calls remain useful for the existing sandbox. They do not prove a unique program was selected. Pass product and tenant for scoped integration tests.

## Important remaining limits

**Historical replay.** Version records and token history alone cannot reproduce a policy if shared lookup rows, LCM constants or active tokens change. Need a frozen package, selected row IDs and content hashes. Do not start executing authoring history as though each edit was separately approved.

**Rate-source evidence.** Trucking comments describe workbook verification and subsequent SQL differences. Referenced files are absent here. Cargo, WC and other approximations must retain their existing disclosures until approved source material is supplied. “ISO-based” is a content lineage claim, not a synonym for “custom” app type.

**Lookup safety.** Several built-in lookups fall back to a default or first row. Custom lookup bridge uses average values. A full program engine must make missing/multiple matches explicit and evaluate real input keys. Changing those defaults now would change existing premiums; that needs source-backed expected outputs.

**Minimum and tax order.** Shared assembly currently adds fees and tax, then applies policy minimum. WC also applies its coverage minimum earlier. The supplied generic sequence does not establish each product's approved order or taxable basis. Keep existing arithmetic until product-specific expected cases settle it.

**Multi-location rating.** Property/GL/MPL schedules are not proof that every location/class is priced. Need per-location/per-exposure calculation and rollup rules, including whether minimums and fees apply once or per item.

**Tenant boundary.** Engine scoping improved, but browser code is not a security boundary. Some admin helpers still find records by name or ID without full tenant qualification. An external caller cannot be trusted to choose an arbitrary `tenantId`; future service must derive authorized tenant from authenticated identity.

**Storage and governance.** Existing `data.js` version migration uses `localStorage.clear()` when its stamp differs. This predates this work and remains unchanged; it can erase same-origin drafts. Replace with explicit key migrations and backups before a future seed-version bump. Audit/publish state lives in a browser, so immutable governance cannot be claimed.

**Eligibility completeness.** Some rules have no inputs; some use proxies and boolean assumptions. Program identity, carrier authority, state appetite and required-field validation are not a complete pre-rating gate. Missing module and unknown rules are now exposed, but omitted risk fields can still fall through existing conditions.

**Binding and APIs.** API page is a contract/demo. There is no server. Decline issuance check exists in portal; full referral approval, authority enforcement, idempotency and signed immutable quote evidence do not.

## Target design, built on current entities

Keep Products, Versions, Factor Values, Lookup Tables and Formula Builder. Add links and invariants rather than another parallel rating UI.

| Entity | Required fields and rule |
|---|---|
| Content package | Source (`ISO` / program), manual/circular ID, version, checksum, licensed source reference, import validation; preserve original content |
| Crosswalk set | Package ID, external code, internal code, kind, LOB/state, effective window; reject gaps and duplicate active mappings |
| Program version | Stable program ID, tenant, writing carrier, LOB, states, dates, methodology (`ISO`, `ISO-plus`, `Proprietary`), approved algorithm ID |
| Algorithm snapshot | Immutable token/step list, typed inputs, version, approved factor/table IDs, rounding and minimum policy, output schema |
| Override set | Explicit layer, scope, dates, authority, reason; deterministic ordering and duplicate conflict checks |
| Rule set | Typed conditions, phase (pre/in/post), severity, missing-input behavior, scope and effective dates |
| Quote evidence | Input snapshot, chosen program/algorithm/package IDs, table row IDs, per-step arithmetic, decisions, charges and content hash |
| Release evidence | Author/reviewer identities, reason, regression/UAT report, approval and deployment record; no in-place mutation of published snapshot |

Target execution: validate request → authorize tenant/carrier/program → select eligible dated program → resolve content/crosswalks → eligibility → coverage/location/exposure steps → overlays → configured fees/taxes/minimum/rounding → post-rating referral → evidence. A declined risk must not become a bindable quote.

Build order:

1. Establish approved reference cases and source content per line. Freeze current regression baselines.
2. Add immutable snapshots behind existing Versions. Keep old requests replayable.
3. Add explicit program/carrier/state scope and ISO lineage. Reject ambiguous selection.
4. Replace average/default lookup behavior with typed input mappings, verified per table.
5. Complete multi-location rollup, program rule phases, commission/charge ordering and missing-input checks.
6. Move the same execution contract behind a server with tenant authorization and persisted evidence. Add approval/release gates and load tests.

## Verification

Before changes: existing rating and framework suites passed; tooltip audit failed on one “Created by” header.

Reference premiums retained: TRUCK 10,717; GL 51,975; PROP 19,010; MPL 3,026; CYBER 5,830; WC 61,178. These are regression fixtures, not market quotes.

Run from folder root:

```sh
node tests/rating-determinism.test.js
node tests/rating-context.test.js
node tests/framework-compliance.test.js
node tests/audit-tooltips.js
node tests/static-integrity.test.js
```

New context checks cover product/version routing, endorsement dates, explicit tenant isolation, conflict fallback, state/date scope, malformed formulas, underwriting outcomes, missing rule module, failure cleanup, executable-token rejection and custom-factor isolation. Static checks compile JS and inline page scripts, and check local file references. These checks do not certify every persisted browser configuration or production behavior.

Browser smoke checks: Engine Flow rendered the ISO/program explanation; Quote JSON generated the GL sample at 51,975 with underwriting and rating-basis fields; Formula Builder opened and evaluated its existing Auto Liability template at 2635.9674; Quote Portal loaded. No browser console errors observed during these checks. No live formula was saved or published.
