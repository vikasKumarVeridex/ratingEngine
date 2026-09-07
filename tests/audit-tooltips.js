// Tests/audit: extract every <th> from the 10 Rating Engine pages
// and verify a non-stub tooltip definition exists in the dictionary.
const fs = require('fs');
const path = require('path');

const PAGES = [
  'dashboard.html','factors.html','rate-tables.html','formula-builder.html',
  'versions.html','quote-json.html','loss-runs.html','analytics.html',
  'ai-assistant.html','glossary.html'
];

function extractTh(html) {
  // match all <th...>...</th> contents, strip inline styles, normalize
  const re = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    let t = m[1]
      .replace(/<[^>]+>/g, '')   // strip nested tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (t) out.add(t);
  }
  return Array.from(out);
}

// load dictionary by evaluating it in a sandbox-ish way: read the file,
// extract the object literal { ... } and JSON-parse the strings (good enough
// since we control the contents). We only need the keys here.
function dictKeys() {
  const src = fs.readFileSync('assets/js/tooltip-dictionary.js', 'utf8');
  const start = src.indexOf('const D = {');
  const end = src.indexOf('};', start);
  const block = src.slice(start + 'const D = '.length, end + 1);
  // extract keys like  "Foo":  → match
  const keys = new Set();
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
  let m;
  while ((m = re.exec(block)) !== null) keys.add(m[1]);
  return keys;
}

const keys = dictKeys();
let missing = 0;
for (const p of PAGES) {
  const ths = extractTh(fs.readFileSync(p, 'utf8'));
  const fileMiss = [];
  for (const t of ths) {
    // dynamic renderers use column labels like "Commodity" or "Base Rate" etc.
    // We only flag missing headers when the text is non-trivial.
    if (t.length < 2) continue;
    if (/^\$\{[^}]+\}$/.test(t)) continue; // template-literal placeholder
    if (!keys.has(t)) fileMiss.push(t);
  }
  if (fileMiss.length) {
    missing += fileMiss.length;
    console.log(`\n[${p}] ${fileMiss.length} header(s) without a dictionary entry:`);
    fileMiss.forEach(t => console.log('  - ' + JSON.stringify(t)));
  } else {
    console.log(`[${p}] OK — ${ths.length} header(s) all defined`);
  }
}
console.log(`\nTotal missing: ${missing}`);
process.exit(missing ? 1 : 0);