/* ==========================================================================
   Veridex — Simulated REST API + generic CRUD grid
   ========================================================================== */

/* ---------------- Simulated API ---------------- */
const API = (() => {
  const lat = () => 90 + Math.random() * 160;
  const ok = (data, extra) => ({ status: 200, data, meta: { engine: VX.meta.engine, ts: new Date().toISOString(), ...extra } });
  const call = fn => new Promise(res => setTimeout(() => res(fn()), lat()));

  /* Tenant partition boundary. Every grid on the platform reads through
     API.list, so scoping here is what makes tenant isolation real across all
     screens rather than 24 separate filters that could drift. Uses the
     Cosmos facade when it's loaded; collections it doesn't partition
     (geography, rate tables, coverage tree) fall through unchanged. */
  const scoped = key => {
    if (typeof COSMOS !== "undefined" && COSMOS.tenantScoped.has(key)) {
      try { return COSMOS.query(key, {}); } catch (e) { return []; }
    }
    return (VX[key] || []).slice();
  };

  return {
    list: (key, { page = 1, size = 10, q = "", sort = null, dir = 1, filters = {} } = {}) => call(() => {
      let rows = scoped(key).slice();
      if (q) { const s = q.toLowerCase(); rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(s))); }
      Object.entries(filters).forEach(([k, v]) => { if (v) rows = rows.filter(r => String(r[k]) === String(v)); });
      if (sort) rows.sort((a, b) => {
        const x = a[sort], y = b[sort];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
      const total = rows.length, pages = Math.max(1, Math.ceil(total / size));
      return ok(rows.slice((page - 1) * size, page * size), { total, page, pages, size });
    }),
    get: (key, id) => call(() => {
      const r = (VX[key] || []).find(x => x.id == id);
      return r ? ok(r) : { status: 404, error: "Not found" };
    }),
    // New documents land in the active tenant's partition, so a record
    // created here is immediately visible to that tenant and no other.
    create: (key, rec) => call(() => {
      rec.id = Date.now();
      if (typeof COSMOS !== "undefined" && COSMOS.tenantScoped.has(key) && rec.tenantId == null) rec.tenantId = VX.activeTenantId;
      VX[key].push(rec); return ok(rec, { created: true });
    }),
    update: (key, id, rec) => call(() => {
      const i = VX[key].findIndex(x => x.id == id);
      if (i < 0) return { status: 404, error: "Not found" };
      VX[key][i] = { ...VX[key][i], ...rec }; return ok(VX[key][i]);
    }),
    remove: (key, id) => call(() => { VX[key] = VX[key].filter(x => x.id != id); return ok({ id, deleted: true }); }),
    clone: (key, id) => call(() => {
      const src = VX[key].find(x => x.id == id);
      if (!src) return { status: 404, error: "Not found" };
      const c = { ...src, id: Date.now() };
      if (c.name) c.name = c.name + " (Copy)";
      if (c.code) c.code = c.code + "_C";
      if (c.status) c.status = "Draft";
      VX[key].push(c); return ok(c, { cloned: true });
    }),
  };
})();

