/* Veridex Rating Engine — column-tooltip dictionary
 * Maps every column header used in Rating Engine tables to a concise,
 * ERP-insurance definition suitable for an actuary, product manager or
 * underwriting user. The key is the raw <th> textContent (trimmed).
 * Values are objects: { d: definition, w: why it matters, e?: example }
 * A plain string is also accepted and treated as {d: <string>}.
 */
(function () {
  const D = {
    /* dashboard.html — Activity log */
    "Time":           { d: "Wall-clock timestamp when the event was recorded in the audit log.", w: "All Rating Engine writes are immutable; this column is the primary key for any forensic or SOX inquiry." },
    "User":           { d: "Tenant user (or service principal) that performed the action.", w: "Pairs with Version and Action to form the full attribution triple required by ACORD-aligned audit exports." },
    "Area":           { d: "Subsystem of the Rating Engine that was touched (Factors, Rate Tables, Versions, Formulas, Tenants).", w: "Lets compliance officers filter activity to a single concern without reviewing the whole tenant log." },
    "Action":         { d: "Verb describing the change: Create, Update, Publish, Rollback, Deprecate, Import.", w: "Standardised vocabulary so SIEM rules and approval workflows can pattern-match safely." },

    /* factors.html */
    "Factor":         { d: "A named rating variable (e.g. driver_age, territory, class_code) consumed by the rating pipeline.", w: "Factors are the atomic inputs of premium calculation; their catalog is versioned and audited." },
    "Change":         { d: "Magnitude and direction of the value change vs. the previously published version (e.g. +0.05, -10%).", w: "Helps reviewers quantify expected premium impact before approval and release." },
    "Effective from": { d: "Calendar date on which this factor version becomes authoritative for new quotes.", w: "Endorsements rate on the version effective at transaction date, not at bind date." },
    "Requested by":   { d: "Actuarial or product user who authored the change request.", w: "Required for the two-person rule before publishing to production." },
    "Reason":         { d: "Free-text business justification captured for the audit trail.", w: "Surfaced in version diffs and regulator-facing change reports." },
    "Value":          { d: "Numeric multiplier or flat amount contributed by this factor row.", w: "The atomic unit of premium impact; bound by Min/Max to prevent misrating on extreme inputs." },
    "In force":       { d: "Count of in-force policies currently rating against this factor value.", w: "Used by change-management to gauge migration risk before republishing." },
    "Approved by":    { d: "Tenant role that signed off on the value (typically Rating Manager or Chief Actuary).", w: "Satisfies the four-eyes principle for rate filings." },
    "Row":            { d: "Index of the row inside the table editor; not the persisted key.", w: "Display-only helper for navigating large lookup tables." },
    "Value / Range":  { d: "The number this row writes back on save — a single value, or two bounds edited together when the row is a From/To or Min/Max band.", w: "A band shows as one Range control so its two bounds are edited together instead of as two disconnected numbers." },
    "Category":       { d: "Coarse grouping of a factor — Driver, Vehicle, Territory, Coverage, Experience, Discount, Surcharge.", w: "Drives the left-rail taxonomy and eligibility checks." },
    "From":           { d: "Value carried by the prior published version.", w: "Paired with To to render the side-by-side diff." },
    "To":             { d: "Value proposed by this version.", w: "Paired with From to render the side-by-side diff." },
    "Why":            { d: "Plain-English rationale for the change supplied by the author.", w: "Mandatory for any factor with material premium impact (>2.5%)." },
    "Source sheet":   { d: "Worksheet inside the legacy workbook this factor was migrated from.", w: "Used during the legacy decommission phase to trace any residual rating gap." },
    "Values":         { d: "Number of distinct key combinations in this factor table.", w: "Indicator of table breadth and validation surface area." },
    "State":          { d: "Lifecycle status: Draft, In Review, Approved, Published, Deprecated, Retired.", w: "Only Published and Deprecated values feed new quotes; the rest are excluded by the engine." },

    /* rate-tables.html */
    "Rating Table":   { d: "A keyed lookup (e.g. territory × class → base rate) consumed by the rating pipeline.", w: "The engine evaluates one or more tables per quote in declared precedence order." },
    "Rows":           { d: "Number of keyed rows currently defined in the table.", w: "Used by capacity heuristics and by the index advisor when planning index rebuilds." },
    "Drives / why not": { d: "Plain-language explanation of which LOBs and inputs consume this table, or why it is currently unused.", w: "Prevents orphaned tables from silently skewing rate filings." },
    "Input Field":    { d: "Quote-screen input that drives the lookup key (Territory, Class, Vehicle Type).", w: "Lets the data team audit which inputs are still authoritative." },
    "Consequence":    { d: "Downstream rating impact when this input is missing or stale.", w: "Used by configuration health scoring." },

    /* versions.html */
    "Capability":     { d: "A logical group of endpoints or features in the version (e.g. Quote, Endorse, Renew).", w: "The Capability matrix is the contract between Rating Engine and the consuming channels." },
    "Real endpoints": { d: "Count of production REST endpoints this capability exposes on this version.", w: "Used for change-impact sizing and for the API deprecation dashboard." },
    "Note":           { d: "Free-text annotation, surfaced in the version changelog.", w: "Visible to all tenant admins; do not include secrets or PII." },
    "Component":      { d: "Discrete scoring element within the rating pipeline (base rate, factor, fee, tax, surcharge).", w: "Each component is independently auditable and version-pinned." },
    "Driven by":      { d: "Input variable or upstream table that produces this component.", w: "Drives the trace view used by underwriters to explain any quote." },
    "Range":          { d: "Numeric range the component is constrained to during calculation.", w: "Bounded ranges protect against misrating on out-of-distribution inputs." },
    "Source":         { d: "Origin of the value — factor table, formula, hard-coded default, or external service.", w: "Critical for regulatory traceability." },
    "Formula":        { d: "Premium-formula identifier attached to this version.", w: "A version may carry multiple formulas (one per LOB); each is independently testable." },
    "Expression":     { d: "The literal formula source, written in the Veridex expression DSL.", w: "Syntax-validated at publish time and unit-tested against the regression corpus." },
    "Tested":         { d: "Pass/fail summary of the regression suite run against this formula.", w: "Blocks promotion until the suite is green." },
    "Product":        { d: "LOB under which this version is in effect.", w: "Versions are pinned per product, so a single tenant may run several concurrently." },
    "Version":        { d: "Immutable, dated snapshot of all rating inputs (factors, tables, formulas, fees) effective from its Effective date.", w: "Endorsements rate on the version effective at transaction date — the cornerstone of rating reproducibility." },
    "Now":            { d: "The currently authoritative value in production.", w: "Captured at diff time so reviewers see the live gap." },
    "Becomes":        { d: "The value that will apply once this version publishes.", w: "Used in pre-flight impact simulations." },

    /* quote-json.html */
    "Ours":           { d: "Result computed by the in-app Veridex engine for this factor, shown for parity testing.", w: "When Ours ≠ Payload, the consuming channel may be quoting off a stale cache." },
    "Payload":        { d: "Value reported by the upstream system (AMS, portal, broker) inside the inbound quote request.", w: "Used to validate the integration contract end-to-end." },
    "Credit / debit": { d: "Signed premium adjustment contributed by this component — positive = debit, negative = credit.", w: "The rollup across this column equals the total premium delta from base." },
    "Answer":         { d: "The raw input value provided by the applicant or broker.", w: "The starting point of the rating trace; normalised before lookup." },
    "Matched":        { d: "Identifier of the rule or row that fired for this factor.", w: "Lets underwriters answer 'why this price?' by clicking the row." },

    /* loss-runs.html */
    "State / Province": { d: "Jurisdiction code for the geographic rollup.", w: "Used to enforce per-state rate-filing boundaries and reporting cadences." },
    "Primary LOB":    { d: "Line of business that drives the bulk of premium and losses for this segment.", w: "Used to route the experience mod to the correct actuarial team." },
    "Quotes":         { d: "Count of bound + non-bound quotes in the selected period.", w: "Exposure base for loss-ratio calculations." },
    "Loss Ratio vs Target": { d: "Actual loss ratio divided by the filed target loss ratio, expressed as a percentage.", w: "Above 100% signals a portfolio drift that should trigger a rate review." },
    "Trend":          { d: "Direction (up/down/flat) of the loss ratio across the last four periods.", w: "Quick visual cue for portfolio health." },
    "County":         { d: "County or parish subdivision used by territory rating.", w: "Finer-grained than state; required for some states (FL, NY, PA)." },
    "When":           { d: "Effective date of the factor change that drove this event.", w: "Pairs with Reason for full change attribution." },
    "Who":            { d: "User who initiated the change.", w: "Required for SOX attribution." },
    "Status":         { d: "Lifecycle state — Draft, Pending Approval, Approved, Rejected.", w: "Only Approved changes propagate to a new version." },

    /* analytics.html */
    "Agency":         { d: "Producing agency or broker organisation.", w: "Used to compute agent-level performance and override patterns." },
    "Quotes":         { d: "Number of quotes produced in the selected window.", w: "Denominator for Bind Rate." },
    "Bound":          { d: "Number of quotes that resulted in a bound policy.", w: "Numerator for Bind Rate; primary commercial KPI." },
    "Bind Rate":      { d: "Bound ÷ Quotes, expressed as a percentage.", w: "Direct measure of producer effectiveness; >25% is typical for digital channels." },
    "Premium":        { d: "Total bound written premium in the selected window.", w: "Tied to revenue recognition and to carrier statements." },
    "LOB":            { d: "Line of business the factor belongs to (Trucking, GL, Property, MPL, Cyber).", w: "Drives segmentation in every analytics view." },
    "Impact":         { d: "Average change in premium attributable to this factor across all filtered quotes.", w: "Drives the factor-impact prioritisation backlog." },

    /* ai-assistant.html */
    "Attribute":      { d: "The rating input the assistant proposes to change.", w: "Restrict edits to one attribute per proposal so review remains atomic." },
    "Current":        { d: "Existing authoritative value.", w: "Baseline against which the proposal is evaluated." },
    "Proposed":       { d: "Suggested value the assistant would set.", w: "Carries an evidence trail back to the source data." },

    /* glossary.html */
    "Variable":       { d: "Token available inside the formula DSL.", w: "Mirrors the left rail of the formula builder; click-through for examples." },
    "Meaning":        { d: "Plain-English definition of the variable.", w: "The dictionary this tooltip module is itself sourced from." },
    "Used in":        { d: "List of built-in functions or formulas that consume the variable.", w: "Helps authors discover reusable building blocks." },

    "When the answer is…": { d: "The rule fires when the applicant's input matches this value (exact, range, or list, depending on rule type).", w: "Branch rows inside the formula builder produce distinct debits/credits per answer." },
    "Factor applied": { d: "The factor value contributed by this branch row.", w: "Summed across all branch rows must equal the factor's expected weight." },
    "Applied": { d: "The factor value that the engine actually used on this quote.", w: "Compare against Default to spot inputs the agent changed on the quote screen." },
    "Default": { d: "The factor value that would apply when no input is provided.", w: "Used by quote-screen placeholders and by regression tests for the empty-input case." },
    "Effect": { d: "Direction and magnitude of the rating effect — multiplier, credit or debit.", w: "Drives the inline rating preview and the factor-impact analytics." },
    "Earned Premium": { d: "Portion of written premium that has been earned against the exposure period.", w: "Used as the denominator in the loss-ratio calculation alongside Incurred Losses." },
    "Incurred Losses": { d: "Paid losses plus case reserves for the selected scope and period.", w: "Numerator of the loss ratio; compared to the filed target to drive rate actions." },

    /* Cross-page generic headers */
    "Status":         { d: "Lifecycle state of the row.", w: "Drives filtering and workflow gating across every table in the Rating Engine." },
    "Scope":          { d: "Applicability of the entry — tenant-wide, product, state, or class.", w: "Used by the engine to decide whether a row is eligible for the current quote." },
    "Effective":      { d: "Date the version becomes authoritative.", w: "Only quotes with effective_date ≤ today and (no expires OR expires > today) rate against this row." },
    "Expires":        { d: "Date after which the version stops being applied to new quotes.", w: "In-force policies continue on the version that was effective at transaction date." },
    "Type":           { d: "Calculation kind: Multiplier, Flat Amount, Tiered Lookup.", w: "Determines how the value participates in the composite premium." },
    "Weight":         { d: "Relative influence in the composite premium (used in factor-impact analytics).", w: "Not applied to the rating math itself, only to reporting." },
    "Min / Max":      { d: "Hard bounds applied to a factor's output.", w: "Prevents misrating on extreme inputs and stabilises the quote envelope." },
    "Min Premium":    { d: "Floor applied to the total premium after factors and fees.", w: "Prevents underpricing of low-exposure risks." },
    "Max Premium":    { d: "Ceiling applied to the total premium.", w: "Used for regulatory caps and reinsurance thresholds." },
    "Key":            { d: "Composite input columns that identify a row in a lookup table.", w: "Together they form the uniqueness constraint of the table." },
    "Sub-key":        { d: "Second-level key inside a nested lookup (e.g. limit tier inside a (state, coverage) row).", w: "Used for two-dimensional tables such as Increased Limits Factors." },
    "Records":        { d: "Whether the table's rows have actually been extracted from the source workbook and loaded into the engine.", w: "Inventory tables record the table's existence and size; only Loaded records can be browsed or rated against." },
    "Loaded":         { d: "The table's rows have been extracted and are available for browsing and rating.", w: "Required for any table to participate in quote calculations." },
    "Not loaded":     { d: "The table is sized in the inventory but its rows haven't been extracted from the source workbook yet.", w: "Inventory-only — the table cannot rate quotes until the rows are loaded." },
    "Lookup Table":   { d: "A keyed reference table (e.g. ZIP \u2192 territory, loss-cost by state/class) consumed by the rating pipeline.", w: "Each lookup is versioned and bound to the LOB it supports; only Loaded lookups are active in rating." },
    "Rate":           { d: "Base premium contribution returned when this row is matched.", w: "Multiplied by the relevant exposure basis to produce the base premium." },
    "Parent":         { d: "The version this one was branched from.", w: "Used for diffs, rollback and ancestry reporting." },
    "Author":         { d: "Tenant user who published this version.", w: "Required for audit attribution." },
    "Saved by":       { d: "Tenant user who saved this revision of the formula.", w: "Pairs with In force to answer who changed a calculation and when." },
    "Published":      { d: "Timestamp the version transitioned to Published.", w: "Immutable after publish; rollback creates a new version instead." },
    "Rollback":       { d: "Action that retires a published version and re-rates in-flight quotes on the prior version.", w: "Audit-logged; only available to Rating Manager." },
    "Bound Premium":  { d: "Final premium written to the policy at bind time.", w: "Source of truth for downstream financial systems." },
    "Indicated":      { d: "Indicative premium shown to the agent before binding — not authoritative.", w: "Refreshed each time a rating input changes." },
    "Surcharge":      { d: "Additional charge applied for elevated risk characteristics.", w: "Applied after base and factor premium, before taxes." },
    "Credit":         { d: "Negative factor that reduces premium (e.g. multi-policy discount).", w: "Modeled as a negative debit'same as a surcharge in reverse." },
    "Loss Date":      { d: "Date of the loss occurrence feeding experience rating.", w: "Used by the experience mod to weight claims by year." },
    "Paid":           { d: "Cumulative loss amount paid to date on this claim.", w: "Component of Incurred." },
    "Reserve":        { d: "Actuary-set estimate of remaining liability on this claim.", w: "Component of Incurred." },
    "Incurred":       { d: "Paid + Reserve — the total amount charged against this policy period for experience mods.", w: "The input to schedule P and to experience rating." },
    "Cat Code":       { d: "ISO catastrophe classification code.", w: "Required for reinsurance bordereaux." },

    /* factors.html — main grid headers not already covered above */
    "Rating Factor":  { d: "The factor's display name, written as an underwriter would say it (e.g. \"Radius of Operation Factor\").", w: "Shown in the rating trace on a quote, so it is what an underwriter sees when explaining a price." },
    "Line of Business": { d: "The line whose engine reads this factor (Commercial Trucking, General Liability, Cyber, etc.).", w: "Factors are LOB-scoped; a factor never applies outside the line it is registered against." },
    "Values / Rules": { d: "How many distinct outcomes this factor can produce — a lookup factor's row count, or 1 for a fixed value.", w: "A quick read on how much of the factor's behaviour lives in a table versus a single number." },
    "Coverage":       { d: "The coverage this factor prices — its position in the Factor → Assigned To chain.", w: "Distinct from Scope: Coverage is WHAT the factor prices, Scope is WHAT it varies by." },
    "Coverage Type":  { d: "Which specific coverage within the policy this row's limit applies to (e.g. per-person vs. per-accident).", w: "The same limit menu can list several coverage types that are not interchangeable." },
    "Code":           { d: "Short, stable identifier for this row — a factor code, class code, NAICS code, or similar filed identifier.", w: "Used in exports, the change log and filed manuals; should not be renamed once quotes have used it." },
    "Approval":       { d: "Whether a requested change to this factor's value is waiting on a second person to sign off.", w: "A pending change never applies on its own; the registry keeps showing the value currently in force until someone else approves it." },
    "Last edited by": { d: "The user who most recently saved a change to this factor's descriptive fields or value.", w: "Answers \"who touched this?\" from the row itself, without a trip to the audit trail." },

    /* rate-tables-registry.js — real column names shown on Rate Tables and
       in Rating Factors' Open Factor Details / Edit values (the same
       registry backs both). Adjacent From/To or Min/Max pairs collapse
       into one Range column in Rating Factors; Rate Tables itself still
       shows each bound as its own column, so both forms are documented. */
    "Points":         { d: "Motor-vehicle-record points assigned to the driver for the violations and accidents on file.", w: "Points, not raw violation counts, is what the Driver Class table is actually keyed by." },
    "Points From":    { d: "Lower bound (inclusive) of the points band this factor row applies to.", w: "Paired with Points To — a driver's point total is matched to exactly one band." },
    "Points To":      { d: "Upper bound of the points band this factor row applies to.", w: "Paired with Points From to define the band." },
    "Points Range":   { d: "The points band this row applies to, shown as one span instead of two separate bounds.", w: "A driver's point total is matched to exactly one band; showing it as a range avoids having to mentally recombine two numbers." },
    "Driver Age":     { d: "Age of the individual driver being rated, in whole years.", w: "Crossed with Points to select the Driver Class Factor row." },
    "Age":            { d: "Age used to select this row — a driver's age or a vehicle's model-year age, depending on the table.", w: "Always paired with a factor column; the age alone carries no premium impact." },
    "Model Year":     { d: "The vehicle's model year as declared on the application.", w: "Converted to a vehicle Age band before the Vehicle Age Factor is looked up." },
    "Vehicle Type":   { d: "The vehicle-type bucket used to select this row (e.g. tractor, straight truck, trailer).", w: "The same answer can drive several different tables — OCN, Miles, Trailer PhysDam — each keyed on it differently." },
    "Class":          { d: "The rating class or classification code this row applies to.", w: "Classes group risks with similar expected loss experience." },
    "Class Code":     { d: "The filed classification code (ISO, NCCI, or program-specific) identifying this rating class.", w: "The primary key underwriters and auditors use to locate a class in the filed manual." },
    "Classification": { d: "Plain-English description of the class code in the row next to it.", w: "Lets a reader confirm they matched the right code without looking it up elsewhere." },
    "Description":    { d: "Plain-English label for the code in this row.", w: "Codes alone are not self-explanatory; this is what a human reads instead." },
    "Territory":      { d: "The rating territory this row applies to, resolved from the risk's ZIP code.", w: "Territory — not raw ZIP — is what the Base Loss Cost and related tables are keyed by." },
    "Liability Limit": { d: "The Bodily Injury / Property Damage liability limit this row's factor applies to.", w: "Higher limits carry a higher Increased Limits Factor, since more capacity is exposed to loss." },
    "Each Occurrence Limit": { d: "The General Liability per-occurrence limit this row's factor applies to.", w: "Drives the GL Increased Limits Factor the same way Liability Limit drives Trucking's ILF." },
    "Per-Claim Limit": { d: "The MPL per-claim limit this row's factor applies to.", w: "MPL is claims-made, so limit adequacy is judged per claim rather than per occurrence." },
    "Aggregate Limit": { d: "The Cyber policy's aggregate limit across all claims in the period.", w: "Distinct from a per-claim limit — this caps total exposure for the whole period." },
    "Limit":          { d: "The coverage limit this row's factor or rate applies to.", w: "Limit selection is one of the largest single drivers of increased-limits pricing." },
    "Max Limit":      { d: "The highest limit offered for this coverage in this state.", w: "A quote requesting more than this is not ratable on the row shown." },
    "ILTA Column":    { d: "Which column of the filed ILF exhibit this row was extracted from — a filed-table cross-reference, not a rating input.", w: "Lets an actuary trace a factor back to its exact cell in the source exhibit." },
    "Loss Cost":      { d: "Filed base loss cost — the expected-loss component of premium before factors are applied.", w: "The starting point every other liability factor multiplies against." },
    "Base Loss Cost": { d: "The territory's filed base loss cost before any rating factor is applied.", w: "The anchor value the whole liability rating chain builds on." },
    "Stated Value":   { d: "The value the insured declared for the vehicle or item being covered.", w: "Drives both the physical damage rate and, on some tables, the OCN liability factor." },
    "Rate per $ of Value": { d: "Physical damage rate expressed per dollar of stated value rather than as a flat number.", w: "Multiplied directly by Stated Value to get the physical damage premium." },
    "Deductible":     { d: "The dollar deductible this row's factor applies to.", w: "Higher deductibles generally carry a credit; the exact curve is filed per coverage." },
    "Deductible Type": { d: "Which coverage or peril the deductible in this row applies to (e.g. Comprehensive, Collision).", w: "The same dollar deductible can carry a different factor depending on which peril it protects." },
    "Amount":         { d: "The dollar amount — a deductible, a limit, or a threshold — this row's factor applies to.", w: "The specific meaning depends on the table; check the table name and Drives column." },
    "Radius Category": { d: "Which radius-of-operation band (Local, Intermediate, Long-Haul, etc.) this row belongs to.", w: "Radius is one of the strongest rating variables in trucking — it also gates which Miles Driven row applies." },
    "Radius Label":   { d: "Plain-English description of the radius band shown next to it.", w: "Underwriters read the label; the engine reads the category code." },
    "Distance":       { d: "The mileage range this radius category represents.", w: "Ties the plain-English radius label back to an actual mile count." },
    "Annual Miles":   { d: "Declared annual mileage band for the vehicle.", w: "Combined with Radius Category — the same mileage rates differently on a long-haul fleet than a local one." },
    "Commodity / Operation": { d: "The commodity hauled or operation performed, used to select the Rating Class Factor.", w: "Hauling hazardous or high-value freight carries a materially different factor than general freight." },
    "Dashcam Status": { d: "Whether the fleet has dashcams installed, and of what kind.", w: "A filed credit for verified dashcam coverage — an unconfirmed answer does not qualify." },
    "NAICS Code":     { d: "The insured's North American Industry Classification System code.", w: "Used to select the NAICS Industry Factor and to route eligibility checks." },
    "Industry":       { d: "Plain-English industry description for the NAICS or class code in this row.", w: "Lets a reader confirm the right code without a separate NAICS lookup." },
    "Construction Type": { d: "ISO-style building construction classification (frame, joisted masonry, fire-resistive, etc.).", w: "One of the largest drivers of property rate — construction type governs fire spread and collapse risk." },
    "PPC":            { d: "ISO Public Protection Classification — a 1–10 score for the local fire department's response capability.", w: "A better-protected territory (lower PPC) earns a credit on fire-related coverages." },
    "Occupancy":      { d: "How the insured building or space is actually used (office, warehouse, retail, etc.).", w: "Occupancy drives both fire and liability hazard independent of construction type." },
    "Zone":           { d: "The catastrophe (wind/hail) zone this row applies to.", w: "Coastal and high-wind zones carry a materially higher factor to reflect filed cat exposure." },
    "Hazard Group":   { d: "NCCI/ISO-style grouping of professional exposures by relative claim severity.", w: "MPL increased-limits pricing is built on top of the hazard group, not the raw specialty." },
    "MFA Posture":    { d: "How thoroughly multi-factor authentication is deployed across the insured's environment.", w: "One of the strongest controls-based credits in cyber underwriting — weak MFA is also a common decline reason." },
    "Retention":      { d: "The dollar retention (self-insured amount) the insured carries before this coverage responds.", w: "Higher retention lowers premium by shifting the smallest, most frequent losses back to the insured." },
    "SVC Code":       { d: "The motor-vehicle-record violation code as reported by the state DMV.", w: "The raw code the points table converts into a Driver Class points count." },
    "Violation":      { d: "Plain-English description of the SVC code in this row.", w: "Adjusters and underwriters read the description; the engine matches on the code." },
    "First":          { d: "Points assessed for the first occurrence of this violation in the experience period.", w: "A repeat of the same violation is scored separately under Additional." },
    "Additional":     { d: "Points assessed for each additional occurrence of this violation beyond the first.", w: "Lets a single violation type escalate in points without a separate row per occurrence count." },
    "Comprehensive":  { d: "Rate or factor for Comprehensive (other-than-collision) physical damage coverage.", w: "Priced separately from Collision because the two perils have very different loss patterns." },
    "Coll $100":      { d: "Physical damage rate at a $100 Collision deductible.", w: "One column of a deductible-banded rate table — compare against Coll $250 / $500 to see the deductible credit." },
    "Coll $250":      { d: "Physical damage rate at a $250 Collision deductible.", w: "One column of a deductible-banded rate table." },
    "Coll $500":      { d: "Physical damage rate at a $500 Collision deductible.", w: "One column of a deductible-banded rate table." },
    "Units":          { d: "The unit count (rated power units, vehicles) that puts this row's fleet-size band in force.", w: "Fleet size factors are banded by count, not banded by any single vehicle's characteristics." },
    "Coverages Written": { d: "Which combination of coverages the insured is buying — drives whether a package factor applies.", w: "Buying Liability and Physical Damage together is priced differently than either alone." },
    "Years in Business": { d: "How long the insured account has been operating, in whole years.", w: "A longer track record earns an experience credit; a newer operation is scored more conservatively." },
    "Safety Rating":  { d: "The carrier's FMCSA safety rating (Satisfactory, Conditional, Unsatisfactory, or Not Rated).", w: "An Unsatisfactory rating is a hard decline in this program, not a debit — see the table's own note." },
    "FMCSA Alerts":   { d: "Count of open FMCSA BASIC alerts on the carrier's safety profile.", w: "More open alerts moves this row's credit/debit further toward a debit." },
    "Applies To":      { d: "Whether this row's threshold is measured against vehicles or against drivers.", w: "The same out-of-service rate means something different depending on which population it's measured over." },
    "Rate At or Above": { d: "The out-of-service rate threshold that puts this row's factor in force.", w: "Rates are compared against filed FMCSA national averages, not an arbitrary cutoff." },
    "Question":       { d: "The underwriting question this row's answer maps to (e.g. \"Requires ICC filing?\").", w: "Ties a yes/no or filed-status answer back to the specific credit or debit it earns." },
    "Rate / $100 Payroll": { d: "Workers' Compensation manual rate per $100 of payroll for this class code.", w: "Summed across every class code on the account (weighted by payroll) before Experience Mod is applied." },
    "Parameter":      { d: "Name of a fixed, program-wide constant — not looked up per quote, the same on every rating.", w: "Distinguishes a genuine constant from a table row that merely happens to have one value on file today." },
    "Liability":      { d: "Liability-coverage factor or rate for this row.", w: "Shown alongside a Comprehensive/Physical-Damage column where a table rates both perils off the same input." },
    "Liability Factor": { d: "Multiplier this row contributes to the Liability premium.", w: "Applied to Base Loss Cost alongside every other liability factor in the chain." },
    "TTT Liability":  { d: "Liability factor for Tractors, Trucks and Trailers on this row.", w: "Split from PPT Liability because the two vehicle classes age very differently." },
    "PPT Liability":  { d: "Liability factor for Private Passenger Type vehicles on this row.", w: "Split from TTT Liability — light vehicles in a trucking fleet are rated on a separate curve." },
    "APD":            { d: "Auto Physical Damage factor contributed by this row.", w: "Shown next to Liability where the same input (e.g. radius) rates both coverages differently." },
    "Liability + Physical Damage together": { d: "The package factor row that applies when both coverages are written on the same policy.", w: "Distinct from either coverage priced alone — see \"Physical Damage alone\"." },
    "Physical Damage alone": { d: "The factor row that applies when Physical Damage is written without Liability.", w: "Distinct from the package row — see \"Liability + Physical Damage together\"." },
    "Trailer Bucket": { d: "Which of the two rated trailer buckets (Reefer or All Other) this row applies to.", w: "The filed table has only these two buckets — every trailer type maps to one or the other." },
    "Credit / Debit": { d: "Signed percentage this row adds to or subtracts from premium (positive = debit, negative = credit).", w: "Zero is neutral — the row that reads 0% is the one that changes nothing." },
    "Why it's constant": { d: "The filed or business reason this value is fixed rather than looked up per quote.", w: "Explains why a seemingly-variable input (e.g. a state election) is not exposed as a table here." },
    "From %":         { d: "Lower bound (inclusive) of the percentage band this row's credit/debit applies to.", w: "Paired with To % — an account's computed percentage is matched to exactly one band." },
    "To %":           { d: "Upper bound of the percentage band this row's credit/debit applies to.", w: "Paired with From % to define the band." },
    "Rate Range":     { d: "The percentage band this row's credit/debit applies to, shown as one span instead of two separate bounds.", w: "An account's computed percentage is matched to exactly one band; a single range reads faster than two numbers to recombine." },
    "Value From":     { d: "Lower bound (inclusive) of the stated-value band this row's factor applies to.", w: "Paired with Value To — the vehicle's stated value is matched to exactly one band." },
    "Value To":       { d: "Upper bound of the stated-value band this row's factor applies to.", w: "Paired with Value From to define the band." },
    "Value Range":    { d: "The stated-value band this row's factor applies to, shown as one span instead of two separate bounds.", w: "The vehicle's stated value is matched to exactly one band; a single range reads faster than two numbers to recombine." },
    "ZIP From":       { d: "First ZIP code (inclusive) in this consecutive-run territory band.", w: "Paired with ZIP To — consecutive ZIPs sharing a territory are compressed into one run rather than one row per ZIP." },
    "ZIP To":         { d: "Last ZIP code (inclusive) in this consecutive-run territory band.", w: "Paired with ZIP From to define the run." },
    "ZIP Range":      { d: "The consecutive ZIP-code run this territory applies to, shown as one span instead of two separate bounds.", w: "A risk's ZIP is matched to exactly one run; a single range reads faster than two numbers to recombine." }
  };

  /* Normalise: trim, strip surrounding whitespace, drop trailing ellipsis. */
  const normalised = {};
  for (const k in D) {
    normalised[k.replace(/\s+/g, " ").trim()] = D[k];
  }

  window.VX_TIPS = normalised;
})();