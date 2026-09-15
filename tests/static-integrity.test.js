/* Syntax and local-link checks across the static site. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let scripts = 0, links = 0;
for (const file of fs.readdirSync(path.join(root, 'assets/js')).filter(f => f.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), { filename: file }); scripts++;
}
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=|application\/json|application\/ld\+json/.test(match[1])) continue;
    new vm.Script(match[2], { filename: file }); scripts++;
  }
  for (const match of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:[a-z]+:|\/\/)/i.test(target) || /[${}]/.test(target)) continue;
    // Only file-shaped literals: UI templates also contain fragments and JS expressions.
    if (!/\.(html|js|css|md|json|svg|png)$/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(root, target)), `${file}: missing ${target}`); links++;
  }
}
console.log(`${scripts} scripts compile; ${links} local references resolve.`);
