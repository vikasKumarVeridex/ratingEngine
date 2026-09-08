/* ==========================================================================
   Veridex Rating Platform — Core shell, navigation, UX primitives
   ========================================================================== */

const NAV = [
  /* Loss Run Analytics sits directly under Dashboard: both are read-only
     views of how the book is performing, and that is what you look at before
     going near a quote. The two quote screens follow as the "do something"
     pair. */
  { g: "Main", items: [
    { h: "dashboard.html", i: "fa-gauge-high", l: "Dashboard" },
    { h: "loss-runs.html", i: "fa-triangle-exclamation", l: "Loss Run Analytics" },
    { h: "quote-portal.html", i: "fa-flask", l: "Sandbox Quote Generation" },
  ]},
  /* Configuration sits above Rating: you define the line of business, the
     coverages under it and the product that sells them BEFORE the factors and
     formulas that price them, so the nav runs in the order the work is
     actually done — LOB, then its coverages, then the product. */
  { g: "Configuration", items: [
    { h: "products.html", i: "fa-cubes", l: "Products" },
    { h: "versions.html", i: "fa-code-branch", l: "Versions" },
  ]},
  { g: "Rating", items: [
    /* Lines of Business moved up to Configuration — an LOB is something you
       define before rating it, not a rating artefact. */
    { h: "factors.html", i: "fa-sliders", l: "Rating Factors" },
    { h: "formula-builder.html", i: "fa-square-root-variable", l: "Rating Formulas" },
    { h: "rate-tables.html", i: "fa-database", l: "Rate Tables (live)" },
    { h: "lookup-tables.html", i: "fa-table-list", l: "Lookup Tables" },
    { h: "glossary.html", i: "fa-book", l: "Glossary" },
  ]},
  { g: "Pricing", items: [
    { h: "base-rates.html", i: "fa-table", l: "Base Rates" },
    { h: "discounts.html", i: "fa-tags", l: "Discounts" },
    { h: "surcharges.html", i: "fa-triangle-exclamation", l: "Surcharges" },
    { h: "fees.html", i: "fa-file-invoice-dollar", l: "Fees" },
    { h: "taxes.html", i: "fa-percent", l: "State Taxes" },
    { h: "county-taxes.html", i: "fa-map-pin", l: "County Taxes" },
    { h: "premium-rules.html", i: "fa-arrows-up-down", l: "Min / Max Rules" },
  ]},
  { g: "Geography", items: [
    { h: "states.html", i: "fa-flag-usa", l: "States" },
    { h: "counties.html", i: "fa-map", l: "Counties" },
    { h: "territories.html", i: "fa-map-location-dot", l: "Territories" },
    { h: "zipcodes.html", i: "fa-location-dot", l: "ZIP Codes" },
  ]},
  /* Tenants and Tenant Setup are no longer in the sidebar. Switching tenant
     is a top-bar action (the tenant picker), and its "Manage tenants" item
     still reaches tenants.html — so the flow stays available without two
     nav rows for something an admin touches rarely. The unconfigured-tenant
     banner also still links to tenant-setup.html. */
  { g: "Administration", items: [
    { h: "users.html", i: "fa-users", l: "Users" },
    { h: "roles.html", i: "fa-user-shield", l: "Roles" },
    { h: "audit.html", i: "fa-clock-rotate-left", l: "Audit History" },
    { h: "settings.html", i: "fa-gear", l: "Settings" },
    { h: "integration.html", i: "fa-plug", l: "Integration Guide" },
  ]},
];

/* ---------- theme ----------
   Removed. §17 forbids dark mode in content areas: rating figures, factor
   tables and audit trails are read and compared, and a second colour scheme
   doubles the contrast surface that has to be verified for no benefit. The
   dark rules are gone from app.css, so the toggle that used to live here
   stamped an attribute nothing responded to. A control that does nothing is
   worse than no control, so it is removed rather than hidden. The dark shell
   (left nav, topbar) is not dark MODE — it is fixed chrome, always dark. */


/* ---------- multi-tenant ----------
   VeriDex is sold as a service; each subscribing carrier is a tenant. The
   switcher changes which tenant the admin is working in and rebrands the
   shell accordingly. Rating configuration is not yet partitioned per
   tenant in this prototype — see tenants.html, which says so plainly
   rather than implying isolation that isn't built. */
function vxTenant() {
  return (VX.tenants || []).find(t => t.id === VX.activeTenantId) || (VX.tenants || [{ name: "—", accent: "#f2660d" }])[0];
}

/* Distinct line-of-business NAMES for pickers, filters and charts.
   VX.lobs is partitioned on /tenantId — one document per (tenant, line) —
   so the same line legitimately appears several times in that array. Any
   dropdown built straight off `VX.lobs.map(l => l.name)` therefore repeats
   "Commercial Trucking" once per tenant that bought it, which reads as a
   data bug. Every picker goes through here instead, so the dedupe can't
   drift across the ~20 screens that need it.
   Pass a tenantId (or true for the active tenant) to narrow to the lines
   that tenant actually has; omit it for the platform-wide list, which is
   what an admin configuring a NEW tenant needs to choose from. */
function vxLobNames(tenantId) {
  let rows = VX.lobs || [];
  if (tenantId === true) tenantId = VX.activeTenantId;
  if (tenantId != null) rows = rows.filter(l => l.tenantId === tenantId);
  return [...new Set(rows.map(l => l.name))];
}

/* Distinct rating-unit names for pickers. VX.units is partitioned on
   /tenantId exactly like VX.lobs, so the raw array holds one row per
   (tenant, unit) and a straight map repeats every unit once per tenant.
   Units are tenant-configurable, so this defaults to the ACTIVE tenant's
   list rather than the platform-wide union — a coverage can only be rated
   on a unit its own tenant has defined. */
function vxUnitNames(tenantId) {
  const tid = tenantId === undefined ? VX.activeTenantId : tenantId;
  let rows = VX.units || [];
  if (tid != null) rows = rows.filter(u => u.tenantId == null || u.tenantId === tid);
  return [...new Set(rows.map(u => u.name))];
}
/* The unit record behind a name, for tooltips/detail — same partition. */
function vxUnit(name, tenantId) {
  const tid = tenantId === undefined ? VX.activeTenantId : tenantId;
  return (VX.units || []).find(u => u.name === name && (u.tenantId == null || u.tenantId === tid)) || null;
}
function vxSetTenant(id) {
  const t = (VX.tenants || []).find(x => x.id === +id);
  if (!t) return;
  VX.activeTenantId = t.id;
  localStorage.setItem("vxActiveTenant", JSON.stringify(t.id));
  vxToast("Tenant switched", `Now working in ${t.name} · ${t.plan}`, "ok");
  setTimeout(() => location.reload(), 550);
}

/* ---------- honest disclosure ----------
   A screen must never claim to do something it doesn't. These two render
   the same warning-callout pattern first proven on factors.html/rate-tables.html
   (a real "this data isn't wired to the engine" disclosure), promoted here so
   every page uses one shared function instead of re-pasting styled divs that
   drift out of sync with each other. */
/* `html` is the headline the reader must not miss; the optional `detail` is the
   explanation, collapsed behind "Why?". Splitting them keeps every one of these
   disclosures intact while giving the page back three or four lines. */
function vxNotWiredBanner(html, detail) {
  const id = "vxw" + (vxNotWiredBanner._n = (vxNotWiredBanner._n || 0) + 1);
  return `<div class="vx-exp2 vx-anim ${detail ? "" : "nodet"}" id="${id}"
      style="border-left-color:var(--warn);background:rgba(198,137,15,.07)">
    <div class="hd"><i class="fa-solid fa-triangle-exclamation" style="color:var(--warn);font-size:11.5px"></i>
      <span>${html}</span>
      ${detail ? `<button type="button" class="tog" onclick="vxExpToggle('${id}')">Why?</button>` : ""}</div>
    ${detail ? `<div class="bd">${detail}</div>` : ""}</div>`;
}
/* Collapsible explainer. The prototype had grown a paragraph-sized callout at
   the top of nearly every page: correct, but re-read at every visit and pushing
   the actual grid below the fold. `summary` is the one line that stays visible;
   `detail` is the reasoning, one click away. Nothing is deleted — the
   disclosures about what is and isn't wired to the engine all still say what
   they said, they just no longer shout it. */
