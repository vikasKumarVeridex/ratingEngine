/* ==========================================================================
   Tenant Setup — what a newly-onboarded tenant still has to configure.

   Built the same way as config-health.js: every step is measured off data
   this platform can actually read, so the checklist can't claim a tenant is
   ready when it isn't. Nothing here is a stored "progress" field that could
   drift out of step with reality — each step re-counts its own rows on
   every call.

   Scope is always ONE tenant (the active one unless told otherwise), read
   through the same /tenantId partition boundary every grid uses.
   ========================================================================== */
(function (g) {

  const scoped = (key, tid) => (VX[key] || []).filter(r => r.tenantId == null || r.tenantId === tid);

  /* Each step: id, label, what it's for, how it's measured, where to fix it.
     `required` steps gate "ready to quote"; the rest are refinements a tenant
     can go live without. */
  function tenantSetupSteps(tenantId) {
    const tid = tenantId == null ? VX.activeTenantId : tenantId;
    const t = (VX.tenants || []).find(x => x.id === tid) || {};

    const lobs      = scoped("lobs", tid);
    const products  = scoped("products", tid);
    const versions  = scoped("versions", tid);
    const factors   = scoped("ratingFactors", tid);
    const units     = scoped("units", tid);
    const formulas  = scoped("savedFormulas", tid);
    const published = versions.filter(v => v.status === "Published");
    const states    = t.states || [];
    const covClasses = t.coverageClasses || [];

    const steps = [
      { id: "brand", required: true, label: "Tenant profile & branding",
        why: "The name, carrier entity and accent colour the portal is branded with.",
        done: !!(t.name && t.carrier && t.accent),
        detail: t.name ? `${t.name} · ${t.carrier || "no carrier entity"}` : "Not set",
        fix: "tenants.html", fixLabel: "Edit tenant" },

      { id: "states", required: true, label: "Licensed states",
        why: "Surplus-lines licences are per state — a quote can only be written where the tenant is licensed.",
        done: states.length > 0,
        detail: states.length ? `${states.length} state${states.length === 1 ? "" : "s"} licensed` : "No states selected",
        fix: "tenants.html", fixLabel: "Select states" },

      { id: "lobs", required: true, label: "Lines of business",
        why: "Which lines this tenant sells. Everything below is scoped to these.",
        done: lobs.length > 0,
        detail: lobs.length ? [...new Set(lobs.map(l => l.name))].join(", ") : "No lines enabled",
        fix: "lob.html", fixLabel: "Review lines" },

      { id: "products", required: true, label: "Products",
        why: "A quotable product per line — carries the application type and rater.",
        done: products.length > 0,
        detail: products.length ? `${products.length} product${products.length === 1 ? "" : "s"} configured` : "No products",
        fix: "products.html", fixLabel: "Configure products" },

      { id: "coverages", required: true, label: "Coverage classes",
        why: "Which primary and child coverages this tenant writes on its products.",
        done: covClasses.length > 0,
        detail: covClasses.length
          ? `${covClasses.length} primary · ${(t.childClasses || []).length} child`
          : "No coverage classes selected",
        fix: "coverages.html", fixLabel: "Configure coverages" },

      { id: "units", required: true, label: "Rating units",
        why: "What each coverage is rated per — vehicle, location, revenue, and so on.",
        done: units.length > 0,
        detail: units.length ? `${units.length} unit${units.length === 1 ? "" : "s"} defined` : "No units defined",
        fix: "units.html", fixLabel: "Configure units" },

      { id: "factors", required: true, label: "Rating factors",
        why: "The factors the engine applies. Each needs either a lookup table or a default value.",
        done: factors.length > 0 && !factors.some(f => !f.rowCount && f.defaultValue == null),
        detail: !factors.length ? "No factors configured"
          : (() => { const bad = factors.filter(f => !f.rowCount && f.defaultValue == null);
              return bad.length ? `${bad.length} of ${factors.length} missing a default or table` : `${factors.length} factors, all resolvable`; })(),
        fix: "factors.html", fixLabel: "Review factors" },

      { id: "versions", required: true, label: "Published rating version",
        why: "A version has to be Published before it rates anything — Drafts don't.",
        done: published.length > 0,
        detail: published.length
          ? `${published.length} published · ${versions.filter(v => v.status === "Draft").length} draft`
          : (versions.length ? `${versions.length} version(s), none published yet` : "No versions"),
        fix: "versions.html", fixLabel: "Publish a version" },

      { id: "formulas", required: false, label: "Formulas attached to a version",
        why: "Optional — a coverage without its own formula rates on the engine's built-in chain.",
        done: formulas.some(f => (f.attachments || []).length),
        detail: (() => { const n = formulas.filter(f => (f.attachments || []).length).length;
          return n ? `${n} formula(s) attached to a rating version` : "No formulas attached — built-in rating chain applies"; })(),
        fix: "formula-builder.html", fixLabel: "Build a formula" },

      { id: "pricing", required: false, label: "Discounts, surcharges & fees",
        why: "Optional pricing rules layered on top of the rated premium.",
        done: scoped("discounts", tid).length > 0 || scoped("fees", tid).length > 0,
        detail: `${scoped("discounts", tid).length} discount(s) · ${scoped("surcharges", tid).length} surcharge(s) · ${scoped("fees", tid).length} fee(s)`,
        fix: "discounts.html", fixLabel: "Configure pricing" },
    ];

    const required = steps.filter(s => s.required);
    const doneRequired = required.filter(s => s.done);
    return {
      tenant: t, steps, required, doneRequired,
      total: steps.length,
      doneCount: steps.filter(s => s.done).length,
      // "Ready to quote" is the honest gate: every REQUIRED step satisfied.
      ready: doneRequired.length === required.length,
      pct: Math.round((doneRequired.length / Math.max(1, required.length)) * 100),
    };
  }

  g.tenantSetupSteps = tenantSetupSteps;
})(window);
