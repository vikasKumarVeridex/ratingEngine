/* Integration tests for existing pages, real grid/modal scripts and new UI layer.
   Install test-only dependencies outside the app; see docs/ui-ux-cleanup.md. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const packageRoot = name => {
  let dir = path.dirname(require.resolve(name));
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (path.basename(dir) === name && fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === name) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Cannot locate ' + name);
};
class LocalScripts extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    if (u.hostname === 'prototype.test' && u.pathname.endsWith('.js'))
      return Promise.resolve(fs.readFileSync(path.join(root, u.pathname)));
    if (u.pathname.endsWith('ag-grid-community.min.js'))
      return Promise.resolve(fs.readFileSync(path.join(packageRoot('ag-grid-community'), 'dist/ag-grid-community.min.js')));
    if (u.pathname.endsWith('bootstrap.bundle.min.js'))
      return Promise.resolve(fs.readFileSync(path.join(packageRoot('bootstrap'), 'dist/js/bootstrap.bundle.min.js')));
    return null; // No network, fonts, charts or rendering assertions.
  }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function load(file) {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (e.type === 'unhandled exception') errors.push(e.message); });
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    url: 'http://prototype.test/' + file, runScripts: 'dangerously', resources: new LocalScripts(),
    pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }); }
  });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  await wait(600);
  assert.deepEqual(errors, [], file + ' startup');
  return { dom, w: dom.window, d: dom.window.document, errors };
}
(async () => {
  for (const file of ['fees.html', 'products.html', 'factors.html', 'formula-builder.html']) {
    const { dom, w, d, errors } = await load(file);
    try {
      assert.ok(w.vxUX, file + ': shared UI loaded');
      assert.ok(d.querySelector('.vx-page-head h1 .vx-help-button'), file + ': page help');
      assert.ok(d.querySelector('.ag-root'), file + ': grid initialized');
      assert.ok(d.querySelector('.vx-more-tools'), file + ': secondary toolbar');
      const rows = d.querySelectorAll('.ag-center-cols-container .ag-row');
      assert.ok(rows.length > 0, file + ': records loaded');
      const headers = [...d.querySelectorAll('.ag-center-cols-container .ag-row:first-child .ag-cell')];
      assert.ok(headers.length <= 6, file + ': reduced initial columns');
      const more = d.querySelector('[data-a="more"]');
      if (more) {
        more.click(); await wait(40); assert.deepEqual(errors, [], file + ': row click'); assert.ok(d.querySelector('[role="menu"]'), file + ': row menu opens');
        const menu = d.querySelector('[role="menu"]');
        menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(d.querySelector('[role="menu"]'), null);
      }
      const edit = d.querySelector('[data-a="edit"]');
      if (edit) {
        edit.click(); await wait(80);
        assert.ok(d.querySelector('#vxModal'), file + ': original edit handler works');
        assert.ok(d.querySelector('#vxModal input,#vxModal select'), file + ': fields remain editable');
      }
      assert.deepEqual(errors, [], file + ' interaction');
      console.log('PASS ' + file + ': loads, focused columns, row menu, edit controls');
    } finally { w.vxUX.dispose(); dom.window.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
