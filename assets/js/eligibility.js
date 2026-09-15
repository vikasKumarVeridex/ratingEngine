/* Real evaluation of Eligibility Rules (assets/js/data.js: D.eligibilityRules)
   against the actual quote-input model used by quote-portal.html.

   Kept separate from engine.js — screening a submission is a different
   concern from pricing it, and this keeps engine.js's already-large,
   carefully-verified surface untouched.

   Only rules whose condition maps onto a field that genuinely exists on the
   quote form today are evaluable. The rest are reported in `notEvaluable`
   with a one-line reason instead of being faked. */

const EL_CONDITIONS = {
  EL_STATES: {
    evaluable: true, severity: "decline",
    test: input => { const s = VX.states.find(s => s.abv === input.state); return !s || !s.included; },
    reason: input => `${input.state || "This state"} is not marked "Included in Rater" on State Management.`,
  },
  EL_FLEETMIN: {
    evaluable: true, severity: "refer",
    test: input => (input.vehicles || []).length < 3,
    reason: input => `Fleet has ${(input.vehicles || []).length} power unit(s) on the schedule — below the 3-unit minimum for fleet rating.`,
  },
  EL_RADIUS: {
    evaluable: true, severity: "refer",
    test: input => !!input.radiusClass && input.radiusClass !== "48_states",
    reason: () => `Radius of Operation is not "48 States" — beyond-local operation requires DOT compliance review. (Proxy for a literal mileage radius; the quote form captures a radius class, not miles.)`,
  },
  EL_REVENUE: {
    evaluable: true, severity: "decline",
    test: input => (+input.revenue || 0) > 250000000,
    reason: input => `Annual revenue of ${vxMoney ? vxMoney(+input.revenue || 0) : input.revenue} exceeds the $250M ceiling for MPL.`,
  },
  EL_SECBASE: {
    evaluable: true, severity: "refer",
    test: input => input.mfa === "NONE",
    reason: () => `No MFA controls are in place — minimum partial MFA is required for cyber eligibility.`,
  },
  EL_NAICS: { evaluable: false,
    reason: () => `The Class of Business dropdown only offers approved, NAICS-mapped codes — this rule is satisfied by construction, so there is nothing left to evaluate at quote time.` },
  /* The Commodities Hauled schedule now carries a real hazmat/hazardousMod
     flag per selected commodity (VX.truckCargoCommodities), so this rule can
     finally be evaluated instead of skipped. */
  EL_HAZMAT: {
    evaluable: true, severity: "refer",
    test: input => (input.cargoCommodities || []).some(c => {
      const rec = VX.truckCargoCommodities.find(x => x.code === c.code);
      return rec && (rec.hazardousMod || rec.code === "HAZMAT") && (+input.liabLimit || 0) > 1000000;
    }),
    reason: () => `A hazmat/hazard-loaded commodity is selected with a Liability Limit above $1M CSL — requires umbrella referral.`,
  },
  EL_DOUBLES: { evaluable: true, severity: "refer",
    test: input => !!input.pullsDoubles,
    reason: () => `Insured pulls double trailers.` },
  EL_TRIPLES: { evaluable: true, severity: "refer",
    test: input => !!input.pullsTriples,
    reason: () => `Insured pulls triple trailers.` },
  EL_UNSECURED: { evaluable: true, severity: "refer",
    test: input => !!input.unsecuredLoads,
    reason: () => `Insured hauls unsecured loads.` },
  EL_OVERSIZE: { evaluable: true, severity: "refer",
    test: input => !!input.oversizeOverweight,
    reason: () => `Insured hauls oversize or overweight loads.` },
  EL_WASTE: { evaluable: true, severity: "refer",
    test: input => !!input.wasteRefuse,
    reason: () => `Insured hauls waste or refuse materials.` },
  /* Real WC eligibility questions — wc-eligibility-ques.component.html. */
  EL_OSHA: {
    evaluable: true, severity: "refer",
    test: input => (+input.oshaViolations || 0) >= 3,
    reason: input => `${+input.oshaViolations || 0} OSHA violation(s) in the prior 3 years — 3 or more requires underwriter review.`,
  },
  EL_WCFATAL: {
    evaluable: true, severity: "decline",
    test: input => !!input.wcFatality,
    reason: () => `A workplace fatality was reported in the prior 3 years.`,
  },
  EL_WCSUBCON: {
    evaluable: true, severity: "refer",
    test: input => !!input.wcSubcontractorsUninsured,
    reason: () => `Subcontractors are hired who do not carry their own Workers' Compensation coverage.`,
  },
  EL_WCDECLINED: {
    evaluable: true, severity: "refer",
    test: input => !!input.wcPriorDeclined,
    reason: () => `A prior carrier declined or non-renewed Workers' Compensation coverage for this insured.`,
  },
  EL_BLDGAGE: { evaluable: false,
    reason: () => `No building-age field exists on the current quote form.` },
  EL_VACANCY: { evaluable: false,
    reason: () => `No vacancy-percentage field exists on the current quote form.` },
  EL_PRIORCOV: { evaluable: false,
    reason: () => `No prior-coverage-continuity field exists on the current quote form.` },
};

/* lobCode: the short quote-portal code ("TRUCK","GL","PROP","MPL","CYBER") —
   resolved to the full LOB name D.eligibilityRules actually stores, so the
   caller doesn't need to know that mapping. */
function evaluateEligibility(lobCode, input) {
  const lobName = (VX.lobs.find(l => l.code === lobCode) || {}).name || lobCode;
  const tenantId = input.tenantId != null ? input.tenantId : VX.activeTenantId;
  const rules = (VX.eligibilityRules || []).filter(r => r.active && (r.lob === "All" || r.lob === lobName)
    && (r.tenantId == null || r.tenantId === tenantId)
    && (!r.product || r.product === input.product)
    && (!r.states || !r.states.length || r.states.includes(input.state)));
  const declines = [], refers = [], notEvaluable = [];

  rules.forEach(r => {
    const c = EL_CONDITIONS[r.code];
    if (!c) { notEvaluable.push({ rule: r, reason: "No evaluation logic registered for this rule code yet." }); return; }
    if (!c.evaluable) { notEvaluable.push({ rule: r, reason: c.reason(input) }); return; }
    let hit;
    try { hit = !!c.test(input); }
    catch (e) { notEvaluable.push({ rule: r, reason: "Evaluation error: " + e.message }); return; }
    if (!hit) return;
    const entry = { rule: r, reason: c.reason(input) };
    (c.severity === "decline" ? declines : refers).push(entry);
  });

  return { declines, refers, notEvaluable };
}