function vxExplain(title, summary, detail, opts) {
  const o = opts || {};
  const id = "vxe" + (vxExplain._n = (vxExplain._n || 0) + 1);
  const ico = o.icon || "fa-circle-info";
  const col = o.tone === "warn" ? "var(--warn)" : "var(--primary)";
  return `<div class="vx-exp2 vx-anim" id="${id}" style="border-left-color:${col}">
    <div class="hd">
      <i class="fa-solid ${ico}" style="color:${col};font-size:11.5px"></i>
      ${title ? `<b>${title}</b>` : ""}<span>${summary}</span>
      ${detail ? `<button type="button" class="tog" onclick="vxExpToggle('${id}')">Why?</button>` : ""}
    </div>
    ${detail ? `<div class="bd">${detail}</div>` : ""}
  </div>`;
}
function vxExpToggle(id) {
  const el = document.getElementById(id); if (!el) return;
  el.classList.toggle("on");
  const b = el.querySelector(".tog");
  if (b) b.textContent = el.classList.contains("on") ? "Hide" : "Why?";
}
function vxWiredChip(isWired, label) {
  return isWired ? `<span class="vx-b green">${label || "Wired"}</span>` : `<span class="vx-b amber" title="Registered here, but not read by the rating engine">${label || "Not wired"}</span>`;
}

/* ---------- shell ---------- */
/* Page subtitles had drifted to 150-200 characters, which is a paragraph
   wearing a subtitle's clothes. A subtitle may now be written "short || the
   rest"; the short half is shown, the rest becomes a hover tooltip. */
/* Shared Chart.js styling so all three charting screens read as one system.
   Matches the reference dashboard: hairline dotted horizontal rules, no
   vertical grid, no axis spines, rounded bars and smooth lines. Call this at
   the top of a page's draw(); it is a no-op if Chart.js is not loaded. */
function vxChartDefaults() {
  if (typeof Chart === "undefined") return;
  const cs = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  Chart.defaults.color = cs("--text-dim");
  Chart.defaults.font.family = cs("--font") || "Inter, Segoe UI, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.elements.line.tension = 0.4;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 4;
  Chart.defaults.elements.bar.borderRadius = 5;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = "circle";
  Chart.defaults.plugins.legend.labels.boxWidth = 7;
  Chart.defaults.plugins.legend.labels.padding = 15;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(27,30,36,.94)";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
  Chart.defaults.scale.grid.color = cs("--border");
  Chart.defaults.scale.grid.borderDash = [3, 4];
  Chart.defaults.scale.grid.drawTicks = false;
  Chart.defaults.scale.border.display = false;
  Chart.defaults.scale.ticks.padding = 8;
}
/* The chart series palette, read from the theme tokens so a palette change in
   app.css moves the charts with it instead of leaving them behind. */
function vxChartPalette() { return [1, 2, 3, 4, 5, 6, 7, 8].map(vxCat); }
/* Chart.js parses colour strings itself and does not resolve var(), so charts
   cannot reference a token the way markup can. These read the token off the
   root element and hand back a literal. Everything still moves when the token
   moves; the resolution just happens in JS instead of the cascade. */
