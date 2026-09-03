/* ==========================================================================
   Configuration Health — a composite score built only from signals this
   platform can actually verify, reusing checks already proven elsewhere
   this session rather than inventing a new "AI risk score":
     - factors with no lookup table and no default value
     - discounts/surcharges beyond what engine.js actually applies
       (the cap documented on discounts.html/surcharges.html — at most the
       first 2 active discounts / first active surcharge matching a LOB)
     - Draft versions carrying untested formulas (the same check
       versions.html's readinessCell already makes)
     - eligibility rules with no matching quote-form field (evaluable:false)
     - versions with no effective date
   ========================================================================== */
function computeHealth(lobName) {
  const checks = [];
  let score = 100;

  const lobFactors = VX.ratingFactors.filter(f => f.lob === lobName);
  const missingDefaults = lobFactors.filter(f => !f.rowCount && f.defaultValue == null);
  if (missingDefaults.length) {
    score -= Math.min(15, missingDefaults.length * 5);
    checks.push({ label: `${missingDefaults.length} factor${missingDefaults.length === 1 ? "" : "s"} missing a default value`, status: "bad",
      detail: missingDefaults.map(f => f.name).join(", "), fixHref: "factors.html" });
  } else if (lobFactors.length) {
    checks.push({ label: "Factors configured", status: "ok", detail: `${lobFactors.length} factors, each has a default or a lookup table`, fixHref: "factors.html" });
  }

  const lobDiscounts = VX.discounts.filter(d => d.active && (d.lob === lobName || d.lob === "All"));
  const lobSurcharges = VX.surcharges.filter(s => s.active && (s.lob === lobName || s.lob === "All"));
  const overDiscounts = Math.max(0, lobDiscounts.length - 2);
  const overSurcharges = Math.max(0, lobSurcharges.length - 1);
  if (overDiscounts || overSurcharges) {
    score -= 10;
    const parts = [];
    if (overDiscounts) parts.push(`${overDiscounts} discount${overDiscounts === 1 ? "" : "s"} beyond the 2 the engine applies`);
    if (overSurcharges) parts.push(`${overSurcharges} surcharge${overSurcharges === 1 ? "" : "s"} beyond the 1 the engine applies`);
    checks.push({ label: "Discount/surcharge cap exceeded", status: "warn", detail: parts.join("; "), fixHref: "discounts.html" });
  } else if (lobDiscounts.length || lobSurcharges.length) {
    checks.push({ label: "Discounts & surcharges within the engine's applied cap", status: "ok",
      detail: `${lobDiscounts.length} discount(s), ${lobSurcharges.length} surcharge(s) active`, fixHref: "discounts.html" });
  }

  const lobProducts = VX.products.filter(p => p.lob === lobName).map(p => p.name);
  const lobVersions = VX.versions.filter(v => lobProducts.includes(v.product));
  const draftsWithUntested = lobVersions.filter(v => v.status === "Draft").filter(v => {
    const attached = (VX.savedFormulas || []).filter(f => (f.attachments || []).some(a => a.product === v.product && a.ratingVersion === v.version));
    return attached.some(f => !f.tested);
  });
  if (draftsWithUntested.length) {
    score -= 10;
    checks.push({ label: `${draftsWithUntested.length} draft version${draftsWithUntested.length === 1 ? "" : "s"} has untested formulas`, status: "warn",
      detail: draftsWithUntested.map(v => `${v.product} ${v.version}`).join(", "), fixHref: "versions.html" });
  } else if (lobVersions.length) {
    checks.push({ label: "No draft versions blocked by untested formulas", status: "ok", detail: `${lobVersions.length} version(s) on file`, fixHref: "versions.html" });
  }

  const lobRules = VX.eligibilityRules.filter(r => r.active && (r.lob === lobName || r.lob === "All"));
  const notEvaluable = lobRules.filter(r => !r.evaluable);
  if (notEvaluable.length) {
    score -= Math.min(10, notEvaluable.length * 2);
    checks.push({ label: `${notEvaluable.length} eligibility rule${notEvaluable.length === 1 ? "" : "s"} not evaluable at quote time`, status: "warn",
      detail: "No matching field exists on the quote form yet — documentation only", fixHref: "quote-portal.html" });
  } else if (lobRules.length) {
    checks.push({ label: "Eligibility rules evaluable", status: "ok", detail: `${lobRules.length} active rule(s)`, fixHref: "quote-portal.html" });
  }

  const missingEffDate = lobVersions.filter(v => !v.effectiveStart);
  if (missingEffDate.length) {
    score -= 10;
    checks.push({ label: `${missingEffDate.length} version${missingEffDate.length === 1 ? "" : "s"} missing an effective date`, status: "bad",
      detail: missingEffDate.map(v => `${v.product} ${v.version}`).join(", "), fixHref: "versions.html" });
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), checks };
}

function computeHealthAll() {
  const lobs = [...new Set(VX.lobs.filter(l => l.status === "Active").map(l => l.name))];
  const byLob = lobs.map(l => ({ lob: l, ...computeHealth(l) }));
  const score = byLob.length ? Math.round(byLob.reduce((a, r) => a + r.score, 0) / byLob.length) : 100;
  return { score, byLob };
}
