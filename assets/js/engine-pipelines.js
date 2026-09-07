/* ==========================================================================
   VeriDex — rating engine pipelines + flowchart renderer.

   Extracted from versions.html so more than one screen can use it: the
   Versions "Rating Engine" modal and the standalone Engine Flow page both
   read the SAME pipeline definitions and draw the SAME diagram, rather than
   two copies that drift apart.

   Loaded after data.js.
   ========================================================================== */
/* What each LOB's engine actually computes, in order. "Commercial Trucking"
   is verified line-by-line against the source rating workbook (see
   engine.js's trucking()); the others are engine.js's working
   approximations for those LOBs and are flagged as such, not fabricated
   as equally verified. */
const ENGINE_PIPELINES = {
  /* The real, verified formula was briefly removed then restored — see
     truckingReal() in engine.js. Two candidate models were documented here
     alongside it during a comparison exercise; both have been removed, so
     this describes the filed formula and nothing else. */
  "Commercial Trucking": {
    verified: true,
    source: "the filed trucking rating manual",
    caveat: "This flow matches app_type 483's real stored-procedure rater (udf_iso_new_rater_liab_calculations, ams-service) term-for-term — but that SQL has since been hand-patched with several 2026 date-gated overrides the workbook predates (a driver-criteria factor from 2026-03-05, broadened-pollution/defense-addback factors from 2026-03-12, a stated-value-by-year change from 2026-04-15) that aren't modeled here. Every trucking product uses this Custom (483) per-vehicle rater — the legacy 501 account-level rater was retired from the platform, so all trucking products rate through this flow by design.",
    steps: [
      "Rate each vehicle's Liability premium: Base Loss Cost × (ILF − Liability Deductible Factor) × LCM × Primary Class × Secondary Class × Fleet Size × Vehicle Age × OCN × Radius × NAICS × Tort Limitation × Miles Driven × Rating Class × Dashcam × CDL Experience Discount × Driver Class × Account-Level Factor — rounded",
      "Rate each vehicle's Physical Damage premium: Vehicle Value × MAX(full factor chain, floored minimum rate)",
      "Sum Liability and Physical Damage separately across every vehicle on the schedule",
      "Multiply both coverage totals by the policy's Experience Mod",
      "Add Cargo — rate not sourced from this workbook, kept as a flagged placeholder",
      "Add policy fees, then state premium tax, to reach Final Premium",
    ],
  },
  "General Liability": { verified: false, steps: [
    "Premises/Operations: Basic Limit Loss Cost × Increased Limits Factor × LCM × Class Factor × Schedule Rating Mod × Experience Mod",
    "Products/Completed Operations (if selected): 34% of the Premises/Operations premium",
  ]},
  "Commercial Property": { verified: false, steps: [
    "(Total Insured Value / 100) × Base Rate × Construction Type × Protection Class × Occupancy × Wind/Hail Zone × Deductible × LCM × IRPM",
    "Time Element (if selected): 22% of the base premium",
  ]},
  "Professional Liability (MPL)": { verified: false, steps: [
    "Basic Limit Loss Cost × LCM × ILF (adjusted for retention) × Hazard Group × Defense Cost (ALAE) × Claims-Made/Year-in-Program × Loss Experience × State Mod × Underwriter Mod",
  ]},
  "Cyber": { verified: false, steps: [
    "Base Rate (revenue-scaled) × Base Rate Deviation × Revenue Band × Industry Class × MFA Controls × Aggregate Limit × Retention × Schedule Rating",
  ]},
  /* Workers' Compensation has a real calculator (workersComp() in engine.js)
     but was the one rated line with no pipeline entry, so it appeared on
     neither the Versions engine view nor the Engine Flow page — the flow
     picker simply skipped it. Written from that function's own sequence. */
  "Workers' Compensation": { verified: false,
    caveat: "The METHOD is real — NCCI-style manual premium off an exposure schedule, then experience mod and schedule credit, both clamped to the program band. The class RATES are representative: no filed WC rate manual ships with this platform. Written on admitted paper, so no surplus-lines tax or filing fee applies.",
    steps: [
      "For each exposure row: Manual Premium = (Payroll ÷ 100) × the class code's rate per $100",
      "Sum every row's manual premium across the schedule — each class code is rated on its own payroll, not blended",
      "× Experience Mod, clamped to the program's min/max",
      "× Schedule Credit / Debit, clamped to the program's min/max",
      "Apply the program minimum premium if the result falls below it",
      "Add policy fees. No surplus-lines tax and no SL filing fee — this is admitted paper",
    ]},
};