function vxCat(n) {
  const cs = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  /* Falls back to a keyword rather than a hex literal: repeating a token's
     value here would mean a token change silently leaves this copy behind.
     This path only fires if app.css failed to load at all. */
  return cs("--cat-" + n) || cs("--color-muted") || "gray";
}
/* Translucent fill under a chart line, from the same token. */
function vxCatAlpha(n, a) {
  const h = vxCat(n).replace("#", "");
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const [r, g, b] = (v.match(/../g) || ["4B", "55", "63"]).map(x => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
}
function vxSubtitle(sub) {
  if (!sub) return "";
  const i = sub.indexOf("||");
  if (i < 0) return `<p>${sub}</p>`;
  const head = sub.slice(0, i).trim();
  const more = sub.slice(i + 2).trim().replace(/"/g, "&quot;");
  return `<p>${head} <span class="hintdot" title="${more}">More</span></p>`;
}
/* For pages that re-title themselves at runtime, so they get the same
   "short line + tooltip" treatment as a subtitle passed to vxShell. */
function vxSetSubtitle(text) {
  const el = document.querySelector(".vx-page-head p");
  if (el) el.outerHTML = vxSubtitle(text);
}
function vxShell(title, subtitle, crumbs) {
  const cur = location.pathname.split("/").pop() || "dashboard.html";
  /* Each nav group is a labelled list, so a screen reader announces
     "Configuration, list, 6 items" instead of 41 undifferentiated links.
     aria-current marks the active page — the orange marker beside it is the
     only signal a sighted user gets, and it had no non-visual equivalent.

     Groups collapse/expand independently, remembered per browser
     (localStorage, not tenant-scoped — it's a UI preference, not data) so it
     survives the full page reload every nav click causes on a static site.
     Whatever a user collapsed stays collapsed, EXCEPT the group holding the
     page actually being viewed — that one always renders expanded so a
     stored preference from a prior visit can never hide where you are. */
  const navCollapsed = (() => { try { return JSON.parse(localStorage.getItem("vxNavCollapsed")) || {}; } catch (e) { return {}; } })();
  const nav = NAV.map((g, gi) => {
    const isCurGroup = g.items.some(it => it.h === cur);
    /* A fresh browser has no stored preference for any group — before this,
       that meant every group rendered expanded, so a first-time visit to
       the Dashboard was seven groups deep in nav before you'd even opened a
       quote. Now the untouched default is collapsed, except Rating (the
       group this platform is actually about) and whichever group holds the
       page you're on — a stored preference from an earlier visit still
       wins over both defaults once it exists. */
    const explicit = navCollapsed[g.g];
    const collapsed = !isCurGroup && (explicit !== undefined ? !!explicit : g.g !== "Rating");
    return `<button type="button" class="vx-nav-grp" id="vxNavG${gi}" data-navgrp="${g.g}" aria-expanded="${!collapsed}" aria-controls="vxNavL${gi}">` +
      `<span>${g.g}</span><i class="fa-solid fa-chevron-down chev" aria-hidden="true"></i></button>` +
      `<ul class="vx-nav-list" id="vxNavL${gi}" aria-labelledby="vxNavG${gi}"${collapsed ? " hidden" : ""}>` +
      g.items.map(it => `<li><a href="${it.h}" class="${it.h === cur ? "active" : ""}"` +
        `${it.h === cur ? ' aria-current="page"' : ""}>` +
        `<i class="fa-solid ${it.i}" aria-hidden="true"></i>${it.l}</a></li>`).join("") +
      `</ul>`;
  }).join("");

  // The first crumb segment is always the page's real NAV group, derived
  // here rather than trusted from what each page happened to hardcode —
  // 38 pages had drifted to 19+ ad hoc labels that didn't match any of the
  // 7 real groups below. Whatever a page passes after that first segment
  // (its own page name, and any deeper segment) is kept as-is.
  const navGroup = NAV.find(g => g.items.some(it => it.h === cur));
  const passedCrumbs = crumbs || [];
  const fixedCrumbs = navGroup ? [{ l: navGroup.g }, ...passedCrumbs.slice(1)] : passedCrumbs;
  const cr = fixedCrumbs.map((c, i) => {
    const isLast = i === fixedCrumbs.length - 1;
    const seg = c.h ? `<a href="${c.h}">${c.l}</a>` : `<span class="${isLast ? "cur" : ""}">${c.l}</span>`;
    return seg + (isLast ? "" : '<span class="sep" aria-hidden="true">/</span>');
  }).join("");

  document.getElementById("vxApp").innerHTML = `
  <!-- WCAG 2.4.1 Bypass Blocks: 41 nav links sit before the content on every
       page. Visually hidden until focused, first thing in the tab order. -->
  <a href="#vxMain" class="vx-skip">Skip to main content</a>
  <aside class="vx-sidebar" id="vxSide">
    <div class="vx-brand">
      <div class="vx-logo" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="22" height="22" fill="none">
          <path d="M4 8 L18 32 L22 32 L36 8 L28 8 L20 22 L12 8 Z" style="fill:var(--color-on-brand)"/>
          <path d="M20 22 L28 8 L36 8 L26 26 Z" style="fill:var(--color-on-brand);fill-opacity:.55"/>
        </svg>
      </div>
      <div><b>VeriDex</b><span>${vxTenant().name}</span></div>
    </div>
    <nav class="vx-nav" aria-label="Primary">${nav}</nav>
  </aside>

  <div class="vx-main">
    <header class="vx-topbar">
      <button class="vx-icobtn d-lg-none" aria-label="Open navigation" aria-controls="vxSide" aria-expanded="false"
        onclick="vxToggleNav(this)"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
      <div class="vx-search" role="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input id="vxQ" aria-label="Search products, factors, states and quotes"
          placeholder="Search products, factors, states, quotes..." autocomplete="off"
          role="combobox" aria-expanded="false" aria-controls="vxQR" aria-autocomplete="list">
        <kbd aria-hidden="true">/</kbd>
        <div class="vx-searchres" id="vxQR" role="listbox" aria-label="Search results"></div>
      </div>
      <div class="vx-tb-actions">
        <div style="position:relative">
          <button class="vx-tenant" id="vxTenantBtn" aria-haspopup="true" aria-expanded="false"
            aria-controls="vxTenantPop" aria-label="Switch tenant. Current tenant ${vxTenant().name}">
            <span class="dot" style="background:${vxTenant().accent}" aria-hidden="true"></span>
            <span class="nm">${vxTenant().name}</span>
            <i class="fa-solid fa-chevron-down" style="font-size:9px;opacity:.6" aria-hidden="true"></i>
          </button>
          <div class="vx-pop" id="vxTenantPop" style="width:300px">
            <h6>Tenant <span class="vx-b gray" style="margin-left:auto;font-weight:600">${VX.tenants.length} on this account</span></h6>
            ${VX.tenants.map(t => `<a class="it" href="#" data-tenant="${t.id}" style="text-decoration:none;color:inherit">
              <div class="ic" style="background:${t.accent}"><i class="fa-solid fa-building"></i></div>
              <div style="flex:1"><b style="font-size:12.5px">${t.name}</b>
                <small>${t.plan} · ${t.seats} seats · ${t.lobs.length} LOB${t.lobs.length === 1 ? "" : "s"}</small></div>
              ${t.id === VX.activeTenantId ? '<i class="fa-solid fa-check" style="color:var(--good);align-self:center"></i>' : ""}
            </a>`).join("")}
            <a class="it" href="tenants.html" style="text-decoration:none;color:inherit">
              <div class="ic" style="background:var(--text-mute)"><i class="fa-solid fa-gear"></i></div>
              <div><b style="font-size:12.5px">Manage tenants</b></div></a>
          </div>
        </div>
        <div style="position:relative">
          <button class="vx-icobtn" id="vxNotifBtn" aria-haspopup="true" aria-expanded="false" aria-controls="vxNotif"
            aria-label="Notifications, ${VX.notifications.length} unread"><i class="fa-regular fa-bell" aria-hidden="true"></i><span class="vx-dot" aria-hidden="true"></span></button>
          <div class="vx-pop" id="vxNotif">
            <h6>Notifications <span class="vx-b blue" style="margin-left:auto">${VX.notifications.length} new</span></h6>
            ${VX.notifications.map(n => `<div class="it"><div class="ic" style="background:${n.color}"><i class="fa-solid ${n.icon}"></i></div>
              <div><b style="font-size:12.5px">${n.title}</b><small>${n.desc}</small><small style="opacity:.7">${n.time}</small></div></div>`).join("")}
          </div>
        </div>
        <div style="position:relative">
          <!-- Was a <div> with a click handler: unreachable by keyboard and
               announced as nothing. It is a menu button, so it is one now. -->
          <button class="vx-avatar" id="vxProfBtn" aria-haspopup="true" aria-expanded="false"
            aria-controls="vxProf" aria-label="Account menu for ${vxActiveUser().name}">${vxActiveUser().name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}</button>
          <div class="vx-pop" id="vxProf" style="width:250px">
            <h6>${vxActiveUser().name}</h6>
            <div class="it"><div><b style="font-size:12.5px">${vxActiveUser().role}</b><small>${vxActiveUser().email}</small></div></div>
            <a class="it" href="settings.html#switch-user"><div class="ic" style="background:var(--text-mute)"><i class="fa-solid fa-user-group"></i></div><div><b style="font-size:12.5px">Switch User</b><small>Act as someone else</small></div></a>
            <a class="it" href="settings.html"><div class="ic" style="background:var(--text-mute)"><i class="fa-solid fa-gear"></i></div><div><b style="font-size:12.5px">System Settings</b></div></a>
            <a class="it" href="audit.html"><div class="ic" style="background:var(--text-mute)"><i class="fa-solid fa-clock-rotate-left"></i></div><div><b style="font-size:12.5px">My Activity</b></div></a>
            <a class="it" href="index.html"><div class="ic" style="background:var(--bad)"><i class="fa-solid fa-arrow-right-from-bracket"></i></div><div><b style="font-size:12.5px">Sign Out</b></div></a>
          </div>
        </div>
      </div>
    </header>

    <nav class="vx-crumbs" aria-label="Breadcrumb"><a href="dashboard.html">Home</a><span class="sep" aria-hidden="true">/</span>${cr}</nav>
    <main class="vx-page" id="vxMain" tabindex="-1">
      <div class="vx-page-head vx-anim">
        <div><h1>${title}</h1>${vxSubtitle(subtitle)}</div>
        <div id="vxPageActions" class="d-flex gap-2 flex-wrap"></div>
      </div>
      <div id="vxSetupBanner"></div>
      <div id="vxBody"></div>
    </main>

    <footer class="vx-foot">
      <span>© 2026 Veridex Rating Platform — ${VX.meta.tenant} · ${VX.meta.env} · Build ${VX.meta.build}</span>
      <span>${VX.meta.engine} · <a href="#" onclick="vxShortcuts();return false">Keyboard shortcuts</a></span>
    </footer>
  </div>
  <div class="vx-ov" id="vxOv" aria-hidden="true"></div>
  <div class="vx-ctx" id="vxCtx"></div>
  <div id="vxToasts" aria-live="polite" aria-atomic="false"></div>`;

  document.querySelectorAll(".vx-nav-grp").forEach(btn => btn.onclick = () => {
    const list = document.getElementById(btn.getAttribute("aria-controls"));
    const nowCollapsed = !list.hidden; // was open, this click closes it
    list.hidden = nowCollapsed;
    btn.setAttribute("aria-expanded", String(!nowCollapsed));
    try {
      const state = JSON.parse(localStorage.getItem("vxNavCollapsed") || "{}");
      state[btn.dataset.navgrp] = nowCollapsed;
      localStorage.setItem("vxNavCollapsed", JSON.stringify(state));
    } catch (e) {}
  });

  /* An unconfigured tenant is the single most confusing state to land in —
     every screen looks broken rather than empty-on-purpose. Surface it once,
     platform-wide, on any page except the setup page itself. Only renders
     when tenant-setup.js is loaded, so pages that don't need it pay nothing. */
  if (typeof tenantSetupSteps === "function" && !/tenant-setup\.html/.test(location.pathname)) {
    try {
      const s = tenantSetupSteps();
      if (!s.ready) {
        const el = document.getElementById("vxSetupBanner");
        const missing = s.required.filter(x => !x.done);
        /* Dismissal is remembered per tenant AND per outstanding-step set: close
           it and it stays closed, but if a NEW step falls outstanding that is
           new information and the banner earns its place back. */
        const dismissKey = "vxSetupHide:" + vxTenant().id + ":" + missing.map(x => x.id || x.label).sort().join("|");
        window.vxDismissSetup = () => {
          try { localStorage.setItem(dismissKey, "1"); } catch (e) {}
          const n = document.getElementById("vxSetupBanner"); if (n) n.innerHTML = "";
        };
        let hidden = false;
        try { hidden = localStorage.getItem(dismissKey) === "1"; } catch (e) {}
        if (hidden) return;
        if (el) el.innerHTML = `
          <div class="vx-anim" style="border:1px solid rgba(241,180,76,.45);background:rgba(241,180,76,.07);
            border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--warn);font-size:15px"></i>
            <div style="flex:1;min-width:220px;font-size:12.6px;line-height:1.55">
              <b>${vxTenant().name}</b> setup incomplete —
              <span class="hintdot" title="Outstanding: ${missing.map(x => x.label).join(", ")}. Screens in this tenant will look empty until these are configured.">${missing.length} step${missing.length === 1 ? "" : "s"} left</span>
            </div>
            <a href="tenant-setup.html" class="btn btn-primary btn-sm">Finish setup</a>
            <button type="button" class="vx-icobtn" onclick="vxDismissSetup()" title="Dismiss — comes back only if a new step falls outstanding"
              style="width:28px;height:28px;font-size:12px"><i class="fa-solid fa-xmark"></i></button>
          </div>`;
      }
    } catch (e) { /* never let the banner break the page it sits on */ }
  }

  const pops = [["vxNotifBtn", "vxNotif"], ["vxProfBtn", "vxProf"], ["vxTenantBtn", "vxTenantPop"]];
  /* aria-expanded is kept in step with the class on every path that can close
     a popover — its own toggle, another popover opening, the outside click and
     Escape. An attribute that only updates on one of those paths goes stale
     and misreports, which is worse than not setting it. */
  const syncPops = () => pops.forEach(([b, p]) =>
    vxSetExpanded(b, document.getElementById(p).classList.contains("on")));
  pops.forEach(([b, p]) => {
    document.getElementById(b).onclick = e => {
      e.stopPropagation();
      pops.forEach(([, o]) => { if (o !== p) document.getElementById(o).classList.remove("on"); });
      document.getElementById(p).classList.toggle("on");
      syncPops();
    };
  });
  document.querySelectorAll("#vxTenantPop [data-tenant]").forEach(a => a.onclick = e => {
    e.preventDefault(); e.stopPropagation(); vxSetTenant(a.dataset.tenant);
  });

  document.addEventListener("click", () => {
    pops.forEach(([, p]) => document.getElementById(p).classList.remove("on"));
    document.getElementById("vxQR").classList.remove("on");
    document.getElementById("vxCtx").classList.remove("on");
    syncPops();
    vxSetExpanded("vxQ", false);
  });

  /* WCAG 2.1.2 / 2.1.4: every popover and menu must be dismissible from the
     keyboard, not only by clicking elsewhere. Focus returns to the trigger
     that opened it rather than being dropped at the top of the document. */
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const open = pops.find(([, p]) => document.getElementById(p).classList.contains("on"));
    if (open) {
      document.getElementById(open[1]).classList.remove("on");
      syncPops();
      document.getElementById(open[0]).focus();
    }
    const qr = document.getElementById("vxQR");
    if (qr && qr.classList.contains("on")) {
      qr.classList.remove("on");
      vxSetExpanded("vxQ", false);
      document.getElementById("vxQ").focus();
    }
    const ctx = document.getElementById("vxCtx");
    if (ctx) ctx.classList.remove("on");
  });

  vxSearchInit();
  vxKeys();
}

