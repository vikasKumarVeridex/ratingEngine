/* ==========================================================================
   VeriDex — permission module (RBAC + ABAC)

   Roles used to be a free-text sentence ("Edit factor tables; cannot publish"),
   which reads well and enforces nothing. This replaces that with a model that
   can actually answer "may this user do this, to this record, right now?".

   Two layers, in this order:

     RBAC  — a role grants ACTIONS on RESOURCES. Coarse, stable, and what an
             administrator thinks in: "actuaries may edit rate tables".
     ABAC  — constraints then narrow that grant using ATTRIBUTES of the user,
             the record and the request: own tenant only, licensed states only,
             within an authority limit, not on a Published version.

   RBAC alone cannot express "within your authority" without inventing a role
   per limit; ABAC alone turns every decision into a rule hunt. The combination
   is what real carrier platforms run, so that is what is modelled here.

   Deny is the default: a permission not granted is not held.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Actions -------------------------------------------------- */
  const ACTIONS = [
    { k: "view",    l: "View",    d: "Open the screen and read its records." },
    { k: "create",  l: "Create",  d: "Add a new record." },
    { k: "edit",    l: "Edit",    d: "Change an existing record." },
    { k: "delete",  l: "Delete",  d: "Remove a record." },
    { k: "publish", l: "Publish", d: "Make a draft live — the action that changes what customers are charged." },
    { k: "export",  l: "Export",  d: "Take data out of the platform." },
    { k: "approve", l: "Approve", d: "Sign off another user's change or an out-of-authority referral." },
  ];

  /* ---------- Resources -------------------------------------------------
     The real screens and entities of this platform, grouped the way the nav
     groups them. `actions` lists only what genuinely applies: you cannot
     "publish" a ZIP code, and pretending you can makes the matrix noise. */
  const RESOURCES = [
    { g: "Configuration", k: "lobs",       l: "Lines of Business", actions: ["view", "create", "edit", "delete"] },
    { g: "Configuration", k: "coverages",  l: "Coverages",         actions: ["view", "create", "edit", "delete"] },
    { g: "Configuration", k: "products",   l: "Products",          actions: ["view", "create", "edit", "delete", "publish"] },
    { g: "Configuration", k: "units",      l: "Unit Configuration", actions: ["view", "create", "edit", "delete"] },
    { g: "Configuration", k: "versions",   l: "Rating Versions",   actions: ["view", "create", "edit", "delete", "publish", "approve"] },

    { g: "Rating", k: "factors",     l: "Rating Factors",   actions: ["view", "create", "edit", "delete", "export"] },
    { g: "Rating", k: "formulas",    l: "Rating Formulas",  actions: ["view", "create", "edit", "delete", "publish"] },
    { g: "Rating", k: "rateTables",  l: "Rate Tables",      actions: ["view", "edit", "export"] },
    { g: "Rating", k: "industry",    l: "Industry Classes", actions: ["view", "create", "edit", "delete"] },

    { g: "Pricing", k: "baseRates",  l: "Base Rates",   actions: ["view", "create", "edit", "delete", "export"] },
    { g: "Pricing", k: "discounts",  l: "Discounts",    actions: ["view", "create", "edit", "delete"] },
    { g: "Pricing", k: "surcharges", l: "Surcharges",   actions: ["view", "create", "edit", "delete"] },
    { g: "Pricing", k: "fees",       l: "Fees",         actions: ["view", "create", "edit", "delete"] },
    { g: "Pricing", k: "taxes",      l: "Taxes",        actions: ["view", "edit"] },

    { g: "Geography", k: "states",     l: "States",      actions: ["view", "edit"] },
    { g: "Geography", k: "counties",   l: "Counties",    actions: ["view", "edit"] },
    { g: "Geography", k: "territories", l: "Territories", actions: ["view", "create", "edit", "delete"] },

    { g: "Operations", k: "quotes",   l: "Quotes / Sandbox", actions: ["view", "create", "export"] },
    { g: "Operations", k: "lossRuns", l: "Loss Run Analytics", actions: ["view", "export"] },

    { g: "Administration", k: "tenants", l: "Tenants",  actions: ["view", "create", "edit", "delete"] },
    { g: "Administration", k: "users",   l: "Users",    actions: ["view", "create", "edit", "delete"] },
    { g: "Administration", k: "roles",   l: "Roles & Permissions", actions: ["view", "create", "edit", "delete"] },
    { g: "Administration", k: "audit",   l: "Audit History", actions: ["view", "export"] },
    { g: "Administration", k: "settings", l: "System Settings", actions: ["view", "edit"] },
  ];

  /* ---------- ABAC attributes -------------------------------------------
     Each names something the platform genuinely knows at decision time, and
     says where the value comes from — the user's profile, the record being
     acted on, or the request itself. An attribute nothing can supply is a
     rule that silently never fires, so the list stays honest. */
  const ATTRIBUTES = [
    { k: "tenantId",  l: "Tenant",          src: "record", type: "id",
      d: "The tenant partition the record belongs to." },
    { k: "lob",       l: "Line of Business", src: "record", type: "list",
      d: "The LOB of the record being acted on." },
    { k: "state",     l: "State",           src: "record", type: "list",
      d: "The state a filing, rate or quote applies to." },
    { k: "status",    l: "Record Status",   src: "record", type: "list",
      d: "Draft / Published / Expired / Active / Retired." },
    { k: "owner",     l: "Record Owner",    src: "record", type: "id",
      d: "Who created or owns the record." },
    { k: "premium",   l: "Quote Premium",   src: "request", type: "number",
      d: "Premium on the quote being acted on — the basis for an authority limit." },
    { k: "mfa",       l: "User MFA",        src: "user", type: "bool",
      d: "Whether the acting user has multi-factor authentication enabled." },
  ];

  const OPERATORS = [
    { k: "eqUser",   l: "matches the user's own",  d: "Record attribute must equal the user's value (own tenant, own records).", needsValue: false },
    { k: "inUser",   l: "is in the user's list",   d: "Record attribute must be one the user is assigned (licensed states, owned LOBs).", needsValue: false },
    { k: "in",       l: "is one of",               d: "Record attribute must be in a fixed list.", needsValue: true },
    { k: "notIn",    l: "is not one of",           d: "Blocks specific values — e.g. cannot touch Published.", needsValue: true },
    { k: "lte",      l: "is at most",              d: "Numeric ceiling — an authority limit.", needsValue: true },
    { k: "isTrue",   l: "must be true",            d: "Boolean gate — e.g. MFA must be enabled.", needsValue: false },
  ];

  /* ---------- Decision ---------------------------------------------------
     Returns { allow, reason, stage } — never a bare boolean, because "why"
     is the whole point of having a model instead of a sentence. */
  function evaluate(user, resource, action, ctx) {
    ctx = ctx || {};
    const roles = rolesOf(user);
    if (!roles.length) return deny("rbac", "User has no role assigned.");

    /* --- RBAC: does any role grant this action on this resource? --- */
    const granting = roles.filter(r => ((r.permissions || {})[resource] || []).includes(action));
    if (!granting.length) {
      return deny("rbac", `No role held by this user grants "${action}" on ${labelOf(resource)}.`);
    }

    /* --- ABAC: every constraint on a granting role must pass. A user with
           two roles is allowed if EITHER role's constraints are satisfied —
           roles are additive, so the least restrictive path that actually
           grants the action wins. --- */
    const failures = [];
    for (const role of granting) {
      const applicable = (role.constraints || []).filter(c =>
        !c.resources || !c.resources.length || c.resources.includes(resource));
      const failed = applicable.filter(c => !passes(c, user, ctx));
      if (!failed.length) {
        return { allow: true, stage: "abac", reason: applicable.length
          ? `Granted by ${role.name}; ${applicable.length} constraint${applicable.length === 1 ? "" : "s"} satisfied.`
          : `Granted by ${role.name} with no constraints on this resource.` };
      }
      failed.forEach(c => failures.push(`${role.name}: ${describe(c)}`));
    }
    return deny("abac", `Role grants the action, but constraints blocked it — ${failures[0]}`);
  }

  function passes(c, user, ctx) {
    const attr = c.attr;
    const recVal = attr === "mfa" ? (user.mfa === "Enabled" || user.mfa === true) : ctx[attr];
    const userVal = (user.attrs || {})[attr];

    switch (c.op) {
      case "eqUser":
        if (recVal == null || userVal == null) return false;
        return String(recVal) === String(userVal);
      case "inUser": {
        const list = Array.isArray(userVal) ? userVal.map(String) : [];
        if (list.includes("*")) return true;
        if (recVal == null) return false;
        return list.includes(String(recVal));
      }
      case "in":
        return asList(c.value).map(String).includes(String(recVal));
      case "notIn":
        if (recVal == null) return true;           // nothing to exclude
        return !asList(c.value).map(String).includes(String(recVal));
      case "lte": {
        if (recVal == null) return true;           // no amount in play
        /* "@authorityLimit" is a named reference to a specific user attribute,
           NOT to the attribute being compared: the request carries a premium,
           the ceiling lives on the user as authorityLimit. Resolving it via
           `userVal` looked up user.attrs.premium, which does not exist, so the
           cap came back NaN and every in-authority request was denied. */
        const cap = c.value === "@authorityLimit" ? +((user.attrs || {}).authorityLimit) : +c.value;
        if (isNaN(cap)) return false;
        return +recVal <= cap;
      }
      case "isTrue":
        return recVal === true;
      default:
        return false;                              // unknown operator denies
    }
  }

  function describe(c) {
    const a = (ATTRIBUTES.find(x => x.k === c.attr) || { l: c.attr }).l;
    const o = (OPERATORS.find(x => x.k === c.op) || { l: c.op }).l;
    const v = c.value === "@authorityLimit" ? "the user's authority limit"
            : Array.isArray(c.value) ? c.value.join(", ") : c.value;
    return `${a} ${o}${v != null && v !== "" ? " " + v : ""}`;
  }

  function asList(v) { return Array.isArray(v) ? v : String(v == null ? "" : v).split(",").map(x => x.trim()).filter(Boolean); }
  function deny(stage, reason) { return { allow: false, stage, reason }; }
  function labelOf(k) { return (RESOURCES.find(r => r.k === k) || { l: k }).l; }
  function rolesOf(user) {
    const names = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
    return names.map(n => (VX.roles || []).find(r => r.name === n)).filter(Boolean);
  }

  /* How many action-grants a role holds — the honest headline number for a
     grid column, instead of counting resources and calling it permissions. */
  function grantCount(role) {
    return Object.values(role.permissions || {}).reduce((a, v) => a + (v || []).length, 0);
  }

  window.VX_PERM = {
    ACTIONS, RESOURCES, ATTRIBUTES, OPERATORS,
    evaluate, describe, grantCount, rolesOf, labelOf,
    groups: () => [...new Set(RESOURCES.map(r => r.g))],
    resource: k => RESOURCES.find(r => r.k === k),
    action: k => ACTIONS.find(a => a.k === k),
  };
})();
