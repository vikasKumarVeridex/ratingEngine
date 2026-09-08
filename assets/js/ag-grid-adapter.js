/* ==========================================================================
   AG Grid adapter — vxAgGrid(opt) is a drop-in replacement for vxGrid(opt)
   (assets/js/grid.js). Same option shape (el,key,name,cols,form,filters,
   rowActions,bulkActions,extraView,readOnly,size), same {reload,state}
   return value — pages migrate by changing the function name.

   This is a rendering/interaction-layer swap only: it reuses the same
   simulated API (list/get/create/update/remove/clone, still in grid.js),
   the same VX[key] arrays as the single source of truth, and the same
   vxModal/vxConfirm/vxCSV/vxToast/vxAutoSave helpers as vxGrid — nothing
   about how data is stored or how engine.js reads it changes.

   AG Grid Community (MIT, no license key) is loaded from CDN, pinned to
   31.3.2 — the last line before v33 made a new JS-based Theming API the
   default over the classic ag-theme-* CSS classes used here.
   ========================================================================== */
let _agid = 0;

/* Header-tooltip helper for AG Grid. Mirrors the dictionary used by
   column-tooltips.js so <table.vx-t> HTML grids and AG Grid grids get
   consistent definitions. Returns undefined when no entry exists, which
   suppresses the native title attribute (no empty tooltip bubble). */
function vxColHeaderTooltip(label) {
  const D = (window.VX_TIPS) || {};
  const k = String(label || "").replace(/\s+/g, " ").trim();
  const entry = D[k];
  if (!entry) return undefined;
  const e = typeof entry === "string" ? { d: entry } : entry;
  return e.d + (e.w ? " — " + e.w : "");
}