/* ---------- global search ---------- */
function vxSearchIndex() {
  const ix = [];
  NAV.forEach(g => g.items.forEach(i => ix.push({ t: i.l, s: "Page · " + g.g, h: i.h, ic: i.i })));
  VX.products.forEach(p => ix.push({ t: p.name, s: "Product · " + p.lob, h: "products.html", ic: "fa-cubes" }));
  VX.lobs.forEach(l => ix.push({ t: l.name, s: "Line of Business", h: "lob.html", ic: "fa-layer-group" }));
  VX.states.forEach(s => ix.push({ t: s.name, s: "State · " + s.abv, h: "states.html", ic: "fa-flag-usa" }));
  VX.ratingFactors.slice(0, 120).forEach(f => ix.push({ t: f.name, s: "Rating Factor · " + f.category, h: "factors.html", ic: "fa-sliders" }));
  VX.quotes.slice(0, 60).forEach(q => ix.push({ t: q.quoteNo + " — " + q.insured, s: "Quote · " + q.product, h: "quotes.html", ic: "fa-file-invoice" }));
  (VX.taxes || []).forEach(t => ix.push({ t: t.stateName + " Tax", s: "Surplus Lines Tax · " + t.surplusTax.toFixed(2) + "%", h: "taxes.html", ic: "fa-percent" }));
  (VX.discounts || []).forEach(d => ix.push({ t: d.name, s: "Discount · " + d.lob, h: "discounts.html", ic: "fa-tags" }));
  (VX.surcharges || []).forEach(s => ix.push({ t: s.name, s: "Surcharge · " + s.lob, h: "surcharges.html", ic: "fa-triangle-exclamation" }));
  (VX.fees || []).forEach(f => ix.push({ t: f.name, s: "Fee · " + f.lob, h: "fees.html", ic: "fa-file-invoice-dollar" }));
  (VX.versions || []).forEach(v => ix.push({ t: v.product + " " + v.version, s: "Rating Version · " + v.status, h: "versions.html", ic: "fa-code-branch" }));
  (VX.savedFormulas || []).forEach(f => ix.push({ t: f.name, s: "Formula · " + f.lob, h: "formula-builder.html", ic: "fa-square-root-variable" }));
  (VX.counties || []).slice(0, 150).forEach(c => ix.push({ t: c.name + ", " + c.state, s: "County", h: "counties.html", ic: "fa-map" }));
  (VX.territories || []).forEach(t => ix.push({ t: t.code + " — " + t.name, s: "Territory · " + t.state, h: "territories.html", ic: "fa-map-location-dot" }));
  (VX.zipcodes || []).slice(0, 100).forEach(z => ix.push({ t: z.zip + " — " + z.city, s: "ZIP Code · " + z.state, h: "zipcodes.html", ic: "fa-location-dot" }));
  (VX.industryClasses || []).slice(0, 150).forEach(c => ix.push({ t: c.code + " — " + c.name, s: "Industry Class · " + c.lob, h: "industry-classes.html", ic: "fa-industry" }));
  (VX.cob || []).slice(0, 150).forEach(c => ix.push({ t: c.name, s: "Coverage · " + c.lob, h: "coverages.html", ic: "fa-sitemap" }));
  return ix;
}
let _ix = null;
function vxSearchInit() {
  const q = document.getElementById("vxQ"), r = document.getElementById("vxQR");
  if (!q) return;
  /* The result count is announced through a polite live region. Typing into a
     search box that silently repopulates below it tells a screen-reader user
     nothing; "7 results" does. Polite, so it waits for a pause in typing. */
  q.oninput = () => {
    const v = q.value.trim().toLowerCase();
    if (!v) { r.classList.remove("on"); vxSetExpanded("vxQ", false); vxAnnounce(""); return; }
    _ix = _ix || vxSearchIndex();
    const hits = _ix.filter(x => x.t.toLowerCase().includes(v) || x.s.toLowerCase().includes(v)).slice(0, 9);
    r.innerHTML = hits.length
      ? hits.map(h => `<a href="${h.h}" role="option"><i class="fa-solid ${h.ic}" style="width:15px;color:var(--text-mute)" aria-hidden="true"></i>
          <span>${h.t}</span><span class="t">${h.s}</span></a>`).join("")
      : `<div style="padding:14px;color:var(--text-mute);font-size:12.5px">No results for "${q.value}"</div>`;
    r.classList.add("on");
    vxSetExpanded("vxQ", true);
    vxAnnounce(hits.length ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "No results");
  };
  q.onclick = e => {
    e.stopPropagation();
    if (q.value.trim()) { r.classList.add("on"); vxSetExpanded("vxQ", true); }
  };
}

