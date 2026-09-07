/* Veridex Rating Engine — column-header tooltips
 * Decorates every <th> inside table.vx-t with an accessible, theme-aware
 * hover/focus tooltip sourced from window.VX_TIPS (tooltip-dictionary.js).
 * - 250 ms hover delay, flip-up near the viewport bottom.
 * - Keyboard: Tab focuses, Escape dismisses.
 * - Dynamic tables (rendered from JS strings) are picked up by a
 *   MutationObserver; a manual window.vxApplyColumnTips(root) is also exposed.
 */
(function () {
  if (window.__vxColumnTipsLoaded) return;
  window.__vxColumnTipsLoaded = true;

  const DIC = window.VX_TIPS || {};
  const STUB = "Documentation pending — please add this header to assets/js/tooltip-dictionary.js.";
  const unknownHeaders = new Set();

  const norm = s => (s || "").replace(/\s+/g, " ").trim();

  function resolve(rawLabel, th) {
    const key = norm(rawLabel);
    const entry = DIC[key];
    let parts;
    if (!entry) {
      unknownHeaders.add(key);
      parts = { d: STUB, w: "", e: "" };
    } else if (typeof entry === "string") {
      parts = { d: entry, w: "", e: "" };
    } else {
      parts = { d: entry.d || "", w: entry.w || "", e: entry.e || "" };
    }
    if (th && th.dataset && th.dataset.vxRange) {
      parts.w = (parts.w ? parts.w + " " : "") + "Range: " + th.dataset.vxRange + ".";
    }
    return parts;
  }

  function buildTooltipBody(parts) {
    const html = [];
    if (parts.d) html.push(`<div class="vx-th-tip-body">${escapeHtml(parts.d)}</div>`);
    if (parts.w) html.push(`<div class="vx-th-tip-why"><b>Why it matters:</b> ${escapeHtml(parts.w)}</div>`);
    if (parts.e) html.push(`<div class="vx-th-tip-ex"><b>Example:</b> ${escapeHtml(parts.e)}</div>`);
    html.push(`<div class="vx-th-tip-ctx">ERP insurance platform · Rating Engine</div>`);
    return html.join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[c]));
  }

  function place(tip, th) {
    const r = th.getBoundingClientRect();
    const tipR = tip.getBoundingClientRect();
    let placement = "bottom";
    let top = r.bottom + window.scrollY + 8;
    if (r.bottom + tipR.height + 16 > window.innerHeight && r.top - tipR.height - 16 > 0) {
      placement = "top";
      top = r.top + window.scrollY - tipR.height - 8;
    }
    let left = r.left + window.scrollX + r.width / 2 - tipR.width / 2;
    left = Math.max(8, Math.min(left, window.scrollX + window.innerWidth - tipR.width - 8));
    tip.style.top = top + "px";
    tip.style.left = left + "px";
    tip.dataset.placement = placement;
  }

  function decorate(th) {
    if (th.dataset.vxTipReady) return;
    th.dataset.vxTipReady = "1";
    th.setAttribute("tabindex", "0");

    const label = norm(th.textContent);
    if (!label) return;
    if (th.querySelector(":scope > .vx-th-tip-icon")) return;

    const tipId = "vxtip-" + Math.random().toString(36).slice(2, 10);
    const tip = document.createElement("div");
    tip.className = "vx-th-tip";
    tip.id = tipId;
    tip.setAttribute("role", "tooltip");
    tip.innerHTML = buildTooltipBody(resolve(label, th));
    document.body.appendChild(tip);
    th.setAttribute("aria-describedby", tipId);

    th.insertAdjacentHTML(
      "beforeend",
      ' <i class="fa-solid fa-circle-info vx-th-tip-icon" aria-hidden="true"></i>'
    );

    let openTimer = null;
    const show = () => {
      clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        tip.classList.add("vx-th-tip-open");
        place(tip, th);
      }, 250);
    };
    const hide = () => {
      clearTimeout(openTimer);
      tip.classList.remove("vx-th-tip-open");
    };
    th.addEventListener("mouseenter", show);
    th.addEventListener("mouseleave", hide);
    th.addEventListener("focus", show, true);
    th.addEventListener("blur", hide, true);
    th.addEventListener("keydown", e => {
      if (e.key === "Escape") hide();
    });
    window.addEventListener("resize", () => {
      if (tip.classList.contains("vx-th-tip-open")) place(tip, th);
    });
  }

  function apply(root) {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll("table.vx-t thead th").forEach(decorate);
  }

  function reportUnknowns() {
    if (!unknownHeaders.size || !window.console) return;
    const list = Array.from(unknownHeaders);
    console.warn(
      "[vx-tooltips] No dictionary entry for %d header(s): %o. Add them to assets/js/tooltip-dictionary.js.",
      list.length, list
    );
  }

  function start() {
    apply(document);
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (!(n instanceof Element)) return;
          if (n.matches && n.matches("table.vx-t")) apply(n);
          n.querySelectorAll && n.querySelectorAll("table.vx-t").forEach(apply);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(reportUnknowns, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.vxApplyColumnTips = apply;
})();