function vxAgGrid(opt) {
  const id = "ag" + (++_agid);
  const key = opt.key;
  const cols = opt.cols;
  const name = opt.name || "Record";
  const bulk = opt.bulkActions || [];
  const pageSize = opt.size || 10;

  const stStoreKey = "vxAgGridState:" + key;
  let restored = {};
  try { restored = JSON.parse(sessionStorage.getItem(stStoreKey) || "{}"); } catch (e) {}
  const st = { q: restored.q || "", filters: restored.filters || {}, hidden: restored.hidden || [] };
  const persistState = () => { try { sessionStorage.setItem(stStoreKey, JSON.stringify({ q: st.q, filters: st.filters, hidden: st.hidden })); } catch (e) {} };

  const root = typeof opt.el === "string" ? document.querySelector(opt.el) : opt.el;

  /* A filter marked `multi` renders as a checklist in a popover and stores an
     array. Single-value filters are untouched — most columns genuinely are
     one-of, and a checklist there is just more clicks. */
  const filterHtml = (opt.filters || []).map(f => {
    if (!f.multi) {
      return `<select class="form-select form-select-sm" style="width:auto;min-width:140px" data-f="${f.k}">
        <option value="">${f.l}: All</option>${f.opts.map(o => `<option value="${o}" ${String(o) === String(st.filters[f.k] || "") ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    }
    const sel = Array.isArray(st.filters[f.k]) ? st.filters[f.k] : [];
    const label = sel.length === 0 ? `${f.l}: All`
      : sel.length === f.opts.length ? `${f.l}: All ${f.opts.length}`
      : sel.length <= 3 ? `${f.l}: ${sel.join(", ")}` : `${f.l}: ${sel.length} selected`;
    return `<div class="vx-dd" data-mf="${f.k}" style="min-width:170px">
      <button type="button" class="vx-dd-btn" data-mfbtn="${f.k}">
        <span data-mflabel="${f.k}">${label}</span><i class="fa-solid fa-chevron-down"></i></button>
      <div class="vx-dd-panel" data-mfpanel="${f.k}">
        <div class="vx-dd-head">
          <input type="text" class="form-control form-control-sm" placeholder="Search\u2026" data-mfsearch="${f.k}">
          <div class="d-flex gap-2 mt-2" style="font-size:11.5px">
            <a href="#" data-mfall="${f.k}">Select all</a><a href="#" data-mfnone="${f.k}">Clear</a>
          </div>
        </div>
        <div class="vx-dd-list" data-mflist="${f.k}">
          ${f.opts.map(o => `<label class="vx-dd-opt"><input type="checkbox" data-mfm="${f.k}" value="${o}"
            ${sel.includes(String(o)) ? "checked" : ""}><span>${o}</span></label>`).join("")}
        </div>
      </div></div>`;
  }).join("");

  root.innerHTML = `
    <div class="vx-tools">
      <div class="l">
        <div class="vx-search" style="max-width:250px">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input class="form-control form-control-sm" id="${id}q" placeholder="Search ${name.toLowerCase()}s..." style="padding-left:32px" value="${st.q}">
        </div>
        ${filterHtml}
        ${(opt.filters || []).length ? `<button class="btn btn-outline-secondary btn-sm" id="${id}clrf"><i class="fa-solid fa-filter-circle-xmark me-1"></i>Clear Filters</button>` : ""}
      </div>
      <div class="r">
        <button class="btn btn-outline-secondary btn-sm" id="${id}cols"><i class="fa-solid fa-table-columns me-1"></i>Columns</button>
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
    <div id="${id}grid" class="ag-theme-quartz vx-ag" style="height:${Math.min(pageSize, 12) * 42 + 130}px;width:100%"></div>`;

  /* ---------- cell renderers / editors, derived from the same cols/form the caller already wrote for vxGrid ---------- */
  function fieldDef(k) { return (opt.form || []).find(f => f.k === k); }

  function colDef(c) {
    const f = fieldDef(c.k);
    const def = {
      field: c.k, headerName: c.l, sortable: c.sort !== false, resizable: true, filter: false,
      hide: st.hidden.includes(c.k),
      headerTooltip: vxColHeaderTooltip(c.l),
      cellRenderer: c.r ? (p => c.r(p.data) ?? '<span style="color:var(--text-mute)">—</span>') : (p => p.value ?? '<span style="color:var(--text-mute)">—</span>'),
    };
    if (c.editable && !opt.readOnly && f) {
      def.editable = true;
      if (f.t === "select") { def.cellEditor = "agSelectCellEditor"; def.cellEditorParams = { values: f.opts }; def.width = 150; }
      else if (f.t === "check") { def.cellEditor = "agCheckboxCellEditor"; def.width = 110; }
      else if (f.t === "number") { def.cellEditor = "agNumberCellEditor"; def.width = 120; }
    }
    // Columns whose whole content is a short badge (a single vx-b span, no
    // links/nesting) don't need AG Grid's ~200px text-column default —
    // narrower columns mean more of a wide grid fits without scrolling.
    if (c.r && !def.width) {
      try {
        const sample = c.r({}) || "";
        if (/^<span class="vx-b [^"]*">[^<]*<\/span>$/.test(String(sample).trim())) def.width = 130;
      } catch (e) { /* renderer needs real row data — leave default width */ }
    }
    return def;
  }

  function actionsHtml(rec) {
    const b = [];
    b.push(`<button data-a="view" title="View details"><i class="fa-solid fa-eye"></i></button>`);
    if (!opt.readOnly) {
      b.push(`<button data-a="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>`);
      if (!opt.noClone) b.push(`<button data-a="clone" title="Clone"><i class="fa-solid fa-copy"></i></button>`);
    }
    if (!opt.noHist) b.push(`<button data-a="hist" title="Version history"><i class="fa-solid fa-clock-rotate-left"></i></button>`);
    (opt.rowActions || []).forEach((ra, ri) => b.push(`<button data-ra="${ri}" title="${ra.t}"><i class="fa-solid ${ra.i}"></i></button>`));
    if (!opt.readOnly && !opt.noDelete) b.push(`<button data-a="del" class="del" title="Delete"><i class="fa-solid fa-trash"></i></button>`);
    return `<div class="vx-ra">${b.join("")}</div>`;
  }

  const columnDefs = [];
  if (bulk.length) columnDefs.push({ headerCheckboxSelection: true, checkboxSelection: true, width: 42, pinned: "left", sortable: false, filter: false, resizable: false });
  cols.forEach(c => columnDefs.push(colDef(c)));
  const btnCount = 1                                             // view
    + (opt.readOnly ? 0 : 1)                                     // edit
    + (opt.readOnly || opt.noClone ? 0 : 1)                      // clone
    + (opt.noHist ? 0 : 1)                                       // history
    + (opt.rowActions || []).length
    + (opt.readOnly || opt.noDelete ? 0 : 1);                    // delete
  const actionsWidth = 22 + btnCount * 32;
  /* width AND maxWidth, not just minWidth: with only a minimum set, AG Grid
     falls back to its 200px default column width, which left two icon buttons
     marooned in a column twice as wide as they need. */
  columnDefs.push({ headerName: "Actions", field: "_actions", sortable: false, filter: false, resizable: false,
    pinned: "right", width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth,
    cellClass: "vx-ra-cell", cellRenderer: p => actionsHtml(p.data) });

  const gridOptions = {
    columnDefs, rowData: [],
    pagination: true, paginationPageSize: pageSize, paginationPageSizeSelector: false,
    rowSelection: bulk.length ? "multiple" : undefined, suppressRowClickSelection: true,
    animateRows: true, domLayout: "normal",
    isExternalFilterPresent: () => Object.values(st.filters).some(v => Array.isArray(v) ? v.length : v),
    doesExternalFilterPass: node => Object.entries(st.filters).every(([k, v]) => {
      // A row's own field can now hold several values (a multi-select field
      // like Rating Factors' lob/coverage/scope) — matching is "does the
      // filter's selection overlap the row's values" either direction,
      // rather than a straight equality that only ever worked for one value
      // on each side.
      const rowVals = Array.isArray(node.data[k]) ? node.data[k].map(String) : [String(node.data[k])];
      if (Array.isArray(v)) return v.length === 0 || v.some(x => rowVals.includes(String(x)));
      return !v || rowVals.includes(String(v));
    }),
    overlayNoRowsTemplate: `<div class="vx-empty"><i class="fa-solid fa-inbox"></i><div id="${id}emptyMsg"></div></div>`,
    onCellValueChanged: e => {
      if (e.colDef.field === "_actions") return;
      const patch = { [e.colDef.field]: e.newValue };
      API.update(key, e.data.id, patch).then(() => {
        vxToast(`${name} updated`, `${e.colDef.headerName} changed`, "ok");
        vxAutoSave();
      });
    },
    onCellClicked: e => {
      if (e.colDef.field !== "_actions") return;
      const t = e.event.target.closest("[data-a],[data-ra]");
      if (!t) return;
      if (t.dataset.a) act(t.dataset.a, e.data);
      else opt.rowActions[+t.dataset.ra].fn(e.data);
    },
    onSelectionChanged: () => {
      if (!bulk.length) return;
      const n = gridApi.getSelectedRows().length;
      const bar = document.getElementById(id + "sel"), cnt = document.getElementById(id + "selc");
      if (cnt) cnt.textContent = n;
      if (bar) bar.style.display = n ? "flex" : "none";
    },
  };
  const gridApi = agGrid.createGrid(document.getElementById(id + "grid"), gridOptions);

  /* ---------- data load — AG Grid owns search/filter/sort/page client-side from here on; reload() just refetches VX[key] ---------- */
  /* `focusId`: a record just created or edited can land anywhere in the sort
     order — with no default sort, a new row is appended at the END of the
     data and was silently landing on whatever the last page happens to be,
     with nothing telling the person who just saved it that it worked. When
     given, jump pagination to the page that record is actually on (respecting
     whatever filter/sort is active) and flash its row so "did that save?"
     has a visible answer instead of an empty-looking page 1. */
  function reload(focusId) {
    API.list(key, { size: 1000000 }).then(res => {
      gridApi.setGridOption("rowData", res.data);
      const hasFilter = !!st.q || Object.values(st.filters).some(v => Array.isArray(v) ? v.length : v);
      const emptyEl = document.getElementById(id + "emptyMsg");
      if (emptyEl) emptyEl.innerHTML = hasFilter
        ? `No ${name.toLowerCase()}s match your filters.<br><button class="btn btn-outline-secondary btn-sm mt-2" id="${id}emptyClr">Clear filters</button>`
        : `No ${name.toLowerCase()}s yet.` + (opt.readOnly ? "" : `<br><button class="btn btn-primary btn-sm mt-2" id="${id}emptyAdd"><i class="fa-solid fa-plus me-1"></i>Add ${name}</button>`);
      const clr = document.getElementById(id + "emptyClr"); if (clr) clr.onclick = clearFilters;
      const eAdd = document.getElementById(id + "emptyAdd"); if (eAdd) eAdd.onclick = () => formModal(null);
      if (focusId == null) return;
      // Deferred a tick: AG Grid rebuilds its sorted/filtered row model
      // asynchronously off the rowData change above.
      setTimeout(() => {
        let node = null;
        gridApi.forEachNodeAfterFilterAndSort(n => { if (String(n.data && n.data.id) === String(focusId)) node = n; });
        if (!node) return; // filtered out by an active search/filter — nothing to jump to
        gridApi.paginationGoToPage(Math.floor(node.rowIndex / pageSize));
        setTimeout(() => { try { gridApi.flashCells({ rowNodes: [node] }); } catch (e) {} }, 60);
      }, 0);
    });
  }

  /* ---------- row actions ---------- */
  function act(a, rec) {
    if (a === "view") return viewModal(rec);
    /* A grid whose record needs more than a field list can express supplies its
       own editor. Roles are the case: a permission matrix does not fit in a
       form, and hiding it behind a second row action made it undiscoverable —
       people click the pencil. */
    if (a === "edit") return opt.onEdit ? opt.onEdit(rec, reload) : formModal(rec);
    if (a === "hist") return histModal(rec);
    if (a === "clone") return API.clone(key, rec.id).then(r => {
      vxToast(name + " cloned", `Created "${r.data.name || r.data.code || r.data.id}" as a draft copy`, "ok"); vxAutoSave(); reload();
    });
    if (a === "del") return vxConfirm(`Delete ${name}?`,
      `This will remove <b>${rec.name || rec.code || "this record"}</b> from the active configuration. Version history is retained.`,
      () => API.remove(key, rec.id).then(() => {
        if (opt.onAfterDelete) opt.onAfterDelete(rec);
        vxToast(name + " deleted", "Removed from active configuration", "err"); vxAutoSave(); reload(); }), true);
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
    /* Hand the caller the row as it stands BEFORE any edit. Once API.update
       runs, VX[key] holds only the new values — a caller that wants to log
       or diff a change has no way back to the prior state otherwise. */
    if (opt.onBeforeSave) opt.onBeforeSave(rec ? { ...rec } : null, isNew);
    const flds = opt.form || cols.filter(c => c.k !== "id");
    /* `editOnly` names the only fields an EXISTING record may change; every
       other field renders disabled. Add is left fully editable — you cannot
       create a record out of one field. Disabled controls still report their
       value, so sync() writes the original back and nothing is lost. */
    const locked = k => !isNew && Array.isArray(opt.editOnly) && !opt.editOnly.includes(k);
    const r = rec ? { ...rec } : {};

    /* `opts` / `groups` may be a function of the in-progress record, so a
       field can depend on another (coverages depend on the chosen LOB,
       rating versions depend on the chosen product). Fields naming a
       `dependsOn` key are re-rendered in place when that key changes. */
    const resolve = (x, cur) => (typeof x === "function" ? x(cur) : x) || [];
    const asArr = v => Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]);

    /* Seed the record with the values the form will actually SHOW before
       anything renders. On Add the record is empty, but a <select> still
       displays its first option — so a dependent field asking "which LOB?"
       got undefined and rendered empty while the user could plainly see a
       line of business selected. Defaults are materialised here so the
       record and the visible form agree from the first paint. */
    flds.forEach(f => {
      if (r[f.k] !== undefined && r[f.k] !== "") return;
      if (f.def !== undefined) { r[f.k] = f.def; return; }
      if (f.t === "select" || f.t === "tiles") {
        const first = resolve(f.opts, r)[0];
        if (first !== undefined) r[f.k] = (first && typeof first === "object") ? first.value : first;
      }
    });

    /* One row of the `columns` field type below — a column name plus its
       data type. Shared between the initial render and the "Add Column"
       handler in wire(), which appends a fresh row with the same markup. */
    const COLUMN_TYPES = ["Text", "Number", "Date", "Boolean", "Range"];
    function colRowHtml(k, c) {
      c = c || { name: "", type: "Text" };
      const isRange = c.type === "Range";
      return `<div class="d-flex gap-2 align-items-center mb-2" data-colrow="${k}">
        <input type="text" class="form-control form-control-sm" placeholder="Column name" data-colname="${k}" value="${(c.name || "").replace(/"/g, "&quot;")}">
        <select class="form-select form-select-sm" style="max-width:130px" data-colsel="${k}">
          ${COLUMN_TYPES.map(t => `<option ${t === c.type ? "selected" : ""}>${t}</option>`).join("")}
        </select>
        <input type="number" class="form-control form-control-sm" style="max-width:90px${isRange ? "" : ";display:none"}" placeholder="Min" data-colmin="${k}" value="${c.min ?? ""}">
        <input type="number" class="form-control form-control-sm" style="max-width:90px${isRange ? "" : ";display:none"}" placeholder="Max" data-colmax="${k}" value="${c.max ?? ""}">
        <button type="button" class="vx-icobtn" data-colrm="${k}" title="Remove column" style="width:30px;height:30px;flex:none"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    }
    /* Reads one `columns` field group back into the {name,type[,min,max]}
       array stored on the record. Shared by submit() and sync() so the two
       never drift out of step on what a Range column carries. */
    function readColumnRows(gp) {
      return [...gp.querySelectorAll("[data-colrow]")].map(row => {
        const type = row.querySelector("[data-colsel]").value;
        const col = { name: row.querySelector("[data-colname]").value.trim(), type };
        if (type === "Range") {
          const min = row.querySelector("[data-colmin]").value;
          const max = row.querySelector("[data-colmax]").value;
          if (min !== "") col.min = +min;
          if (max !== "") col.max = +max;
        }
        return col;
      }).filter(c => c.name);
    }

    function fieldHtml(f, cur) {
      /* A field can opt out of rendering entirely for the record being
         edited — e.g. "New value effective from" only means something once
         a value already exists to move away from, so it has no business
         appearing on Add at all. `isNew` closes over formModal's own. */
      if (f.hideIf && f.hideIf(cur, isNew)) return "";
      if (f.t === "section") return `<div class="col-12 vx-form-section${f.first ? " first" : ""}">
        <div class="vx-form-section-hd">${f.l}</div>
        ${f.sub ? `<div class="vx-form-section-sub">${f.sub}</div>` : ""}
      </div>`;
      /* `val` lets a field derive its current value instead of reading a
         stored property — needed where the relationship lives on the OTHER
         record (a version's attached formulas are stored on each formula's
         `attachments`, not on the version). */
      const v = typeof f.val === "function" ? f.val(cur, isNew) : (cur[f.k] ?? f.def ?? "");
      const lk = locked(f.k);
      /* A field can be system-generated rather than merely locked — the
         value is real and shown, just not something to hand-type. Distinct
         from `locked`, which is about an EXISTING record's field being off
         limits; `readonly` is about the value itself having no manual input
         to begin with. */
      const ro = typeof f.readonly === "function" ? f.readonly(cur, isNew) : !!f.readonly;
      const dis = lk ? " disabled" : "";
      /* Every field type renders its hint. Only select/multi/dropdown/tree
         did, so a `hint` written on a text or number field silently never
         appeared — which looked like the hint had been forgotten rather than
         dropped by the renderer. A function hint lets the same field explain
         itself differently on Add vs. Edit. */
      const hintText = typeof f.hint === "function" ? f.hint(cur, isNew) : f.hint;
      const hint = hintText ? `<div style="font-size:10.8px;color:var(--text-dim);margin-top:3px;line-height:1.45">${hintText}</div>` : "";
      const wrap = inner => `<div class="col-md-${f.w || 6}${lk ? " vx-fld-locked" : ""}${ro ? " vx-fld-auto" : ""}" data-fw="${f.k}">${inner}${hint}</div>`;
      if (f.t === "tiles") {
        const o = resolve(f.opts, cur);
        return `<div class="col-md-${f.w || 12}${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <label class="d-block">${f.l}</label>
          <div class="vx-tiles">
            ${o.map((x, i) => {
              const val = x && typeof x === "object" ? x.value : x;
              const lab = x && typeof x === "object" ? x.label : x;
              const desc = x && typeof x === "object" ? x.desc : "";
              const icon = x && typeof x === "object" ? x.icon : "";
              const rid = `${id}tl${f.k}${i}`;
              return `<label class="vx-tile" for="${rid}">
                <input type="radio" name="${id}${f.k}" id="${rid}" data-f="${f.k}" value="${val}" ${String(val) === String(v) ? "checked" : ""}${dis}>
                <div class="vx-tile-hd">${icon ? `<i class="fa-solid ${icon}"></i>` : ""}<span>${lab}</span></div>
                ${desc ? `<div class="vx-tile-desc">${desc}</div>` : ""}
              </label>`; }).join("")}
          </div>${hint}</div>`;
      }
      if (f.t === "select") {
        const o = resolve(f.opts, cur);
        const optsHtml = o.map(x => { const val = x && typeof x === "object" ? x.value : x;
                       const lab = x && typeof x === "object" ? x.label : x;
                       return `<option value="${val}" ${val == v ? "selected" : ""}>${lab}</option>`; }).join("");
        // `f.search` keeps the closed, single-line dropdown (unlike
        // "searchselect" below, which forces an always-open listbox) but adds
        // a filter box above it for a long option list — the same [data-fsearch]
        // wiring searchselect uses already works against any select, closed
        // or open, so no extra JS is needed here, only the markup.
        const searchBar = f.search ? `<div class="input-group input-group-sm mb-1">
            <input class="form-control" type="search" data-fsearch="${f.k}"
              placeholder="${f.searchPlaceholder || "Search…"}" aria-label="Search ${f.l}" aria-describedby="${id}searchStatus${f.k}">
            <button class="btn btn-outline-secondary" type="button" data-fsearchclear="${f.k}" title="Clear search" aria-label="Clear ${f.l} search"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
          <div id="${id}searchStatus${f.k}" data-fsearchstatus="${f.k}" style="font-size:10.8px;color:var(--text-dim);margin:-1px 0 5px" aria-live="polite">${o.length} options available</div>` : "";
        return wrap(`<label>${f.l}</label>
          ${searchBar}
          <select class="form-select form-select-sm" data-f="${f.k}"${dis}>${optsHtml}</select>`);
      }
      /* A native select is hard to use once a registry has dozens of tables.
         Keep its reliable value semantics, but pair it with a search box that
         filters its options in place. This works with dependent fields too:
         fieldHtml() recreates both controls when the parent selection changes. */
      if (f.t === "searchselect") {
        const o = resolve(f.opts, cur);
        return wrap(`<label>${f.l}</label>
          <div class="input-group input-group-sm mb-1">
            <input class="form-control" type="search" data-fsearch="${f.k}"
              placeholder="Search by table, line, or coverage…" aria-label="Search ${f.l}" aria-describedby="${id}searchStatus${f.k}">
            <button class="btn btn-outline-secondary" type="button" data-fsearchclear="${f.k}" title="Clear search" aria-label="Clear ${f.l} search"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
          <div id="${id}searchStatus${f.k}" data-fsearchstatus="${f.k}" style="font-size:10.8px;color:var(--text-dim);margin:-1px 0 5px" aria-live="polite">${o.length} tables available</div>
          <select class="form-select form-select-sm" data-f="${f.k}" size="${f.searchSize || 6}"${dis}>
            ${o.map(x => { const val = x && typeof x === "object" ? x.value : x;
                           const lab = x && typeof x === "object" ? x.label : x;
                           return `<option value="${val}" ${val == v ? "selected" : ""}>${lab}</option>`; }).join("")}
          </select>`);
      }
      if (f.t === "check") return wrap(`<label class="d-block">${f.l}</label>
        <div class="form-check form-switch"><input class="form-check-input" type="checkbox" data-f="${f.k}" ${v ? "checked" : ""}${dis}></div>`);
      if (f.t === "multi") {
        const o = resolve(f.opts, cur), sel = asArr(v);
        return `<div class="col-md-12${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <label class="mb-0">${f.l} <span class="vx-b gray" data-fc="${f.k}">${sel.length} selected</span></label>
            <div class="d-flex gap-2"><a href="#" data-fall="${f.k}" style="font-size:11.5px">Select all</a>
              <a href="#" data-fnone="${f.k}" style="font-size:11.5px">Clear</a></div>
          </div>
          <div data-fg="${f.k}" style="max-height:${f.maxH || 150}px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:9px 11px">
            ${o.length ? o.map((x, i) => {
              // options may be plain strings or {value,label}, same as `select`
              const val = x && typeof x === "object" ? x.value : x;
              const lab = x && typeof x === "object" ? x.label : x;
              return `<div class="form-check ${f.stacked ? "" : "form-check-inline"}">
                <input class="form-check-input" type="checkbox" data-fm="${f.k}" value="${val}" id="${id}m${f.k}${i}" ${sel.map(String).includes(String(val)) ? "checked" : ""}>
                <label class="form-check-label" for="${id}m${f.k}${i}">${lab}</label></div>`; }).join("")
              : `<div style="font-size:12px;color:var(--text-mute)">${f.empty || "Nothing to choose from yet."}</div>`}
          </div>${f.hint ? `<div style="font-size:10.8px;color:var(--text-dim);margin-top:3px">${f.hint}</div>` : ""}</div>`;
      }
      /* Single-select combobox — a closed control, same as `select`, but the
         search box lives INSIDE the opened panel instead of sitting as its
         own separate control above a plain <select> (that was `search: true`
         on `select`, now replaced everywhere it was used). One box when
         closed, one box when open — never two stacked controls. Shares its
         open/close, search-filter and outside-click wiring with `dropdown`
         below (same data-dd/data-ddbtn/data-ddpanel/data-ddsearch attributes)
         since both are "closed button opens a searchable panel"; only how a
         row selects differs — one click here, not a checkbox. */
      if (f.t === "combo") {
        const o = resolve(f.opts, cur);
        const selected = (v !== "" && v != null) ? o.find(x => String(x && typeof x === "object" ? x.value : x) === String(v)) : null;
        const curLabel = selected ? (typeof selected === "object" ? selected.label : selected) : (f.placeholder || "— none —");
        return `<div class="col-md-${f.w || 6}${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <label class="d-block">${f.l}</label>
          <div class="vx-dd" data-dd="${f.k}">
            <button type="button" class="vx-dd-btn" data-ddbtn="${f.k}"${dis}>
              <span data-combolabel="${f.k}">${curLabel}</span><i class="fa-solid fa-chevron-down"></i></button>
            <input type="hidden" data-f="${f.k}" value="${v ?? ""}">
            <div class="vx-dd-panel" data-ddpanel="${f.k}">
              <div class="vx-dd-head">
                <input type="text" class="form-control form-control-sm" placeholder="${f.searchPlaceholder || "Search…"}" data-ddsearch="${f.k}">
              </div>
              <div class="vx-dd-list" data-combolist="${f.k}">
                ${o.map((x, i) => { const val = x && typeof x === "object" ? x.value : x;
                  const lab = x && typeof x === "object" ? x.label : x;
                  // A divider row (empty value, label only — the "── other lines of
                  // business ──" separators tableOptsFor()/formulaOptsFor() emit) is
                  // shown but not selectable.
                  const isDivider = val === "" && /^(—|─)/.test(String(lab));
                  return isDivider
                    ? `<div class="vx-dd-opt-hd">${lab}</div>`
                    : `<div class="vx-dd-opt${String(val) === String(v ?? "") ? " sel" : ""}" data-comboopt="${f.k}" data-comboval="${val}" data-ddlabel="${String(lab).toLowerCase()}">${lab}</div>`;
                }).join("")}
              </div>
            </div>
          </div>${hint}</div>`;
      }
      /* Dropdown multi-select — a closed control that opens a searchable
         panel. For long lists (all 50 states) a flat inline checkbox wall
         buries the rest of the form and gives no way to find an entry; this
         collapses to a single summary line and supports typing to filter. */
      if (f.t === "dropdown") {
        const o = resolve(f.opts, cur), sel = asArr(v).map(String);
        // A divider row (empty value, label only — the "── primary coverages
        // ──" style separators coverageOptsFor()/tableOptsFor() emit for the
        // `combo`/`select` pickers) is shown but never selectable here either,
        // so a grouped option list reads the same way in a checklist as it
        // does in a single-choice dropdown.
        const isDivider = x => (x && typeof x === "object" ? x.value : x) === "" && /^(—|─)/.test(String(x && typeof x === "object" ? x.label : x));
        const real = o.filter(x => !isDivider(x));
        const summary = sel.length === 0 ? (f.placeholder || "None selected")
          : sel.length === real.length ? `All ${real.length} selected`
          : sel.length <= 6 ? sel.join(", ") : `${sel.length} selected`;
        return `<div class="col-md-${f.w || 12}${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <label class="d-block">${f.l}</label>
          <div class="vx-dd" data-dd="${f.k}">
            <button type="button" class="vx-dd-btn" data-ddbtn="${f.k}">
              <span data-fc="${f.k}">${summary}</span><i class="fa-solid fa-chevron-down"></i></button>
            <div class="vx-dd-panel" data-ddpanel="${f.k}">
              <div class="vx-dd-head">
                <input type="text" class="form-control form-control-sm" placeholder="Search…" data-ddsearch="${f.k}">
                <div class="d-flex gap-2 mt-2" style="font-size:11.5px">
                  <a href="#" data-fall="${f.k}">Select all</a><a href="#" data-fnone="${f.k}">Clear</a>
                </div>
              </div>
              <div class="vx-dd-list" data-fg="${f.k}">
                ${o.map((x, i) => { const val = x && typeof x === "object" ? x.value : x;
                  const lab = x && typeof x === "object" ? x.label : x;
                  return isDivider(x) ? `<div class="vx-dd-opt-hd">${lab}</div>`
                    : `<label class="vx-dd-opt" data-ddlabel="${String(lab).toLowerCase()}">
                    <input class="form-check-input" type="checkbox" data-fm="${f.k}" value="${val}" ${sel.includes(String(val)) ? "checked" : ""}>
                    <span>${lab}</span></label>`; }).join("")}
              </div>
            </div>
          </div>${f.hint ? `<div style="font-size:10.8px;color:var(--text-dim);margin-top:3px">${f.hint}</div>` : ""}</div>`;
      }
      /* Parent/child checkbox tree — mirrors the real coverage hierarchy (a
         primary coverage carrying child coverages) instead of flattening
         both levels into one list.

         Ticking a parent selects ONLY that parent: children are chosen
         deliberately, one at a time, because which child coverages a product
         writes is a real underwriting decision, not something to assume from
         picking the primary. The one automatic rule left is the opposite
         direction — ticking a child also marks its parent, since a child
         coverage cannot be written without the primary it rolls up into, and
         leaving that unticked would save an invalid combination.

         Groups collapse. They start collapsed unless something inside is
         already selected, so a long tree opens compact but never hides an
         existing selection. */
      if (f.t === "tree") {
        const groups = resolve(f.groups, cur), sel = asArr(v);
        const n = groups.reduce((a, g) => a + 1 + (g.children || []).length, 0);
        return `<div class="col-md-12${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <label class="mb-0">${f.l} <span class="vx-b gray" data-fc="${f.k}">${sel.length} of ${n} selected</span></label>
            <div class="d-flex gap-2"><a href="#" data-fexp="${f.k}" style="font-size:11.5px">Expand all</a>
              <a href="#" data-fcol="${f.k}" style="font-size:11.5px">Collapse all</a>
              <a href="#" data-fnone="${f.k}" style="font-size:11.5px">Clear</a></div>
          </div>
          <div data-fg="${f.k}" style="max-height:${f.maxH || 260}px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px 8px">
            ${groups.length ? groups.map((g, gi) => {
              const kids = g.children || [];
              const nSel = kids.filter(c => sel.includes(c)).length;
              const open = nSel > 0;   // never hide an existing selection
              return `<div class="vx-tree-grp" data-tg="${gi}">
                <div class="vx-tree-head">
                  <button type="button" class="vx-tree-tog ${open ? "on" : ""}" data-ftog="${f.k}" data-grp="${gi}"
                    ${kids.length ? "" : "disabled style=visibility:hidden"} aria-label="Toggle">
                    <i class="fa-solid fa-chevron-right"></i></button>
                  <input class="form-check-input" type="checkbox" data-fm="${f.k}" data-parent="1" data-grp="${gi}"
                    value="${g.label}" id="${id}t${f.k}p${gi}" ${sel.includes(g.label) ? "checked" : ""}>
                  <label for="${id}t${f.k}p${gi}" style="font-weight:600;font-size:12.6px;cursor:pointer;margin:0">${g.label}</label>
                  ${g.badge ? `<span class="vx-b blue">${g.badge}</span>` : ""}
                  ${kids.length ? `<span class="vx-b gray" data-fgc="${gi}" style="margin-left:auto">${nSel}/${kids.length}</span>` : ""}
                </div>
                <div class="vx-tree-kids ${open ? "on" : ""}" data-fkids="${gi}">
                  ${kids.map((c, ci) => `<label class="vx-tree-kid">
                    <input class="form-check-input" type="checkbox" data-fm="${f.k}" data-grp="${gi}"
                      value="${c}" ${sel.includes(c) ? "checked" : ""}>
                    <span>${c}</span></label>`).join("")}
                </div>
              </div>`; }).join("")
              : `<div style="font-size:12px;color:var(--text-mute);padding:6px 4px">No coverages defined for this line of business yet.</div>`}
          </div>${f.hint ? `<div style="font-size:10.8px;color:var(--text-dim);margin-top:3px">${f.hint}</div>` : ""}</div>`;
      }
      if (f.t === "textarea") return `<div class="col-md-12${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}"><label>${f.l}</label>
        <textarea class="form-control form-control-sm" rows="2" data-f="${f.k}">${v}</textarea>${hint}</div>`;
      /* Dynamic column schema builder — a repeatable list of (name, type)
         pairs instead of a fixed set of inputs, for records whose structure
         the user defines rather than the form author. Stored as an array of
         {name,type} objects on the field key, same as `multi`/`tree` store
         arrays of their selections. */
      if (f.t === "columns") {
        const list = Array.isArray(v) ? v : [];
        return `<div class="col-md-12${lk ? " vx-fld-locked" : ""}" data-fw="${f.k}">
          <label class="d-block">${f.l}</label>
          <div data-fg="${f.k}" data-fgtype="columns">${list.map(c => colRowHtml(f.k, c)).join("")}</div>
          <div data-colempty="${f.k}" style="font-size:12px;color:var(--text-mute);margin-bottom:8px${list.length ? ";display:none" : ""}">No columns defined yet — add at least one.</div>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-coladd="${f.k}"${dis}><i class="fa-solid fa-plus me-1"></i>Add Column</button>
          ${hint}</div>`;
      }
      return wrap(`<label>${f.l}</label><input type="${f.t || "text"}" ${f.step ? `step="${f.step}"` : ""}
        class="form-control form-control-sm" data-f="${f.k}" value="${v}"${dis}${ro ? " readonly" : ""}>`);
    }

    const inputs = flds.map(f => fieldHtml(f, r)).join("");

    /* A caller can name the dialog after the RECORD and put a header block
       above the fields. The generic "Edit Rating Factor" title told you which
       screen you were on but not which of 50-odd rows you had opened, which
       matters most on the one action that changes what gets charged. */
    const titleText = opt.formTitle ? opt.formTitle(rec, isNew) : `${isNew ? "Add" : "Edit"} ${name}`;
    const headerHtml = opt.formHeader ? (opt.formHeader(rec, isNew) || "") : "";

    vxModal(titleText,
      `${headerHtml}<div class="row g-3" data-vxflds>${inputs}</div>
       <div class="vx-ai mt-3"><span class="tag"><i class="fa-solid fa-wand-magic-sparkles"></i>AI Validation</span>
       No conflicting effective-date ranges detected. Factor values fall within the expected statistical range for this ${name.toLowerCase()} type.
       ${isNew ? "This will be created in the current draft version." : "Changes create a new revision; the prior value stays queryable for in-force policies."}</div>`,
      /* `Save & Add Another` keeps the dialog open and reopens it empty, so
         entering a run of records is one continuous action instead of
         re-clicking Add between each. Offered on Add only — there is no
         "another" when editing one specific row — and only where the caller
         asks for it, since it makes no sense for one-off records. */
      [{ t: "Cancel", c: "secondary" },
       ...(isNew && opt.addAnother ? [{ t: "Save & Add Another", c: "secondary", fn: () => submit(true) }] : []),
       { t: isNew ? `Save ${name}` : `Save ${name}`, c: "primary", fn: () => submit(false) }]);

    async function submit(again) {
        const el = document.getElementById("vxModal");
        el.querySelectorAll("[data-f]").forEach(i => {
          /* A `tiles` field renders one radio per option, all sharing the same
             data-f — only the checked one should win, or the last option in
             DOM order would silently overwrite whatever the user actually
             picked. */
          if (i.type === "radio") { if (i.checked) r[i.dataset.f] = i.value; return; }
          r[i.dataset.f] = i.type === "checkbox" ? i.checked : (i.type === "number" ? +i.value : i.value);
        });
        el.querySelectorAll("[data-fg]").forEach(gp => {
          r[gp.dataset.fg] = gp.dataset.fgtype === "columns"
            ? readColumnRows(gp)
            : [...gp.querySelectorAll("[data-fm]:checked")].map(c => c.value);
        });
        /* A field marked `fanOut` may hold several values on Add; each one
           becomes its own record. Filed data is per-state, so entering the
           same base rate for twenty states should be one submission, not
           twenty. Edit still updates exactly the row you opened. */
        const fan = isNew && (opt.form || []).find(x => x.fanOut && Array.isArray(r[x.k]) && r[x.k].length > 1);
        if (fan) {
          const values = r[fan.k];
          let last;
          for (const v of values) last = await API.create(key, { ...r, [fan.k]: v });
          if (opt.onAfterSave) await opt.onAfterSave(last && last.data, true);
          vxToast(`${values.length} ${name.toLowerCase()}s created`, `One per ${fan.l.toLowerCase()}: ${values.join(", ")}`, "ok");
          vxAutoSave(); reload(last && last.data && last.data.id);
          if (again) setTimeout(() => formModal(null), 260);
          return;
        }
        const fanSingle = (opt.form || []).find(x => x.fanOut && Array.isArray(r[x.k]));
        if (fanSingle) r[fanSingle.k] = r[fanSingle.k][0] || "";
        const res = isNew ? await API.create(key, r) : await API.update(key, rec.id, r);
        /* Some records need follow-on work the grid can't know about — a new
           tenant, for instance, has to be provisioned with its own partition
           of configuration or switching into it shows empty screens. Same
           opt-in shape as onHist. */
        if (opt.onAfterSave) await opt.onAfterSave(res.data || r, isNew);
        vxToast(`${name} ${isNew ? "created" : "updated"}`, r.name || r.code || "Configuration saved", "ok");
        vxAutoSave(); reload(res.data && res.data.id);
        /* Reopen a blank form for the next one. Deferred so this dialog has
           finished closing before the next opens. */
        if (again) setTimeout(() => formModal(null), 260);
    }

    /* ---- form interactivity ---- */
    const modal = document.getElementById("vxModal");
    if (!modal) return;

    // Mirror the live DOM back into `r` so dependent fields resolve against
    // what the user has actually chosen, not the value the form opened with.
    const sync = () => {
      modal.querySelectorAll("[data-f]").forEach(i => {
        if (i.type === "radio") { if (i.checked) r[i.dataset.f] = i.value; return; }
        r[i.dataset.f] = i.type === "checkbox" ? i.checked : (i.type === "number" ? +i.value : i.value);
      });
      modal.querySelectorAll("[data-fg]").forEach(gp => {
        r[gp.dataset.fg] = gp.dataset.fgtype === "columns"
          ? readColumnRows(gp)
          : [...gp.querySelectorAll("[data-fm]:checked")].map(c => c.value);
      });
    };
    const updateCount = k => {
      const badge = modal.querySelector(`[data-fc="${k}"]`);
      const gp = modal.querySelector(`[data-fg="${k}"]`);
      if (!badge || !gp) return;
      const boxes = [...gp.querySelectorAll("[data-fm]")];
      const on = boxes.filter(b => b.checked);
      // dropdown fields summarise their selection in the closed button
      if (modal.querySelector(`[data-dd="${k}"]`)) {
        const fld = flds.find(x => x.k === k) || {};
        badge.textContent = on.length === 0 ? (fld.placeholder || "None selected")
          : on.length === boxes.length ? `All ${boxes.length} selected`
          : on.length <= 6 ? on.map(b => b.value).join(", ")
          : `${on.length} selected`;
        return;
      }
      badge.textContent = /of/.test(badge.textContent) ? `${on.length} of ${boxes.length} selected` : `${on.length} selected`;
    };

    function wire() {
      // Searchable single-select: hide non-matching options without changing
      // the selected value. Matching includes the displayed label and value.
      modal.querySelectorAll("[data-fsearch]").forEach(inp => {
        const select = modal.querySelector(`[data-f="${inp.dataset.fsearch}"]`);
        if (!select) return;
        const status = modal.querySelector(`[data-fsearchstatus="${inp.dataset.fsearch}"]`);
        const filter = () => {
          const q = inp.value.trim().toLowerCase();
          let matches = 0;
          [...select.options].forEach(opt => {
            const visible = !q || (opt.textContent + " " + opt.value).toLowerCase().includes(q);
            opt.hidden = !visible;
            if (visible) matches++;
          });
          if (status) status.textContent = q
            ? (matches ? `${matches} matching table${matches === 1 ? "" : "s"}` : "No matching tables — try another search")
            : `${matches} tables available`;
        };
        inp.oninput = filter;
        const clear = modal.querySelector(`[data-fsearchclear="${inp.dataset.fsearch}"]`);
        if (clear) clear.onclick = () => { inp.value = ""; filter(); inp.focus(); };
      });
      // dropdown multi-select: open/close, search, outside-click
      modal.querySelectorAll("[data-ddbtn]").forEach(b => b.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        const dd = modal.querySelector(`[data-dd="${b.dataset.ddbtn}"]`);
        const wasOpen = dd.classList.contains("on");
        modal.querySelectorAll("[data-dd]").forEach(x => x.classList.remove("on"));
        if (!wasOpen) {
          dd.classList.add("on");
          const s = dd.querySelector("[data-ddsearch]");
          if (s) setTimeout(() => s.focus(), 30);
        }
      });
      modal.querySelectorAll("[data-ddsearch]").forEach(inp => {
        inp.onclick = e => e.stopPropagation();
        inp.oninput = () => {
          const q = inp.value.trim().toLowerCase();
          modal.querySelectorAll(`[data-dd="${inp.dataset.ddsearch}"] .vx-dd-opt`).forEach(o =>
            o.classList.toggle("hide", !!q && !o.dataset.ddlabel.includes(q)));
        };
      });
      modal.querySelectorAll("[data-ddpanel]").forEach(p => p.onclick = e => e.stopPropagation());
      if (!modal.__ddOutside) {
        modal.__ddOutside = true;
        modal.addEventListener("click", () => modal.querySelectorAll("[data-dd]").forEach(x => x.classList.remove("on")));
      }
      // combo single-select: click a row to pick it and close — the same
      // open/close/search/outside-click wiring above already applies, since
      // combo shares the dropdown's data-dd/data-ddbtn/data-ddpanel/data-ddsearch.
      modal.querySelectorAll("[data-comboopt]").forEach(o => o.onclick = () => {
        const k = o.dataset.comboopt, val = o.dataset.comboval;
        const hidden = modal.querySelector(`input[type="hidden"][data-f="${k}"]`);
        if (hidden) { hidden.value = val; hidden.dispatchEvent(new Event("change", { bubbles: true })); }
        const label = modal.querySelector(`[data-combolabel="${k}"]`);
        if (label) label.textContent = o.textContent;
        modal.querySelectorAll(`[data-combolist="${k}"] .vx-dd-opt`).forEach(x => x.classList.toggle("sel", x === o));
        const dd = modal.querySelector(`[data-dd="${k}"]`);
        if (dd) dd.classList.remove("on");
        sync();
      });

      // `columns` field: add/remove a row. Delegated on the modal (not bound
      // per-button) so a row appended after initial render is removable too.
      if (!modal.__colWired) {
        modal.__colWired = true;
        modal.addEventListener("click", e => {
          const add = e.target.closest("[data-coladd]");
          if (add) {
            e.preventDefault();
            const k = add.dataset.coladd;
            const gp = modal.querySelector(`[data-fg="${k}"]`);
            const tmp = document.createElement("div");
            tmp.innerHTML = colRowHtml(k, null);
            gp.appendChild(tmp.firstElementChild);
            const empty = modal.querySelector(`[data-colempty="${k}"]`);
            if (empty) empty.style.display = "none";
            sync();
            return;
          }
          const rm = e.target.closest("[data-colrm]");
          if (rm) {
            e.preventDefault();
            const k = rm.dataset.colrm;
            rm.closest("[data-colrow]").remove();
            const gp = modal.querySelector(`[data-fg="${k}"]`);
            const empty = modal.querySelector(`[data-colempty="${k}"]`);
            if (empty && gp && !gp.querySelector("[data-colrow]")) empty.style.display = "";
            sync();
          }
        });
        // Min/Max only make sense for a Range column — show them only once
        // that type is picked, so every other column stays a plain two-field row.
        modal.addEventListener("change", e => {
          const sel = e.target.closest("[data-colsel]");
          if (!sel) return;
          const row = sel.closest("[data-colrow]");
          const isRange = sel.value === "Range";
          const min = row.querySelector("[data-colmin]");
          const max = row.querySelector("[data-colmax]");
          if (min) min.style.display = isRange ? "" : "none";
          if (max) max.style.display = isRange ? "" : "none";
          sync();
        });
      }

      // select all / clear
      modal.querySelectorAll("[data-fall]").forEach(a => a.onclick = e => {
        e.preventDefault();
        const k = a.dataset.fall;
        modal.querySelectorAll(`[data-fg="${k}"] [data-fm]`).forEach(c => c.checked = true);
        updateCount(k); sync();
      });
      modal.querySelectorAll("[data-fnone]").forEach(a => a.onclick = e => {
        e.preventDefault();
        const k = a.dataset.fnone;
        modal.querySelectorAll(`[data-fg="${k}"] [data-fm]`).forEach(c => c.checked = false);
        modal.querySelectorAll(`[data-fg="${k}"] [data-fgc]`).forEach(b => {
          const kids = modal.querySelectorAll(`[data-fg="${k}"] [data-fkids="${b.dataset.fgc}"] [data-fm]`).length;
          b.textContent = `0/${kids}`;
        });
        updateCount(k); sync();
      });
      // tree: collapse / expand a group
      const setOpen = (k, grp, open) => {
        const gp = modal.querySelector(`[data-fg="${k}"]`);
        if (!gp) return;
        const tog = gp.querySelector(`[data-ftog="${k}"][data-grp="${grp}"]`);
        const kids = gp.querySelector(`[data-fkids="${grp}"]`);
        if (tog) tog.classList.toggle("on", open);
        if (kids) kids.classList.toggle("on", open);
      };
      modal.querySelectorAll("[data-ftog]").forEach(b => b.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        setOpen(b.dataset.ftog, b.dataset.grp, !b.classList.contains("on"));
      });
      modal.querySelectorAll("[data-fexp]").forEach(a => a.onclick = e => {
        e.preventDefault();
        modal.querySelectorAll(`[data-ftog="${a.dataset.fexp}"]`).forEach(b => setOpen(a.dataset.fexp, b.dataset.grp, true));
      });
      modal.querySelectorAll("[data-fcol]").forEach(a => a.onclick = e => {
        e.preventDefault();
        modal.querySelectorAll(`[data-ftog="${a.dataset.fcol}"]`).forEach(b => setOpen(a.dataset.fcol, b.dataset.grp, false));
      });

      // tree checkboxes. Parent selects only itself; a child additionally
      // marks its parent, because a child coverage cannot be written without
      // the primary it rolls up into.
      const updateGroupCount = (k, grp) => {
        const gp = modal.querySelector(`[data-fg="${k}"]`);
        const badge = gp && gp.querySelector(`[data-fgc="${grp}"]`);
        if (!badge) return;
        const kids = [...gp.querySelectorAll(`[data-fkids="${grp}"] [data-fm]`)];
        badge.textContent = `${kids.filter(x => x.checked).length}/${kids.length}`;
      };
      modal.querySelectorAll("[data-fm][data-grp]").forEach(cb => cb.onchange = () => {
        const k = cb.dataset.fm, grp = cb.dataset.grp;
        const gp = modal.querySelector(`[data-fg="${k}"]`);
        if (cb.dataset.parent !== "1" && cb.checked) {
          const parent = gp.querySelector(`[data-fm="${k}"][data-parent="1"][data-grp="${grp}"]`);
          if (parent) parent.checked = true;
        }
        updateGroupCount(k, grp); updateCount(k); sync();
      });
      modal.querySelectorAll('[data-fg] [data-fm]:not([data-grp])').forEach(cb =>
        cb.onchange = () => { updateCount(cb.dataset.fm); sync(); });

      // re-render fields whose options depend on another field — `dependsOn`
      // may name one key or several (e.g. a system-generated code depends on
      // both Name and Line of Business), and the source itself may be more
      // than one element: a `tiles` field is a radio per option (data-f), and
      // a `multi`/`dropdown` field (e.g. a multi-select Line of Business) is a
      // checkbox per option (data-fm) — every matching element, of either
      // kind, gets its own listener.
      flds.filter(f => f.dependsOn).forEach(f => {
        const deps = Array.isArray(f.dependsOn) ? f.dependsOn : [f.dependsOn];
        deps.forEach(depKey => {
          const srcs = [...modal.querySelectorAll(`[data-f="${depKey}"]`), ...modal.querySelectorAll(`[data-fm="${depKey}"]`)];
          srcs.forEach(src => src.addEventListener("change", () => {
          sync();
          // the dependency changed, so a stale selection no longer applies —
          // skipped for a field with its own `val`, which recomputes instead
          // of reading back a stored property.
          if (f.clearOnChange !== false && typeof f.val !== "function") r[f.k] = Array.isArray(r[f.k]) ? [] : "";
          const tmp = document.createElement("div");
          tmp.innerHTML = fieldHtml(f, r);
          const holder = modal.querySelector(`[data-fw="${f.k}"]`);
          if (holder) {
            if (tmp.firstElementChild) holder.replaceWith(tmp.firstElementChild);
            else holder.remove();
          } else if (tmp.firstElementChild) {
            /* No holder to replace — a `hideIf` field (e.g. "Computed how",
               shown only once Type is set to Computed) starts with no DOM
               node at all, so there was nothing here for a dependsOn change
               to find and swap. It has just become visible for the first
               time this session: insert it back where `flds` order says it
               belongs — right after the nearest earlier field that currently
               has a holder — rather than dropping it silently. */
            const row = modal.querySelector("[data-vxflds]");
            if (row) {
              const idx = flds.indexOf(f);
              let anchor = null;
              for (let i = idx - 1; i >= 0 && !anchor; i--) {
                anchor = modal.querySelector(`[data-fw="${flds[i].k}"]`);
              }
              if (anchor) anchor.after(tmp.firstElementChild);
              else row.prepend(tmp.firstElementChild);
            }
          }
          wire();
          }));
        });
      });
    }
    wire();
  }

  function histModal(rec) {
    const ev = [
      { t: "2026-07-28 14:12", u: "vikas.kumar@veridex.io", a: "Updated value", n: "Adjusted per Q3 rate filing", v: "v2026.03" },
      { t: "2026-05-02 09:44", u: "system.ai@veridex.io", a: "AI recommendation applied", n: "Suggested +3% based on loss trend", v: "v2026.03" },
      { t: "2026-03-09 11:05", u: "j.romero@veridex.io", a: "Created record", n: "Initial configuration", v: "v2026.03" },
      { t: "2025-11-01 08:30", u: "s.patel@veridex.io", a: "Migrated from workbook", n: "Imported from source .xlsb", v: "v2025.11" },
    ];
    if (opt.onHist) return opt.onHist(rec);
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

  function columnsModal() {
    const state = gridApi.getColumnState();
    const items = cols.map(c => {
      const cs = state.find(s => s.colId === c.k);
      const visible = !(cs && cs.hide);
      return `<div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" data-col="${c.k}" ${visible ? "checked" : ""} id="${id}col_${c.k}">
        <label class="form-check-label" for="${id}col_${c.k}">${c.l}</label></div>`;
    }).join("");
    vxModal("Show / Hide Columns", `<div class="row g-1">${items}</div>
      <div class="vx-ai mt-2" style="font-size:12px"><i class="fa-solid fa-circle-info me-1"></i>Remembered for this browser tab, same as filters and search.</div>`,
      [{ t: "Close", c: "secondary" }], "modal-sm");
    document.getElementById("vxModal").querySelectorAll("[data-col]").forEach(cb => {
      cb.onchange = () => {
        gridApi.setColumnsVisible([cb.dataset.col], cb.checked);
        st.hidden = gridApi.getColumnState().filter(s => s.hide).map(s => s.colId);
        persistState();
      };
    });
  }

  function clearFilters() {
    st.q = ""; st.filters = {};
    root.querySelectorAll("[data-mfm]").forEach(c => c.checked = false);
    (opt.filters || []).filter(f => f.multi).forEach(f => {
      const el = root.querySelector(`[data-mflabel="${f.k}"]`); if (el) el.textContent = `${f.l}: All`;
    });
    document.getElementById(id + "q").value = "";
    root.querySelectorAll("[data-f]").forEach(s => s.value = "");
    persistState();
    gridApi.setGridOption("quickFilterText", "");
    gridApi.onFilterChanged();
  }

  /* ---------- toolbar wiring ---------- */
  document.getElementById(id + "q").oninput = e => { st.q = e.target.value; persistState(); gridApi.setGridOption("quickFilterText", st.q); };
  root.querySelectorAll("select[data-f]").forEach(s => s.onchange = () => { st.filters[s.dataset.f] = s.value; persistState(); gridApi.onFilterChanged(); });

  /* multi-select filter popovers */
  (function wireMultiFilters() {
    const relabel = k => {
      const f = (opt.filters || []).find(x => x.k === k); if (!f) return;
      const sel = Array.isArray(st.filters[k]) ? st.filters[k] : [];
      const el = root.querySelector(`[data-mflabel="${k}"]`); if (!el) return;
      el.textContent = sel.length === 0 ? `${f.l}: All`
        : sel.length === f.opts.length ? `${f.l}: All ${f.opts.length}`
        : sel.length <= 3 ? `${f.l}: ${sel.join(", ")}` : `${f.l}: ${sel.length} selected`;
    };
    const apply = k => {
      st.filters[k] = [...root.querySelectorAll(`[data-mfm="${k}"]:checked`)].map(c => c.value);
      relabel(k); persistState(); gridApi.onFilterChanged();
    };
    root.querySelectorAll("[data-mfbtn]").forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const dd = root.querySelector(`[data-mf="${b.dataset.mfbtn}"]`);
      const open = dd.classList.contains("on");
      root.querySelectorAll("[data-mf]").forEach(x => x.classList.remove("on"));
      if (!open) { dd.classList.add("on"); const q = dd.querySelector("[data-mfsearch]"); if (q) setTimeout(() => q.focus(), 30); }
    });
    document.addEventListener("click", e => {
      if (!e.target.closest("[data-mf]")) root.querySelectorAll("[data-mf]").forEach(x => x.classList.remove("on"));
    });
    root.querySelectorAll("[data-mfsearch]").forEach(inp => inp.oninput = () => {
      const q = inp.value.toLowerCase();
      root.querySelectorAll(`[data-mflist="${inp.dataset.mfsearch}"] .vx-dd-opt`).forEach(o => {
        o.style.display = o.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
    root.querySelectorAll("[data-mfall]").forEach(a => a.onclick = e => {
      e.preventDefault();
      root.querySelectorAll(`[data-mfm="${a.dataset.mfall}"]`).forEach(c => { if (c.closest(".vx-dd-opt").style.display !== "none") c.checked = true; });
      apply(a.dataset.mfall);
    });
    root.querySelectorAll("[data-mfnone]").forEach(a => a.onclick = e => {
      e.preventDefault();
      root.querySelectorAll(`[data-mfm="${a.dataset.mfnone}"]`).forEach(c => c.checked = false);
      apply(a.dataset.mfnone);
    });
    root.querySelectorAll("[data-mfm]").forEach(c => c.onchange = () => apply(c.dataset.mfm));
  })();
  const clrf = document.getElementById(id + "clrf"); if (clrf) clrf.onclick = clearFilters;
  document.getElementById(id + "cols").onclick = columnsModal;
  if (!opt.readOnly) document.getElementById(id + "add").onclick = () => formModal(null);
  document.getElementById(id + "imp").onclick = importModal;
  document.getElementById(id + "exp").onclick = () => vxCSV(key, cols,
    (typeof COSMOS !== "undefined" && COSMOS.tenantScoped.has(key)) ? COSMOS.query(key, {}) : VX[key]);

  if (bulk.length) {
    document.getElementById(id + "selclear").onclick = () => { gridApi.deselectAll(); };
    root.querySelectorAll("[data-ba]").forEach(b => b.onclick = () => {
      const recs = gridApi.getSelectedRows();
      bulk[+b.dataset.ba].fn(recs);
    });
  }

  // initial quick-filter application if a search was restored from a prior session
  if (st.q) gridApi.setGridOption("quickFilterText", st.q);

  reload();
  /* formModal exposed so a caller can open the Add/Edit form from outside
     the grid's own row actions — e.g. an "Edit" button on a detail panel
     opened via a custom rowAction, which otherwise has no way back into the
     grid's real edit form. */
  return { reload, state: st, formModal, edit: rec => formModal(rec) };
}
