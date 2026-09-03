/* ==========================================================================
   VeriDex Global UI/UX Framework v3.0 — static compliance gate
   Run:  node tests/framework-compliance.test.js       (from platform/)

   §36 requires compliance to be testable, not asserted. This is the static
   half: tokens, hex literals, z-index, titles, spacing, dark mode, fonts,
   contrast of the declared palette. The runtime half (ARIA, focus, zoom)
   lives in the browser suite, because it needs a rendered DOM.

   A green check that cannot fail is worse than no check, so every rule here
   was confirmed to FAIL against the pre-migration code before being kept.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "assets/css/app.css"), "utf8");
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));
const jsFiles = fs.readdirSync(path.join(ROOT, "assets/js")).filter(f => f.endsWith(".js"));
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  (ok ? pass++ : fail++);
  results.push({ name, ok, detail: detail || "" });
}
function section(t) { results.push({ section: t }); }

/* ---------- contrast ---------- */
function lum(hex) {
  const c = hex.replace("#", "").match(/../g).map(h => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function token(name) {
  const m = css.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{3,8})"));
  return m ? m[1] : null;
}

/* ======================================================================
   §3  Colour system
   ====================================================================== */
section("§3 Colour system");

const REQUIRED_TOKENS = [
  "color-brand", "color-brand-dark", "color-brand-amber", "color-brand-light",
  "color-link", "color-focus", "color-control-border", "color-on-brand",
  "color-shell", "color-shell-accent", "color-border-dark",
  "color-ink", "color-ink-secondary", "color-surface", "color-panel", "color-border",
  "status-draft", "status-review", "status-approved", "status-published",
  "status-superseded", "status-retired",
  "status-draft-bg", "status-review-bg", "status-approved-bg",
  "status-published-bg", "status-superseded-bg", "status-retired-bg",
  "color-success", "color-warning", "color-danger", "color-info",
  "color-muted", "color-disabled",
  "color-success-bg", "color-warning-bg", "color-danger-bg", "color-info-bg",
];
const missingTokens = REQUIRED_TOKENS.filter(t => !new RegExp("--" + t + "\\s*:").test(css));
check("all v3.0 colour tokens declared", missingTokens.length === 0,
  missingTokens.length ? "missing: " + missingTokens.join(", ") : REQUIRED_TOKENS.length + " tokens");

const EXACT = {
  "color-brand": "#F97316", "color-link": "#C2410C", "color-focus": "#C2410C",
  "color-control-border": "#6B7280", "color-on-brand": "#0D1117",
  "color-shell": "#1A1D23", "color-ink": "#0D1117", "color-surface": "#F7F8FA",
  "color-panel": "#FFFFFF", "color-border": "#E2E5EA",
  "status-review": "#B45309", "status-published": "#15803D",
  "color-danger": "#DC2626", "color-muted": "#6B7280",
};
const wrong = Object.entries(EXACT)
  .filter(([k, v]) => (token(k) || "").toUpperCase() !== v.toUpperCase())
  .map(([k, v]) => `${k}=${token(k)} (want ${v})`);
check("token hex values match the framework exactly", wrong.length === 0, wrong.join("; "));

/* hard-coded hex outside the token block */
const tokenBlockEnd = css.indexOf("}", css.indexOf(":root"));
const cssAfterTokens = css.slice(tokenBlockEnd);
const cssHex = (cssAfterTokens.match(/#[0-9a-fA-F]{6}\b/g) || []);
check("no hard-coded hex in stylesheet rules", cssHex.length === 0,
  cssHex.length ? cssHex.length + " found: " + [...new Set(cssHex)].slice(0, 6).join(", ") : "clean");

/* Two deliberate exemptions, both narrow:

   1. The <html> shell background is the one literal §22 mandates. It has to
      apply before any stylesheet loads — that is the entire reason the rule
      exists — so it cannot reference a token.
   2. A tenant's brand accent is customer data that a customer types into a
      form, not a design decision. Tokenising it would delete the feature. */
const SHELL_LITERAL = /<html[^>]*background-color:#1A1D23[^>]*>/gi;
const TENANT_ACCENT = /(?:accent|def)\s*:\s*"#[0-9a-fA-F]{6}"/g;
const scrub = src => src.replace(SHELL_LITERAL, "").replace(TENANT_ACCENT, "");

let pageHex = [];
pages.forEach(f => (scrub(read(f)).match(/#[0-9a-fA-F]{6}\b/g) || []).forEach(h => pageHex.push(f + ":" + h)));
jsFiles.forEach(f => (scrub(read("assets/js/" + f)).match(/#[0-9a-fA-F]{6}\b/g) || [])
  .forEach(h => pageHex.push(f + ":" + h)));
check("no hard-coded hex in pages or modules", pageHex.length === 0,
  pageHex.length ? pageHex.length + " found, e.g. " + pageHex.slice(0, 4).join(", ") : "clean");

/* ======================================================================
   §15 Contrast — the palette must pass before any page can
   ====================================================================== */
section("§15 Contrast (WCAG 2.2 AA)");
const panel = token("color-panel") || "#FFFFFF";
const TEXT_ON_PANEL = ["color-link", "color-ink", "color-ink-secondary", "color-muted",
  "color-success", "color-warning", "color-danger", "color-info"];
TEXT_ON_PANEL.forEach(t => {
  const hex = token(t);
  if (!hex) return check("contrast " + t, false, "token missing");
  const r = ratio(hex, panel);
  check(`contrast ${t} on panel \u2265 4.5:1`, r >= 4.5, r.toFixed(2) + ":1");
});
["color-control-border", "color-focus"].forEach(t => {
  const hex = token(t);
  if (!hex) return check("contrast " + t, false, "token missing");
  const r = ratio(hex, panel);
  check(`contrast ${t} on panel \u2265 3:1`, r >= 3, r.toFixed(2) + ":1");
});
/* status badge pairs must pass as normal text */
["draft", "review", "approved", "published", "superseded", "retired"].forEach(s => {
  const fg = token("status-" + s), bg = token("status-" + s + "-bg");
  if (!fg || !bg) return check("status pair " + s, false, "token missing");
  const r = ratio(fg, bg);
  check(`status badge "${s}" pair \u2265 4.5:1`, r >= 4.5, r.toFixed(2) + ":1");
});
/* §15: brand orange must NOT be used as normal-size text */
/* Anchored so it cannot match the tail of "background-color:" — brand orange
   as a FILL is correct and required; only as a text colour is it a failure. */
check("brand orange not used as text colour",
  !/(?:^|[;{\s])color:\s*var\(--color-brand\)/.test(cssAfterTokens),
  "use --color-link for text");

/* ======================================================================
   §7 Spacing · §8 Z-index
   ====================================================================== */
section("§7 Spacing / §8 Z-index");
const spaceTokens = (css.match(/--space-\d+\s*:/g) || []).length;
check("4px spacing scale declared", spaceTokens >= 9, spaceTokens + " --space-* tokens");
const zTokens = (css.match(/--z-[a-z]+\s*:/g) || []).length;
check("z-index scale declared", zTokens >= 9, zTokens + " --z-* tokens");

const zLiteralCss = (cssAfterTokens.match(/z-index:\s*\d+/g) || []).length;
let zLiteralPages = 0;
pages.forEach(f => zLiteralPages += (read(f).match(/z-index:\s*\d+/g) || []).length);
check("no hard-coded z-index integers", zLiteralCss + zLiteralPages === 0,
  `${zLiteralCss} in css, ${zLiteralPages} in pages`);

/* ======================================================================
   §17 Dark mode is forbidden in content areas
   ====================================================================== */
section("§17 Dark mode");
check("no prefers-color-scheme affecting content", !/prefers-color-scheme/.test(css), "");
check("no [data-theme] content theming", !/\[data-theme/.test(css), "");

/* ======================================================================
   §4 Typography · §23 Title pattern
   ====================================================================== */
section("§4 Typography / §23 Title");
check("Inter loaded", /family=Inter/.test(css), "");
check("IBM Plex Mono loaded", /IBM\+Plex\+Mono/.test(css), "");
check("font-display: swap", /display=swap/.test(css), "");
check("no font-weight 300", !/font-weight:\s*300/.test(css), "");

const badTitles = pages.filter(f => {
  const t = (read(f).match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  return !/ \| VeriDex$/.test(t) || !/ \u2014 /.test(t);
});
check("titles follow [Page] \u2014 [Module] | VeriDex", badTitles.length === 0,
  badTitles.length ? badTitles.length + " non-compliant, e.g. " + badTitles.slice(0, 3).join(", ") : pages.length + " pages");

const longTitles = pages.filter(f => {
  const t = (read(f).match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  return t.length > 60;
});
check("titles \u2264 60 characters", longTitles.length === 0,
  longTitles.length ? longTitles.join(", ") : "");

/* ======================================================================
   §22 Loading — shell background prevents white flash
   ====================================================================== */
section("§22 Loading");
const noShellBg = pages.filter(f => !/<html[^>]*background-color:\s*#1A1D23/i.test(read(f)));
check("<html> carries the shell background", noShellBg.length === 0,
  noShellBg.length ? noShellBg.length + " pages missing" : pages.length + " pages");

/* ======================================================================
   §5 Shell dimensions
   ====================================================================== */
section("§5 Shell");
const navW = (css.match(/--sidebar-w:\s*(\d+)px/) || [])[1];
const topH = (css.match(/--topbar-h:\s*(\d+)px/) || [])[1];
check("left nav is 240px", navW === "240", navW + "px");
check("topbar is 56px", topH === "56", topH + "px");

/* ======================================================================
   §31 Internationalisation
   ====================================================================== */
section("§31 Internationalisation");
const noLang = pages.filter(f => !/<html[^>]*\blang=/.test(read(f)));
check("every page declares lang", noLang.length === 0, noLang.join(", "));
const physical = (cssAfterTokens.match(/(?:^|[;{\s])(?:margin|padding|border)-(?:left|right)\s*:/g) || []).length;
check("CSS uses logical properties, not left/right", physical === 0,
  physical ? physical + " physical declarations remain" : "clean");

/* ======================================================================
   report
   ====================================================================== */
console.log("\nVeriDex Framework v3.0 \u2014 static compliance gate");
console.log("=".repeat(62));
results.forEach(r => {
  if (r.section) { console.log("\n" + r.section); return; }
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  \u2014 " + r.detail : ""}`);
});
console.log("\n" + "=".repeat(62));
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log("NOT COMPLIANT\n"); process.exit(1); }
console.log("COMPLIANT\n");