function vxShortcutHelp() {
  const rows = [
    ["/", "Focus search"], ["Ctrl/Cmd + K", "Focus search"], ["Ctrl/Cmd + S", "Save the open dialog"],
    ["Esc", "Close search results / context menu"], ["Shift + D", "Dashboard"], ["Shift + P", "Products"],
    ["Shift + F", "Rating Factors"], ["Shift + Q", "Sandbox Quote"], ["Shift + A", "AI Assistant"], ["Shift + R", "Reports"],
    ["?", "Show this list"],
  ];
  vxModal("Keyboard Shortcuts", `<div class="vx-tw"><table class="vx-t"><tbody>
    ${rows.map(([k, d]) => `<tr><td style="width:160px"><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}
    </tbody></table></div>`, [{ t: "Close", c: "secondary" }], "modal-md");
}

/* ---------- keyboard shortcuts ---------- */
function vxKeys() {
  document.addEventListener("keydown", e => {
    const typing = /input|textarea|select/i.test(e.target.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); document.getElementById("vxQ")?.focus(); }
    if (e.key === "Escape") {
      document.getElementById("vxQR")?.classList.remove("on");
      document.getElementById("vxCtx")?.classList.remove("on");
    }
    if (!typing && e.shiftKey) {
      const map = { D: "dashboard.html", P: "products.html", F: "factors.html", Q: "quote-portal.html", A: "ai-assistant.html", R: "analytics.html" };
      if (map[e.key.toUpperCase()]) { e.preventDefault(); location.href = map[e.key.toUpperCase()]; }
    }
    // Ctrl/Cmd+S — commit whatever modal is open (every vxModal's non-dismiss
    // button is its primary save/confirm/publish action), not gated on
    // `typing` since the common case is saving from inside a form field.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      const primaryBtn = document.querySelector("#vxModal .modal-footer button:not([data-bs-dismiss])");
      if (primaryBtn) { e.preventDefault(); primaryBtn.click(); }
    }
    if (e.key === "?" && !typing) { e.preventDefault(); vxShortcutHelp(); }
    if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("vxQ")?.focus(); }
  });
}
function vxShortcuts() {
  vxModal("Keyboard Shortcuts", `
    <table class="vx-t"><tbody>
      ${[["/ or Ctrl+K","Focus global search"],["Shift+D","Go to Dashboard"],["Shift+P","Go to Products"],["Shift+F","Go to Rating Factors"],["Shift+Q","Go to Quote Portal"],["Shift+A","Go to AI Assistant"],["Shift+R","Go to Reports & Analytics"],["Esc","Close popovers"],["Right-click row","Context menu"]]
        .map(([k, d]) => `<tr><td style="width:150px"><kbd style="border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;background:var(--surface-2)">${k}</kbd></td><td>${d}</td></tr>`).join("")}
    </tbody></table>`, [{ t: "Close", c: "secondary" }]);
}

/* Keeps aria-expanded honest on the popover triggers. A trigger that always
   reads "collapsed" is worse than no attribute — it actively misreports. */
function vxSetExpanded(btnId, open) {
  const b = document.getElementById(btnId);
  if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
}
/* One shared polite live region for things that change on screen without a
   toast: result counts, filtered row counts, async completions. Each call
   replaces the last message rather than queueing, so a fast typist hears the
   final count instead of every intermediate one. */
function vxAnnounce(msg) {
  let el = document.getElementById("vxLive");
  if (!el) {
    el = document.createElement("div");
    el.id = "vxLive";
    el.className = "vx-sr";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
  }
  el.textContent = msg;
}
/* ==========================================================================
   Uploaded JSON configuration.

   Reads an external configuration file (product_lob / coverage_class), maps
   it onto this platform's internal LOB codes and per-line class fields, and
   persists the parsed result to localStorage.

   ASSUMPTION, stated because no real sample payload exists yet: `product_lob`
   is matched against both VX.lobs' `code` ("TRUCK") and full `name`
   ("Commercial Trucking"), case-insensitively — those are the only two LOB
   spellings anywhere else on this platform, so one of them is the most likely
   real value. `coverage_class` is matched, per LOB, against the one field
   that actually functions as a "class" in that line's engine: truckRatingClass
   for Commercial Trucking, industryClasses (by code) for General Liability.
   Property, MPL and Cyber have no single "class" concept in engine.js — their
   pricing keys off construction/occupancy, hazard group, and industry instead
   — so a coverage_class on those lines is accepted and stored, but flagged as
   not applicable rather than forced into an unrelated field. This mapping
   needs to be checked against a real payload before this is treated as
   correct for an actual integration. */

const VX_UPLOAD_KEY = "vxUploadedConfig";

/* per-LOB class validators — returns the matched record, or null */
function vxResolveCoverageClass(lobCode, coverageClass) {
  if (!coverageClass) return null;
  const cc = String(coverageClass).trim();
  if (lobCode === "TRUCK") {
    return (VX.truckRatingClass || []).find(r =>
      r.ratingClass.toLowerCase() === cc.toLowerCase()) || null;
  }
  if (lobCode === "GL") {
    return (VX.industryClasses || []).find(r => r.code === cc) || null;
  }
  if (lobCode === "WC") {
    return (VX.wcClassRates || []).find(r => r.classCode === cc) || null;
  }
  return null; // no single "class" field for PROP / MPL / CYBER
}

/* Maps { product_lob, coverage_class, ...rest } onto this platform's
   internal shape. Never partially applies: a payload that resolves a LOB but
   not the fields under it still returns ok:true (the LOB alone is usable),
   but a payload that fails to resolve a LOB returns ok:false with a reason —
   nothing is written to localStorage or into any page's state in that case. */
function vxMapUploadedConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Not a JSON object." };
  }
  const wantLob = raw.product_lob;
  if (!wantLob) {
    return { ok: false, reason: "Missing required field: product_lob." };
  }
  const w = String(wantLob).trim().toLowerCase();
  const lobRow = (VX.lobs || []).find(l =>
    l.code.toLowerCase() === w || l.name.toLowerCase() === w);
  if (!lobRow) {
    const known = [...new Set((VX.lobs || []).map(l => l.code + " (" + l.name + ")"))].join(", ");
    return { ok: false, reason: `Unrecognized product_lob "${wantLob}". Known: ${known}.` };
  }

  const classRow = vxResolveCoverageClass(lobRow.code, raw.coverage_class);
  const classApplicable = ["TRUCK", "GL", "WC"].includes(lobRow.code);
  const classResolved = !!classRow;

  return {
    ok: true,
    lobCode: lobRow.code,
    lobName: lobRow.name,
    coverageClass: raw.coverage_class || null,
    coverageClassApplicable: classApplicable,
    coverageClassResolved: classResolved,
    coverageClassWarning: (raw.coverage_class && classApplicable && !classResolved)
      ? `coverage_class "${raw.coverage_class}" is not a known class for ${lobRow.name}.`
      : (raw.coverage_class && !classApplicable)
      ? `${lobRow.name} has no single "class" concept — coverage_class was stored but not applied.`
      : null,
    raw,
  };
}

/* FileReader -> JSON.parse, as a Promise. Shared by every upload entry point
   so there is exactly one place that decides what counts as a valid file. */
function vxParseJsonUpload(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error("No file selected.")); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error("File is larger than 5 MB.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(reader.result); }
      catch (e) { reject(new Error("Not valid JSON: " + e.message)); return; }
      resolve(obj);
    };
    reader.readAsText(file);
  });
}

function vxSaveUploadedConfig(mapped) {
  try {
    localStorage.setItem(VX_UPLOAD_KEY, JSON.stringify({ ...mapped, savedAt: new Date().toISOString() }));
  } catch (e) {}
}
function vxLoadUploadedConfig() {
  try { return JSON.parse(localStorage.getItem(VX_UPLOAD_KEY) || "null"); }
  catch (e) { return null; }
}
function vxClearUploadedConfig() {
  try { localStorage.removeItem(VX_UPLOAD_KEY); } catch (e) {}
}

function vxToggleNav(btn) {
  const open = document.getElementById("vxSide").classList.toggle("on");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
}

/* ---------- toasts ---------- */
function vxToast(title, desc, kind = "ok") {
  const holder = document.getElementById("vxToasts");
  if (!holder) return;
  const ic = { ok: "fa-circle-check", err: "fa-circle-exclamation", warn: "fa-triangle-exclamation", info: "fa-circle-info" }[kind];
  const el = document.createElement("div");
  el.className = "vx-toast " + kind;
  /* An error interrupts; a save confirmation waits its turn. Announcing every
     toast assertively would talk over whatever the user is reading. */
  el.setAttribute("role", kind === "err" ? "alert" : "status");
  el.innerHTML = `<i class="fa-solid ${ic}" aria-hidden="true"></i><div><b>${title}</b>${desc ? `<small>${desc}</small>` : ""}</div>`;
  holder.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; el.style.transition = ".25s"; setTimeout(() => el.remove(), 260); }, 3200);
}

/* ---------- modal ---------- */
function vxModal(title, body, buttons, size) {
  let root = document.getElementById("vxModalRoot");
  if (!root) { root = document.createElement("div"); root.id = "vxModalRoot"; document.body.appendChild(root); }
  const btns = (buttons || [{ t: "Close", c: "secondary" }]).map((b, i) =>
    `<button class="btn btn-${b.c || "secondary"}" ${b.c === "secondary" ? 'data-bs-dismiss="modal"' : ""} id="vxMB${i}">${b.t}</button>`).join("");
  /* Bootstrap traps focus and returns it to the trigger on hide; what it does
     not do is name the dialog or its close button. aria-labelledby points at
     the visible title so the dialog announces as itself rather than "dialog". */
  root.innerHTML = `<div class="modal fade" tabindex="-1" id="vxModal"
    role="dialog" aria-modal="true" aria-labelledby="vxModalTitle">
    <div class="modal-dialog ${size || "modal-lg"} modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="vxModalTitle">${title}</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close dialog"></button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">${btns}</div>
      </div></div></div>`;
  const el = document.getElementById("vxModal");
  const m = new bootstrap.Modal(el);
  (buttons || []).forEach((b, i) => {
    if (b.fn) document.getElementById("vxMB" + i).onclick = () => { if (b.fn(m) !== false) m.hide(); };
  });
  m.show();
  return m;
}

function vxConfirm(title, msg, onYes, danger) {
  vxModal(title, `<div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:40px;height:40px;border-radius:10px;flex:none;display:grid;place-items:center;background:${danger ? "var(--color-danger-bg)" : "var(--color-brand-light)"};color:${danger ? "var(--color-danger)" : "var(--color-link)"}" aria-hidden="true">
        <i class="fa-solid ${danger ? "fa-triangle-exclamation" : "fa-circle-question"}"></i></div>
      <div style="font-size:13.5px;line-height:1.6">${msg}</div></div>`,
    [{ t: "Cancel", c: "secondary" }, { t: danger ? "Delete" : "Confirm", c: danger ? "danger" : "primary", fn: () => { onYes(); } }], "modal-md");
}

/* ---------- context menu ---------- */
function vxCtxMenu(e, items) {
  e.preventDefault();
  const m = document.getElementById("vxCtx");
  m.innerHTML = items.map((i, k) => i.sep ? `<hr style="margin:4px 6px;border-color:var(--border)">`
    : `<button data-k="${k}"><i class="fa-solid ${i.i}"></i>${i.t}</button>`).join("");
  m.style.left = Math.min(e.clientX, innerWidth - 190) + "px";
  m.style.top = Math.min(e.clientY, innerHeight - items.length * 34 - 12) + "px";
  m.classList.add("on");
  m.querySelectorAll("[data-k]").forEach(b => b.onclick = ev => {
    ev.stopPropagation(); m.classList.remove("on"); items[+b.dataset.k].fn?.();
  });
}

/* ---------- loading ---------- */
function vxLoading(sel, msg) {
  const el = typeof sel === "string" ? document.querySelector(sel) : sel;
  if (el) el.innerHTML = `<div class="vx-load"><span class="vx-spin"></span>${msg || "Loading..."}</div>`;
}

/* ---------- autosave indicator ---------- */
let _asT;
/* ---------- Audit writing ----------
   The Audit History screen was reading a purely seeded log: real changes made
   through the UI never reached it, so the one screen whose job is "who
   changed what" could not answer that for anything a user had actually done.
   These append REAL entries and persist them, so an edit survives the
   navigation to the audit screen that is meant to show it.

   Kept deliberately small and generic — any page that mutates configuration
   can call vxAudit(); factor edits additionally write the purpose-built
   before/after row that the Loss Run and factor-history views read. */
/* Which of VX.users this browser is acting as — same shape as the tenant
   switcher (VX.activeTenantId), persisted, defaulting to the platform's own
   Rating Administrator so every existing screen keeps working unchanged
   until someone actually switches. This is what makes the approval flows
   (factor changes, lookup-table row changes, table values, formulas) usable
   through the real UI at all: every one of them blocks approving your own
   request, and a single-user prototype had no way to become a second user
   to approve as, short of a browser console. */
function vxActiveUser() {
  const byId = VX.activeUserId && (VX.users || []).find(u => u.id === VX.activeUserId);
  return byId || (VX.users || []).find(x => x.role === "Rating Administrator") || (VX.users || [])[0];
}
function vxCurrentUser() {
  const u = vxActiveUser();
  return (u && u.email) || "unknown@veridex.io";
}
function vxSetActiveUser(id) {
  const u = (VX.users || []).find(x => x.id === +id);
  if (!u) return;
  VX.activeUserId = u.id;
  try { localStorage.setItem("vxActiveUserId", JSON.stringify(u.id)); } catch (e) {}
  vxToast("Switched user", `Now acting as ${u.name} · ${u.role}`, "ok");
  setTimeout(() => location.reload(), 550);
}
function vxNowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function vxAudit(area, action, detail, extra) {
  try {
    VX.audit = VX.audit || [];
    const rec = { id: Math.max(0, ...VX.audit.map(a => +a.id || 0)) + 1,
      timestamp: vxNowStamp(), user: vxCurrentUser(), area, action, detail,
      version: (extra && extra.version) || "—", ip: "local", ...(extra || {}) };
    VX.audit.unshift(rec);
    localStorage.setItem("vxAuditState", JSON.stringify(VX.audit.slice(0, 500)));
    return rec;
  } catch (e) { return null; }
}
/* Records a factor's value actually moving. Writes BOTH logs: the generic
   audit trail (so Audit History shows it) and the factor change log (so the
   before/after and % change are queryable). Silent when nothing changed —
   an edit that touches a label should not fabricate a rate change. */
function vxLogFactorChange(before, after, reason) {
  const from = before ? before.defaultValue : null;
  const to = after ? after.defaultValue : null;
  const changed = String(from ?? "") !== String(to ?? "");
  const name = (after && after.name) || (before && before.name) || "Rating factor";
  if (changed) {
    try {
      VX.factorChangeLog = VX.factorChangeLog || [];
      VX.factorChangeLog.unshift({
        id: Math.max(0, ...VX.factorChangeLog.map(r => +r.id || 0)) + 1,
        timestamp: vxNowStamp(), user: vxCurrentUser(),
        factorCode: after.code, factorName: name, lob: after.lob, state: "All",
        from: from == null ? "" : +from, to: to == null ? "" : +to,
        pctChange: (from && to) ? +(((to / from) - 1) * 100).toFixed(1) : 0,
        reason: reason || "Edited on the Rating Factors screen",
        version: (after.attachments && after.attachments[0] && after.attachments[0].ratingVersion) || "—" });
      localStorage.setItem("vxFactorChangeLog", JSON.stringify(VX.factorChangeLog.slice(0, 500)));
    } catch (e) {}
  }
  vxAudit("Rating Factors",
    !before ? "Created new record" : (changed ? "Updated factor value" : "Edited factor definition"),
    !before ? `${name} (${after.code}) created — default ${to ?? "none"}`
            : (changed ? `${name} (${after.code}): ${from ?? "none"} → ${to ?? "none"}`
                       : `${name} (${after.code}) edited — no change to its value`),
    { version: (after && after.attachments && after.attachments[0] && after.attachments[0].ratingVersion) || "—" });
}

/* ---------- Factor change approval ----------
   A factor change is requested, then approved by someone else, and takes
   effect from a date rather than the instant it is saved. See the block on
   D.factorChangeRequests in data.js for why, and for the honest note on what
   an approved change does and does not move. */
function vxSaveFactorRequests() {
  try { localStorage.setItem("vxFactorChangeRequests", JSON.stringify(VX.factorChangeRequests)); } catch (e) {}
}
function vxPendingFactorRequest(code) {
  return (VX.factorChangeRequests || []).find(r => r.factorCode === code && r.status === "Pending") || null;
}
/* Raise a change for approval. Returns the request; does NOT apply it. */
function vxRequestFactorChange(factor, newValue, effectiveFrom, reason) {
  VX.factorChangeRequests = VX.factorChangeRequests || [];
  const rec = {
    id: Math.max(0, ...VX.factorChangeRequests.map(r => +r.id || 0)) + 1,
    factorCode: factor.code, factorName: factor.name, lob: factor.lob,
    from: factor.defaultValue == null ? null : +factor.defaultValue,
    to: +newValue,
    effectiveFrom: effectiveFrom || (VX.referenceDate || new Date().toISOString().slice(0, 10)),
    reason: reason || "",
    requestedBy: vxCurrentUser(), requestedOn: vxNowStamp(),
    status: "Pending", decidedBy: null, decidedOn: null,
  };
  VX.factorChangeRequests.unshift(rec);
  vxSaveFactorRequests();
  vxAudit("Rating Factors", "Change requested",
    `${factor.name} (${factor.code}): ${rec.from ?? "none"} → ${rec.to}, effective ${rec.effectiveFrom} — awaiting approval`);
  return rec;
}
/* The effective date a REQUEST proposes is picked at request time, defaulting
   to that day. A request can sit pending for a while, so by the time someone
   actually approves it that date may already be in the past — approving it
   unchanged would open a value window that starts before it was ever signed
   off. The approver is the one who knows when it is really going live, so
   this hands them a sensible default instead of the stale one: whichever is
   LATER, the date originally requested or today. A genuine future filing
   (requested date still ahead of today) is left alone. */
function vxSuggestedApprovalDate(req) {
  const today = VX.referenceDate || new Date().toISOString().slice(0, 10);
  return req.effectiveFrom > today ? req.effectiveFrom : today;
}

/* Approve: close the value in force and open the new one from its effective
   date. The old value is kept, never overwritten, so a quote rate-locked
   before the change can still be shown the value it was priced on.
   `effectiveFrom`, if given, overrides the date the request proposed — see
   vxSuggestedApprovalDate above for why the approver gets the final say. */
function vxApproveFactorChange(reqId, note, effectiveFrom) {
  const req = (VX.factorChangeRequests || []).find(r => r.id === reqId);
  if (!req || req.status !== "Pending") return null;
  const f = (VX.ratingFactors || []).find(x => x.code === req.factorCode);
  if (!f) return null;

  /* Self-approval is the one thing an approval step exists to prevent. */
  if (req.requestedBy === vxCurrentUser()) {
    vxToast("Can't approve your own change", "A second person has to sign this off — that is what the step is for.", "err");
    return null;
  }

  /* Pure calendar arithmetic — no Date object. Date("YYYY-MM-DD") parses as
     UTC midnight, but setDate()/toISOString() round-trip through the LOCAL
     timezone, so west of UTC this silently landed a day early (closed the
     prior value on the 30th for a change effective the 1st). A rate-lock
     boundary is exactly where an off-by-one is expensive, so it's computed
     in local calendar terms instead of through a timezone conversion. */
  const dayBefore = d => {
    const [y, m, day] = d.split("-").map(Number);
    const dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let yy = y, mm = m, dd = day - 1;
    if (dd < 1) { mm -= 1; if (mm < 1) { mm = 12; yy -= 1; } dd = dim[mm - 1]; }
    return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  };
  const goLive = effectiveFrom || req.effectiveFrom;
  f.valueHistory = f.valueHistory || [];
  f.valueHistory.filter(v => !v.effectiveEnd).forEach(v => { v.effectiveEnd = dayBefore(goLive); });
  f.valueHistory.push({ value: req.to, effectiveStart: goLive, effectiveEnd: "",
    approvedBy: vxCurrentUser(), requestedBy: req.requestedBy, note: req.reason || "" });
  f.defaultValue = req.to;
  f.updatedBy = req.requestedBy;
  f.updatedOn = req.requestedOn;

  req.status = "Approved"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  req.effectiveFromRequested = req.effectiveFrom;   // what was asked for, kept for the record
  req.effectiveFrom = goLive;                        // what actually went live
  vxSaveFactorRequests();
  try { localStorage.setItem("vxCustomFactors", JSON.stringify(VX.customFactors || [])); } catch (e) {}
  vxAudit("Rating Factors", "Change approved",
    `${req.factorName} (${req.factorCode}): ${req.from ?? "none"} → ${req.to}, in force from ${goLive}`
    + (goLive !== req.effectiveFromRequested ? ` (requested ${req.effectiveFromRequested})` : "")
    + ` — requested by ${req.requestedBy}`);
  vxLogFactorChange({ ...f, defaultValue: req.from }, f, req.reason || "Approved change request");
  return req;
}
function vxRejectFactorChange(reqId, note) {
  const req = (VX.factorChangeRequests || []).find(r => r.id === reqId);
  if (!req || req.status !== "Pending") return null;
  req.status = "Rejected"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  vxSaveFactorRequests();
  vxAudit("Rating Factors", "Change rejected",
    `${req.factorName} (${req.factorCode}): proposed ${req.from ?? "none"} → ${req.to} was rejected${note ? " — " + note : ""}`);
  return req;
}

/* Pure calendar arithmetic — no Date object. Shared by the factor and
   lookup-table approval flows so a rate-lock boundary is computed the same
   way everywhere: Date("YYYY-MM-DD") parses as UTC midnight, but
   setDate()/toISOString() round-trip through the LOCAL timezone, which west
   of UTC silently lands a day early. */
function vxDayBefore(d) {
  const [y, m, day] = d.split("-").map(Number);
  const dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let yy = y, mm = m, dd = day - 1;
  if (dd < 1) { mm -= 1; if (mm < 1) { mm = 12; yy -= 1; } dd = dim[mm - 1]; }
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/* ---------- Lookup table row-change approval ----------
   Same governance shape as the factor-change block above, applied to a
   single row on an admin-defined Lookup Table instead of a factor's Default
   Value: a row edit or delete is requested, then approved by someone else,
   and only then takes effect from an effective date. Adding a brand-new row
   stays immediate — nothing was relying on a row that did not exist yet —
   the same distinction Rating Factors draws between creating a factor
   (immediate) and changing an existing one's value (gated). Approving does
   not overwrite the row in place; it closes the current revision and opens
   a new one (see VX.lookupRowsAsOf in data.js), so a table keeps every
   revision of a row rather than losing the one a quote might have been
   priced on. */
function vxSaveLookupRequests() {
  try { localStorage.setItem("vxLookupChangeRequests", JSON.stringify(VX.lookupChangeRequests)); } catch (e) {}
}
function vxPendingLookupRequest(tableId, rowId) {
  return (VX.lookupChangeRequests || []).find(r => r.tableId === tableId && r.rowId === rowId && r.status === "Pending") || null;
}
/* `after` null means this is a delete request. Returns the request; does
   NOT apply it — the row keeps showing `before` until someone else approves. */
function vxRequestLookupRowChange(table, rowId, before, after, effectiveFrom, reason) {
  VX.lookupChangeRequests = VX.lookupChangeRequests || [];
  const rec = {
    id: Math.max(0, ...VX.lookupChangeRequests.map(r => +r.id || 0)) + 1,
    tableId: table.id, tableName: table.name, rowId,
    action: after ? "edit" : "delete",
    before: before ? { ...before } : null,
    after: after ? { ...after } : null,
    effectiveFrom: effectiveFrom || (VX.referenceDate || new Date().toISOString().slice(0, 10)),
    reason: reason || "",
    requestedBy: vxCurrentUser(), requestedOn: vxNowStamp(),
    status: "Pending", decidedBy: null, decidedOn: null,
  };
  VX.lookupChangeRequests.unshift(rec);
  vxSaveLookupRequests();
  vxAudit("Lookup Tables", "Row change requested",
    `${table.name}: ${rec.action === "delete" ? "delete row" : "edit row"}, effective ${rec.effectiveFrom} — awaiting approval`);
  return rec;
}
/* Same "later of requested date or today" default as vxSuggestedApprovalDate
   — a request sitting pending long enough can have its requested date slip
   into the past before anyone signs it off. */
function vxSuggestedLookupApprovalDate(req) {
  const today = VX.referenceDate || new Date().toISOString().slice(0, 10);
  return req.effectiveFrom > today ? req.effectiveFrom : today;
}
function vxApproveLookupRowChange(reqId, note, effectiveFrom) {
  const req = (VX.lookupChangeRequests || []).find(r => r.id === reqId);
  if (!req || req.status !== "Pending") return null;
  const table = (VX.lookupTables || []).find(t => t.id === req.tableId);
  if (!table) return null;

  if (req.requestedBy === vxCurrentUser()) {
    vxToast("Can't approve your own change", "A second person has to sign this off — that is what the step is for.", "err");
    return null;
  }

  const goLive = effectiveFrom || req.effectiveFrom;
  table.data = table.data || [];
  // Close whichever revision of this row is currently open — there should
  // only ever be one, but close every open one defensively rather than
  // assume the invariant held.
  table.data.filter(r => r.__rowId === req.rowId && !r.effectiveEnd)
    .forEach(r => { r.effectiveEnd = vxDayBefore(goLive); });
  if (req.action === "edit") {
    table.data.push({ ...req.after, __rowId: req.rowId, effectiveStart: goLive, effectiveEnd: "" });
  }
  // A delete just lets the closed revision fall out of VX.lookupRowsAsOf from
  // goLive onward — no replacement row is pushed.
  table.rows = VX.lookupRowsAsOf(table).length;

  req.status = "Approved"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  req.effectiveFromRequested = req.effectiveFrom;   // what was asked for, kept for the record
  req.effectiveFrom = goLive;                        // what actually went live
  vxSaveLookupRequests();
  try { localStorage.setItem("vxLookupTables", JSON.stringify(VX.lookupTables)); } catch (e) {}
  vxAudit("Lookup Tables", "Row change approved",
    `${req.tableName}: ${req.action === "delete" ? "row deleted" : "row updated"}, in force from ${goLive}`
    + (goLive !== req.effectiveFromRequested ? ` (requested ${req.effectiveFromRequested})` : "")
    + ` — requested by ${req.requestedBy}`);
  return req;
}
function vxRejectLookupRowChange(reqId, note) {
  const req = (VX.lookupChangeRequests || []).find(r => r.id === reqId);
  if (!req || req.status !== "Pending") return null;
  req.status = "Rejected"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  vxSaveLookupRequests();
  vxAudit("Lookup Tables", "Row change rejected",
    `${req.tableName}: proposed ${req.action} was rejected${note ? " — " + note : ""}`);
  return req;
}

/* Writes one value into a nested table by path — shared by factors.html
   (building the request) and vxApproveFactorTableChange below (applying an
   approved one), so the two can never read the shape of a path differently. */
function vxSetPath(root, path, value) {
  let n = root;
  for (let i = 0; i < path.length - 1; i++) n = n[path[i]];
  n[path[path.length - 1]] = value;
}

/* ---------- Rating factor TABLE-VALUE approval ----------
   A Lookup factor's Default Value going through vxRequestFactorChange above
   was never the whole story: the actual numbers engine.js reads at rating
   time live in VX[tableId] (VX.truckFleetSize and so on), edited from
   factors.html's "Edit values" / "Add value" popups — and until now those
   wrote straight into that table, live, with no approval step at all, even
   though this is the ONE place on this screen that is unambiguously wired
   (Default Value and a Lookup Table's rows are not). Same governance shape
   as the other two: raised, approved by someone else, applied — reusing
   D.factorChangeRequests (a `kind` field tells the two apart) so factors.html
   has one approvals queue, not three. Approving still writes immediately
   (nothing in engine.js resolves a table value "as of" a date, exactly like
   Default Value above — effectiveFrom here is record-keeping, the same
   honest limit already disclosed on the Default Value flow), which is what
   keeps this safe: VX[tableId]'s shape is never touched, only reached
   through vxSetPath at the moment someone approves. */
function vxRequestFactorTableChange(factor, edits, newRow, newRowFlatKey, effectiveFrom, reason) {
  VX.factorChangeRequests = VX.factorChangeRequests || [];
  const rec = {
    id: Math.max(0, ...VX.factorChangeRequests.map(r => +r.id || 0)) + 1,
    kind: "tableValues",
    factorCode: factor.code, factorName: factor.name, lob: factor.lob, tableId: factor.tableId,
    // `newRowFlatKey` set means the table is a flat {key: number} map and
    // this is the key to add — distinct from an ordinary row object that
    // could legitimately have its own field literally called "key".
    edits: edits || null, newRow: newRow || null, newRowFlatKey: newRowFlatKey || null,
    effectiveFrom: effectiveFrom || (VX.referenceDate || new Date().toISOString().slice(0, 10)),
    reason: reason || "",
    requestedBy: vxCurrentUser(), requestedOn: vxNowStamp(),
    status: "Pending", decidedBy: null, decidedOn: null,
  };
  VX.factorChangeRequests.unshift(rec);
  vxSaveFactorRequests();
  const summary = newRow ? "add a value" : `${(edits || []).length} value${(edits || []).length === 1 ? "" : "s"} changed`;
  vxAudit("Rating Factors", "Table value change requested",
    `${factor.name} (${factor.code}): ${summary} in ${factor.tableId}, effective ${rec.effectiveFrom} — awaiting approval`);
  return rec;
}
function vxApproveFactorTableChange(reqId, note, effectiveFrom) {
  const req = (VX.factorChangeRequests || []).find(r => r.id === reqId && r.kind === "tableValues");
  if (!req || req.status !== "Pending") return null;
  const f = (VX.ratingFactors || []).find(x => x.code === req.factorCode);
  const table = req.tableId && VX[req.tableId];
  if (!f || !table) return null;

  if (req.requestedBy === vxCurrentUser()) {
    vxToast("Can't approve your own change", "A second person has to sign this off — that is what the step is for.", "err");
    return null;
  }

  const goLive = effectiveFrom || req.effectiveFrom;
  let n = 0;
  if (req.newRow) {
    if (req.newRowFlatKey != null) table[req.newRowFlatKey] = req.newRow.value;
    else if (Array.isArray(table)) table.push(req.newRow);
    f.rowCount = (f.rowCount || 0) + 1;
    n = 1;
  } else if (req.edits) {
    req.edits.forEach(e => { vxSetPath(table, e.path, e.to); });
    n = req.edits.length;
  }
  f.valueEffectiveDate = goLive;

  req.status = "Approved"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  req.effectiveFromRequested = req.effectiveFrom;
  req.effectiveFrom = goLive;
  vxSaveFactorRequests();
  vxAudit("Rating Factors", "Table value change approved",
    `${req.factorName} (${req.factorCode}): ${n} value${n === 1 ? "" : "s"} written to ${req.tableId}, effective ${goLive}`
    + (goLive !== req.effectiveFromRequested ? ` (requested ${req.effectiveFromRequested})` : "")
    + ` — requested by ${req.requestedBy}`);
  return req;
}
function vxRejectFactorTableChange(reqId, note) {
  const req = (VX.factorChangeRequests || []).find(r => r.id === reqId && r.kind === "tableValues");
  if (!req || req.status !== "Pending") return null;
  req.status = "Rejected"; req.decidedBy = vxCurrentUser(); req.decidedOn = vxNowStamp(); req.decisionNote = note || "";
  vxSaveFactorRequests();
  vxAudit("Rating Factors", "Table value change rejected",
    `${req.factorName} (${req.factorCode}): proposed table value change was rejected${note ? " — " + note : ""}`);
  return req;
}

/* ---------- Approve a custom factor for use in Formula Builder ----------
   Creating a factor stays instant (no approval — see vxRequestFactorChange's
   comment for why only a VALUE change is gated), so a brand-new custom
   factor shows on Rating Factors immediately. But letting it be DRAGGED
   INTO A FORMULA is a step further — the whole point of Formula Builder's
   Not-wired palette is that a coverage's real formula could pick it up — so
   that needs its own sign-off by someone other than whoever created it.
   No effective-dating here (unlike a value change): this is a yes/no
   capability, not a number with a date it takes effect.
   Always requires someone other than whoever created the factor — including
   when that creator is a Rating Administrator. Use Switch User (account
   menu) to approve as a genuinely different person. */
function vxApproveFactorForFormulas(code) {
  const f = (VX.ratingFactors || []).find(x => x.code === code);
  if (!f) return null;
  if (f.createdBy && f.createdBy === vxCurrentUser()) {
    vxToast("Can't approve your own factor", "A second person has to sign this off — that is what the step is for. Use Switch User (account menu) to approve as someone else.", "err");
    return null;
  }
  f.approvedForFormulas = true;
  f.formulaApprovedBy = vxCurrentUser();
  f.formulaApprovedOn = vxNowStamp();
  vxAudit("Rating Factors", "Approved for Formula Builder",
    `${f.name} (${f.code}) can now be used as a variable in Formula Builder — approved by ${f.formulaApprovedBy}`);
  return f;
}

function vxAutoSave() {
  clearTimeout(_asT);
  const id = "vxAS";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div"); el.id = id;
    el.style.cssText = "position:fixed;bottom:18px;left:18px;z-index:2000;font-size:11.5px;color:var(--text-mute);background:var(--surface);border:1px solid var(--border);padding:6px 12px;border-radius:20px;box-shadow:var(--shadow)";
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="vx-spin" style="width:11px;height:11px;vertical-align:-1px"></span> Saving...`;
  _asT = setTimeout(() => { el.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color:var(--good)"></i> All changes saved`;
    setTimeout(() => el.remove(), 2200); }, 700);
}