/* ---------------- CRUD grid ---------------- */
let _gid = 0;
function vxGrid(opt) {
  const id = "g" + (++_gid);
  const key = opt.key;
  const cols = opt.cols;
  const name = opt.name || "Record";
  // Search/filter/sort are remembered per-tab for this grid (session-scoped, not
  // permanent, so it doesn't surprise a returning user days later) — leaving a
  // filtered/sorted view and coming back no longer silently resets it.
  const stStoreKey = "vxGridState:" + key;
  let restored = {};
  try { restored = JSON.parse(sessionStorage.getItem(stStoreKey) || "{}"); } catch (e) {}
  const st = { page: 1, size: opt.size || 10, q: "", sort: opt.sort || null, dir: 1, filters: {}, ...restored };
  const persistState = () => { try { sessionStorage.setItem(stStoreKey, JSON.stringify(
    { page: st.page, size: st.size, q: st.q, sort: st.sort, dir: st.dir, filters: st.filters })); } catch (e) {} };
  const root = typeof opt.el === "string" ? document.querySelector(opt.el) : opt.el;

  const filterHtml = (opt.filters || []).map(f =>
    `<select class="form-select form-select-sm" style="width:auto;min-width:140px" data-f="${f.k}">
      <option value="">${f.l}: All</option>${f.opts.map(o => `<option value="${o}" ${String(o) === String(st.filters[f.k] || "") ? "selected" : ""}>${o}</option>`).join("")}</select>`).join("");

  const bulk = opt.bulkActions || [];
  const selected = new Set();

  root.innerHTML = `
    <div class="vx-tools">
      <div class="l">
        <div class="vx-search" style="max-width:250px">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input class="form-control form-control-sm" id="${id}q" placeholder="Search ${name.toLowerCase()}s..." style="padding-left:32px" value="${st.q}">
        </div>
        ${filterHtml}
        ${(opt.filters || []).length ? `<button class="btn btn-outline-secondary btn-sm" id="${id}clrf2"><i class="fa-solid fa-filter-circle-xmark me-1"></i>Clear Filters</button>` : ""}
      </div>
      <div class="r">
        ${opt.readOnly ? "" : `<button class="btn btn-primary btn-sm" id="${id}add"><i class="fa-solid fa-plus me-1"></i>Add ${name}</button>`}
        <button class="btn btn-outline-secondary btn-sm" id="${id}imp"><i class="fa-solid fa-file-import me-1"></i>Import</button>
        <button class="btn btn-outline-secondary btn-sm" id="${id}exp"><i class="fa-solid fa-file-export me-1"></i>Export</button>
      </div>
    </div>
    ${bulk.length ? `<div class="vx-bulkbar" id="${id}sel" style="display:none">
      <b><span id="${id}selc">0</span> selected</b>
      ${bulk.map((b, bi) => `<button class="btn btn-outline-secondary btn-sm" data-ba="${bi}"><i class="fa-solid ${b.i}"></i> ${b.t}</button>`).join("")}
      <button class="btn btn-link btn-sm" id="${id}selclear">Clear</button>
    </div>` : ""}
    <div class="vx-tw">
      <table class="vx-t">
        <thead><tr>${bulk.length ? `<th scope="col" style="width:34px"><input type="checkbox" id="${id}selall" aria-label="Select all ${name.toLowerCase()}s on this page"></th>` : ""}${cols.map(c => {
          /* A sortable header is a control, so it is announced as one and
             carries its current sort state. Previously it was a plain <th>
             with a click handler: not reachable by keyboard and with no way
             to tell which column the table was sorted by. */
          if (c.sort === false) return `<th scope="col" data-k="${c.k}">${c.l}</th>`;
          const dir = st.sort === c.k ? (st.dir === 1 ? "ascending" : "descending") : "none";
          return `<th scope="col" class="s" data-k="${c.k}" aria-sort="${dir}">` +
            `<button type="button" class="vx-th-sort" data-k="${c.k}">${c.l}` +
            ` <i class="fa-solid fa-sort" aria-hidden="true"></i></button></th>`;
        }).join("")}
        <th scope="col" style="text-align:right">Actions</th></tr></thead>
        <tbody id="${id}b"></tbody>
      </table>
    </div>
    <div class="vx-tfoot"><span id="${id}c"></span><div id="${id}p"></div></div>`;

  async function load() {
    const body = document.getElementById(id + "b");
    const colspan = cols.length + 1 + (bulk.length ? 1 : 0);
    body.innerHTML = `<tr><td colspan="${colspan}"><div class="vx-load"><span class="vx-spin"></span>Loading ${name.toLowerCase()}s...</div></td></tr>`;
    const res = await API.list(key, st);
    const rows = res.data, m = res.meta;

    if (!rows.length) {
      const hasFilter = !!st.q || Object.values(st.filters).some(v => v);
      body.innerHTML = `<tr><td colspan="${colspan}"><div class="vx-empty"><i class="fa-solid fa-inbox"></i>
        ${hasFilter
          ? `No ${name.toLowerCase()}s match your filters.<br><button class="btn btn-outline-secondary btn-sm mt-2" id="${id}clrf">Clear filters</button>`
          : `No ${name.toLowerCase()}s yet.` + (opt.readOnly ? "" : `<br><button class="btn btn-primary btn-sm mt-2" id="${id}emptyadd"><i class="fa-solid fa-plus me-1"></i>Add ${name}</button>`)}
        </div></td></tr>`;
      const clrf = document.getElementById(id + "clrf");
      if (clrf) clrf.onclick = () => {
        st.q = ""; st.filters = {}; st.page = 1;
        document.getElementById(id + "q").value = "";
        root.querySelectorAll("[data-f]").forEach(s => s.value = "");
        persistState(); load();
      };
      const emptyAdd = document.getElementById(id + "emptyadd");
      if (emptyAdd) emptyAdd.onclick = () => formModal(null);
    } else {
      /* Every row carries the same five or six icon buttons. Named only by
         their tooltip, a page of twelve rows presents twelve controls called
         "Edit" with nothing to distinguish them — a screen-reader user hears
         the list and cannot tell which record any of them belongs to. Each
         button is named with the record it acts on instead.
         title is kept as well: it is the sighted-hover affordance, and it is
         now redundant with the label rather than the only source of one. */
      const label = r => String(r.name ?? r.title ?? r.code ?? r.quoteNo ?? ("record " + r.id))
        .replace(/"/g, "&quot;");
      body.innerHTML = rows.map(r => `<tr data-id="${r.id}" class="vx-anim">
        ${bulk.length ? `<td><input type="checkbox" class="vx-rowsel" data-id="${r.id}" ${selected.has(String(r.id)) ? "checked" : ""} aria-label="Select ${label(r)}"></td>` : ""}
        ${cols.map(c => `<td${(c.editable && !opt.readOnly) ? ` class="vx-editable" data-ek="${c.k}" title="Click to edit"` : ""}>${vxCell(r, c) ?? '<span style="color:var(--text-mute)">—</span>'}</td>`).join("")}
        <td><div class="vx-ra">
          <button data-a="view" title="View details" aria-label="View details for ${label(r)}"><i class="fa-solid fa-eye" aria-hidden="true"></i></button>
          ${opt.readOnly ? "" : `<button data-a="edit" title="Edit" aria-label="Edit ${label(r)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button data-a="clone" title="Clone" aria-label="Clone ${label(r)}"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>`}
          <button data-a="hist" title="Version history" aria-label="Version history for ${label(r)}"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i></button>
          ${(opt.rowActions || []).map((ra, ri) => `<button data-ra="${ri}" title="${ra.t}" aria-label="${ra.t} — ${label(r)}"><i class="fa-solid ${ra.i}" aria-hidden="true"></i></button>`).join("")}
          ${opt.readOnly ? "" : `<button data-a="del" class="del" title="Delete" aria-label="Delete ${label(r)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`}
        </div></td></tr>`).join("");
    }

    const countText = m.total
      ? `Showing ${(m.page - 1) * m.size + 1}–${Math.min(m.page * m.size, m.total)} of ${vxNum(m.total)} ${name.toLowerCase()}s`
      : "0 results";
    document.getElementById(id + "c").textContent = countText;
    /* Filtering and paging rewrite the table silently. Without this the only
       feedback that a filter did anything is visual. */
    if (typeof vxAnnounce === "function" && load._first) vxAnnounce(countText);
    load._first = true;

    // pager
    const p = document.getElementById(id + "p");
    if (m.pages > 1) {
      let h = `<nav class="btn-group btn-group-sm" aria-label="${name} pagination">
        <button class="btn btn-outline-secondary" ${m.page === 1 ? "disabled" : ""} data-p="${m.page - 1}" aria-label="Previous page"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>`;
      for (let i = 1; i <= m.pages; i++) {
        if (m.pages > 7 && Math.abs(i - m.page) > 1 && i !== 1 && i !== m.pages) {
          if (i === 2 || i === m.pages - 1) h += `<span class="btn btn-outline-secondary disabled" aria-hidden="true">…</span>`;
          continue;
        }
        h += `<button class="btn btn-${i === m.page ? "primary" : "outline-secondary"}" data-p="${i}" aria-label="Page ${i}"${i === m.page ? ' aria-current="page"' : ""}>${i}</button>`;
      }
      h += `<button class="btn btn-outline-secondary" ${m.page === m.pages ? "disabled" : ""} data-p="${m.page + 1}" aria-label="Next page"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></nav>`;
      p.innerHTML = h;
      p.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { st.page = +b.dataset.p; persistState(); load(); });
    } else p.innerHTML = "";

    // sort icons — and the aria-sort that carries the same fact non-visually
    root.querySelectorAll("thead th.s").forEach(th => {
      const on = st.sort === th.dataset.k;
      const i = th.querySelector("i");
      i.className = on ? (st.dir === 1 ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down") : "fa-solid fa-sort";
      th.setAttribute("aria-sort", on ? (st.dir === 1 ? "ascending" : "descending") : "none");
    });

    // row actions
    body.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const rid = b.closest("tr").dataset.id;
      const rec = VX[key].find(x => x.id == rid);
      act(b.dataset.a, rec);
    });
    body.querySelectorAll("[data-ra]").forEach(b => b.onclick = () => {
      const rid = b.closest("tr").dataset.id;
      const rec = VX[key].find(x => x.id == rid);
      opt.rowActions[+b.dataset.ra].fn(rec);
    });
    // bulk-selection checkboxes
    if (bulk.length) body.querySelectorAll(".vx-rowsel").forEach(cb => cb.onchange = () => {
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
      updateSelBar();
    });

    // inline single-cell editing — click an editable cell instead of opening the full edit modal
    body.querySelectorAll("td.vx-editable").forEach(td => td.onclick = () => {
      if (td.classList.contains("editing")) return;
      const rec = VX[key].find(x => x.id == td.closest("tr").dataset.id);
      const col = cols.find(c => c.k === td.dataset.ek);
      startEdit(td, rec, col);
    });

    body.querySelectorAll("tr[data-id]").forEach(tr => tr.oncontextmenu = e => {
      const rec = VX[key].find(x => x.id == tr.dataset.id);
      vxCtxMenu(e, [
        { i: "fa-eye", t: "View details", fn: () => act("view", rec) },
        ...(opt.readOnly ? [] : [{ i: "fa-pen", t: "Edit", fn: () => act("edit", rec) },
        { i: "fa-copy", t: "Clone", fn: () => act("clone", rec) }]),
        { i: "fa-clock-rotate-left", t: "Version history", fn: () => act("hist", rec) },
        ...(opt.rowActions || []).map(ra => ({ i: ra.i, t: ra.t, fn: () => ra.fn(rec) })),
        { sep: true },
        { i: "fa-file-export", t: "Export row", fn: () => vxCSV(name + "-row", cols, [rec]) },
        ...(opt.readOnly ? [] : [{ i: "fa-trash", t: "Delete", fn: () => act("del", rec) }]),
      ]);
    });
  }

  function updateSelBar() {
    if (!bulk.length) return;
    const bar = document.getElementById(id + "sel"), cnt = document.getElementById(id + "selc");
    if (cnt) cnt.textContent = selected.size;
    if (bar) bar.style.display = selected.size ? "flex" : "none";
  }

  function act(a, rec) {
    if (a === "view") return viewModal(rec);
    if (a === "edit") return formModal(rec);
    if (a === "hist") return histModal(rec);
    if (a === "clone") return API.clone(key, rec.id).then(r => {
      vxToast(name + " cloned", `Created "${r.data.name || r.data.code || r.data.id}" as a draft copy`, "ok"); vxAutoSave(); load();
    });
    if (a === "del") return vxConfirm(`Delete ${name}?`,
      `This will remove <b>${rec.name || rec.code || "this record"}</b> from the active configuration. Version history is retained.`,
      () => API.remove(key, rec.id).then(() => { vxToast(name + " deleted", "Removed from active configuration", "err"); vxAutoSave(); load(); }), true);
  }

  /* Inline edit for one cell — reuses the same field-type handling as
     formModal (select/check/number/text) by looking up the matching entry
     in opt.form, so an editable column needs no separate type declaration. */
  function startEdit(td, rec, col) {
    const f = (opt.form || []).find(x => x.k === col.k) || { k: col.k };
    const v = rec[col.k];
    const original = td.innerHTML;
    td.classList.add("editing");

    if (f.t === "select") td.innerHTML = `<select class="form-select form-select-sm">${f.opts.map(o => `<option ${o == v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    else if (f.t === "check") td.innerHTML = `<div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" ${v ? "checked" : ""}></div>`;
    else td.innerHTML = `<input type="${f.t === "number" ? "number" : "text"}" ${f.step ? `step="${f.step}"` : ""} class="form-control form-control-sm" value="${v ?? ""}">`;

    const input = td.querySelector("input,select");
    input.focus();
    if (input.select && input.type !== "checkbox") input.select();

    let settled = false;
    const cancel = () => { if (settled) return; settled = true; td.innerHTML = original; td.classList.remove("editing"); };
    const commit = () => {
      if (settled) return; settled = true;
      const raw = input.type === "checkbox" ? input.checked : input.value;
      const val = f.t === "number" ? +raw : raw;
      if (val === v) { td.innerHTML = original; td.classList.remove("editing"); return; }
      API.update(key, rec.id, { [col.k]: val }).then(() => {
        vxToast(`${name} updated`, `${col.l} changed`, "ok");
        vxAutoSave(); load();
      });
    };

    input.onblur = commit;
    input.onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    };
    if (input.type === "checkbox") input.onchange = commit;
  }

  function viewModal(rec) {
    const fields = cols.concat(opt.extraView || []);
    vxModal(`${name} Details`, `<div class="row g-3">
      ${fields.map(c => `<div class="col-md-6"><label class="d-block">${c.l}</label>
        <div style="font-size:13.5px">${vxCell(rec, c) ?? '<span style="color:var(--text-mute)">—</span>'}</div></div>`).join("")}
      </div>`, [{ t: "Close", c: "secondary" }, ...(opt.readOnly ? [] : [{ t: "Edit", c: "primary", fn: () => { setTimeout(() => formModal(rec), 300); } }])]);
  }

  function formModal(rec) {
    const isNew = !rec;
    const flds = opt.form || cols.filter(c => c.k !== "id");
    const r = rec ? { ...rec } : {};
    const inputs = flds.map(f => {
      const v = r[f.k] ?? f.def ?? "";
      if (f.t === "select") return `<div class="col-md-6"><label>${f.l}</label>
        <select class="form-select form-select-sm" data-f="${f.k}">${f.opts.map(o => `<option ${o == v ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
      if (f.t === "check") return `<div class="col-md-6"><label class="d-block">${f.l}</label>
        <div class="form-check form-switch"><input class="form-check-input" type="checkbox" data-f="${f.k}" ${v ? "checked" : ""}></div></div>`;
      if (f.t === "multi") return `<div class="col-md-12"><label class="d-block">${f.l}</label><div data-fg="${f.k}">
        ${f.opts.map((o, i) => `<div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" data-fm="${f.k}" value="${o}" id="${id}m${f.k}${i}" ${(Array.isArray(v) ? v : []).includes(o) ? "checked" : ""}><label class="form-check-label" for="${id}m${f.k}${i}">${o}</label></div>`).join("")}
      </div></div>`;
      if (f.t === "textarea") return `<div class="col-md-12"><label>${f.l}</label><textarea class="form-control form-control-sm" rows="2" data-f="${f.k}">${v}</textarea></div>`;
      return `<div class="col-md-6"><label>${f.l}</label><input type="${f.t || "text"}" ${f.step ? `step="${f.step}"` : ""} class="form-control form-control-sm" data-f="${f.k}" value="${v}"></div>`;
    }).join("");

    vxModal(`${isNew ? "Add" : "Edit"} ${name}`,
      `<div class="row g-3">${inputs}</div>
       <div class="vx-ai mt-3"><span class="tag"><i class="fa-solid fa-wand-magic-sparkles"></i>AI Validation</span>
       No conflicting effective-date ranges detected. Factor values fall within the expected statistical range for this ${name.toLowerCase()} type.
       ${isNew ? "This will be created in the current draft version." : "Changes create a new revision; the prior value stays queryable for in-force policies."}</div>`,
      [{ t: "Cancel", c: "secondary" }, { t: `Save ${name}`, c: "primary", fn: async () => {
        const el = document.getElementById("vxModal");
        el.querySelectorAll("[data-f]").forEach(i => {
          r[i.dataset.f] = i.type === "checkbox" ? i.checked : (i.type === "number" ? +i.value : i.value);
        });
        el.querySelectorAll("[data-fg]").forEach(gp => {
          r[gp.dataset.fg] = [...gp.querySelectorAll("[data-fm]:checked")].map(c => c.value);
        });
        if (isNew) await API.create(key, r); else await API.update(key, rec.id, r);
        vxToast(`${name} ${isNew ? "created" : "updated"}`, r.name || r.code || "Configuration saved", "ok");
        vxAutoSave(); load();
      }}]);
  }

  function histModal(rec) {
    const ev = [
      { t: "2026-07-28 14:12", u: "vikas.kumar@veridex.io", a: "Updated value", n: "Adjusted per Q3 rate filing", v: "v2026.03" },
      { t: "2026-05-02 09:44", u: "system.ai@veridex.io", a: "AI recommendation applied", n: "Suggested +3% based on loss trend", v: "v2026.03" },
      { t: "2026-03-09 11:05", u: "j.romero@veridex.io", a: "Created record", n: "Initial configuration", v: "v2026.03" },
      { t: "2025-11-01 08:30", u: "s.patel@veridex.io", a: "Migrated from workbook", n: "Imported from source .xlsb", v: "v2025.11" },
    ];
    vxModal(`Version History — ${rec.name || rec.code || name}`,
      `<div class="vx-tl">${ev.map(e => `<div class="i"><div class="tm">${e.t} · ${e.u} · <span class="vx-b gray">${e.v}</span></div>
        <div class="tt">${e.a}</div><div class="td">${e.n}</div></div>`).join("")}</div>`,
      [{ t: "Close", c: "secondary" }]);
  }

  function importModal() {
    vxModal(`Bulk Import ${name}s`, `
      <div class="vx-drop mb-3"><i class="fa-solid fa-cloud-arrow-up fa-2x mb-2"></i><br>
        Drag &amp; drop a CSV / XLSX / XLSB file, or click to browse
        <input type="file" class="form-control form-control-sm mt-3"></div>
      <div class="vx-ai"><span class="tag"><i class="fa-solid fa-wand-magic-sparkles"></i>AI Import Assist</span>
        Column headers are auto-mapped to the ${name.toLowerCase()} schema. Duplicate keys, overlapping effective-date
        ranges, and values outside the expected statistical range are flagged for review before commit.
        Committing creates a <b>new version</b> rather than overwriting — in-force policies keep rating under the prior version.</div>`,
      [{ t: "Cancel", c: "secondary" }, { t: "Run Import", c: "primary", fn: () => {
        vxToast("Import simulated", `${name} import validated — 0 rows changed (prototype mode)`, "info");
      }}]);
  }

  document.getElementById(id + "q").oninput = e => { st.q = e.target.value; st.page = 1; persistState(); load(); };
  root.querySelectorAll("[data-f]").forEach(s => s.onchange = () => { st.filters[s.dataset.f] = s.value; st.page = 1; persistState(); load(); });
  const clrf2 = document.getElementById(id + "clrf2");
  if (clrf2) clrf2.onclick = () => {
    st.q = ""; st.filters = {}; st.page = 1;
    document.getElementById(id + "q").value = "";
    root.querySelectorAll("[data-f]").forEach(s => s.value = "");
    persistState(); load();
  };
  /* The handler lives on the header's button now, not the <th>. Bound on the
     <th> it fired for mouse clicks only; a button fires on Enter and Space
     too, so sorting is reachable from the keyboard for the first time. */
  root.querySelectorAll("thead th.s .vx-th-sort").forEach(btn => btn.onclick = () => {
    if (st.sort === btn.dataset.k) st.dir *= -1; else { st.sort = btn.dataset.k; st.dir = 1; }
    persistState();
    load().then(() => {
      const col = cols.find(c => c.k === btn.dataset.k);
      vxAnnounce(`Sorted by ${col ? col.l : btn.dataset.k}, ${st.dir === 1 ? "ascending" : "descending"}`);
    });
  });
  if (!opt.readOnly) document.getElementById(id + "add").onclick = () => formModal(null);
  document.getElementById(id + "imp").onclick = importModal;
  document.getElementById(id + "exp").onclick = () => vxCSV(key, cols,
    (typeof COSMOS !== "undefined" && COSMOS.tenantScoped.has(key)) ? COSMOS.query(key, {}) : VX[key]);

  if (bulk.length) {
    document.getElementById(id + "selall").onchange = e => {
      document.getElementById(id + "b").querySelectorAll(".vx-rowsel").forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
      });
      updateSelBar();
    };
    document.getElementById(id + "selclear").onclick = () => {
      selected.clear();
      document.getElementById(id + "b").querySelectorAll(".vx-rowsel").forEach(cb => cb.checked = false);
      const all = document.getElementById(id + "selall"); if (all) all.checked = false;
      updateSelBar();
    };
    root.querySelectorAll("[data-ba]").forEach(b => b.onclick = () => {
      const recs = [...selected].map(sid => VX[key].find(x => x.id == sid)).filter(Boolean);
      bulk[+b.dataset.ba].fn(recs);
    });
  }

  load();
  return { reload: load, state: st };
}
