/* ==========================================================================
   Rating context selector — a real, working LOB → Product → Version picker
   for the screens where one product+version genuinely applies (Rating
   Factors, Formula Builder, Versions). Not used on inherently cross-LOB
   screens (Discounts, Taxes, Geography) — those keep their existing LOB
   filter instead of a fake single-version scope.

   vxContextBar(el, opt):
     opt.onChange({lob, product, version}) fires on init and on every change
     (version may be null if the product has no versions on file — still a
     real state, not hidden).
   Selection persists per-tab in sessionStorage, same pattern as vxGrid's
   filter/search persistence.
   ========================================================================== */
function vxContextBar(el, opt) {
  const root = typeof el === "string" ? document.querySelector(el) : el;
  const STORE = "vxRatingContext";
  let state = {};
  try { state = JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch (e) {}

  const lobs = [...new Set(VX.lobs.filter(l => l.status === "Active").map(l => l.name))];
  if (!lobs.includes(state.lob)) state.lob = lobs[0];

  function productsFor(lob) { return VX.products.filter(p => p.lob === lob).map(p => p.name); }
  function versionsFor(product) {
    return VX.versions.filter(v => v.product === product).sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart));
  }

  function normalize() {
    const prods = productsFor(state.lob);
    if (!prods.includes(state.product)) state.product = prods[0] || null;
    const vers = state.product ? versionsFor(state.product) : [];
    if (!vers.some(v => v.version === state.version)) state.version = (vers[0] && vers[0].version) || null;
  }
  normalize();

  function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
  function currentVersion() { return VX.versions.find(v => v.product === state.product && v.version === state.version) || null; }
  function fire() { opt.onChange && opt.onChange({ lob: state.lob, product: state.product, version: state.version, versionRec: currentVersion() }); }

  function render() {
    const prods = productsFor(state.lob);
    const vers = state.product ? versionsFor(state.product) : [];
    const vr = currentVersion();
    root.innerHTML = `
      <div class="vx-ctxbar">
        <div class="seg"><label>Line of Business</label>
          <select class="form-select form-select-sm" id="ctxLob">${lobs.map(l => `<option ${l === state.lob ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <i class="fa-solid fa-chevron-right vx-ctx-sep"></i>
        <div class="seg"><label>Rating Plan</label>
          <select class="form-select form-select-sm" id="ctxProduct">${prods.length ? prods.map(p => `<option ${p === state.product ? "selected" : ""}>${p}</option>`).join("") : `<option>—</option>`}</select></div>
        <i class="fa-solid fa-chevron-right vx-ctx-sep"></i>
        <div class="seg"><label>Version</label>
          <select class="form-select form-select-sm" id="ctxVersion" ${vers.length ? "" : "disabled"}>
            ${vers.length ? vers.map(v => `<option value="${v.version}" ${v.version === state.version ? "selected" : ""}>${v.version} · ${v.status}</option>`).join("") : `<option>No versions on file</option>`}</select></div>
        ${vr ? `<div class="seg meta"><label>Effective</label><div class="val">${vr.effectiveStart || "not set"}${vr.effectiveEnd ? " – " + vr.effectiveEnd : ""}</div></div>` : ""}
        ${vr ? `<div class="seg meta"><label>Status</label><div class="val"><span class="vx-b ${
          { Draft: "amber", Scheduled: "blue", Published: "green", Expired: "gray", Archived: "gray" }[vr.status] || "gray"}">${vr.status}</span></div></div>` : ""}
      </div>
      ${opt.note ? `<div style="font-size:11.5px;color:var(--text-mute);margin:-8px 0 16px;padding-left:16px">
        <i class="fa-solid fa-circle-info me-1"></i>${opt.note}</div>` : ""}`;
    document.getElementById("ctxLob").onchange = e => { state.lob = e.target.value; normalize(); persist(); render(); fire(); };
    document.getElementById("ctxProduct").onchange = e => { state.product = e.target.value; normalize(); persist(); render(); fire(); };
    const vSel = document.getElementById("ctxVersion");
    if (vers.length) vSel.onchange = e => { state.version = e.target.value; persist(); fire(); };
  }

  render();
  persist();
  fire();
  return {
    get: () => ({ lob: state.lob, product: state.product, version: state.version, versionRec: currentVersion() }),
    refresh: () => { normalize(); persist(); render(); fire(); },
  };
}