/* ---------- helpers ---------- */
/* Line of Business, Coverage and Scope are multi-select on a Rating Factor —
   a factor can be assigned against more than one of each at once — so every
   place that needs to test membership or iterate goes through here instead
   of assuming a single string. Kept tolerant of the OLD single-value shape
   too: every factor seeded with the platform still stores these as plain
   strings, so the two shapes coexist until a seeded factor is next edited.
   Shared here (not just on factors.html) because Formula Builder's own
   lookup of a custom factor by coverage needs the same tolerance — a
   strict `f.coverage === coverage` string check silently never matches a
   factor saved through the real multi-select form. */
function vxAsFieldArr(v) {
  return Array.isArray(v) ? v : (v ? [v] : []);
}
const vxMoney = n => "$" + Math.round(n).toLocaleString();
const vxMoney2 = n => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const vxPct = n => (n * 100).toFixed(1) + "%";
const vxNum = n => Number(n).toLocaleString();
function vxCSV(name, cols, rows) {
  const head = cols.map(c => c.l).join(",");
  const body = rows.map(r => cols.map(c => `"${String(vxCell(r, c, true) ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[head, ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name + ".csv"; a.click();
  vxToast("Export complete", `${rows.length} rows exported to ${name}.csv`, "ok");
}
function vxCell(row, col, raw) {
  const v = row[col.k];
  if (raw || !col.r) return Array.isArray(v) ? v.join(" | ") : v;
  return col.r(row);
}
