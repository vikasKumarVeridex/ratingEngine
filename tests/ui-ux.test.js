/* DOM unit tests. Run with jsdom available via NODE_PATH (no browser required). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../assets/js/ui-ux.js'), 'utf8');
const fixture = `<!doctype html><body>
<div class="vx-page-head"><h1>Fees</h1><p>Manage fees <span class="hintdot" title="Long page explanation">More</span></p></div>
<div class="vx-card"><h2>Recent Activity</h2><div class="sub" id="activityHelp">Latest configuration changes</div><button id="actualAction">Open audit</button></div>
<div class="col-md-6" data-fw="amount"><label>Amount</label><input id="amount"><div data-field-help id="amountHelp">Enter whole dollars.</div></div>
<div class="col-md-6"><label>Minimum Fee (0 = no minimum)</label><input id="minimum"></div>
<div class="vx-card"><h2>Results</h2><div class="sub" id="important">No matching data found</div></div>
<div class="vx-exp2" style="border-color:var(--warn)"><div class="hd"><i class="fa-triangle-exclamation"></i><b>Not wired</b><button class="tog">Why?</button></div><div class="bd">This does not affect rating.</div></div>
<div class="vx-exp2"><div class="hd"><b>How fees apply</b><span>Fixed or percent.</span><button class="tog">Why?</button></div><div class="bd"><p>Calculation help.</p><a href="fees.html">Fee details</a></div></div>
<div class="vx-tools"><div class="r"><button id="ag1cols">Columns</button><button id="ag1add">Add Fee</button><button id="ag1imp">Import</button><button id="ag1exp">Export</button></div></div>
<table class="vx-t"><thead><tr><th>Fee</th><th>Value</th></tr></thead></table>
<button id="menuTrigger">More row actions</button>
<div id="deferred" data-ux-section="Mapping" style="display:none">Mapping results</div>
</body>`;
const dom = new JSDOM(fixture, { url: 'http://localhost/dashboard.html', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
w.VX_TIPS = { Fee: { d: 'A charge applied to the policy.' } };
let imports = 0;
d.getElementById('ag1imp').onclick = () => imports++;
w.eval(script);
const help = label => [...d.querySelectorAll('.vx-help-button')].find(b => b.getAttribute('aria-label') === 'Help: ' + label);
const popup = () => d.getElementById('vxContextHelp');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('Field help sits beside its own accessible label', () => {
  assert.equal(d.querySelector('[data-fw] label').htmlFor, 'amount');
  assert.equal(help('Amount').previousElementSibling.tagName, 'LABEL');
  assert.equal(d.getElementById('amountHelp').hidden, true);
  help('Amount').focus();
  assert.equal(popup().hidden, false); assert.match(popup().textContent, /whole dollars/);
  assert.equal(popup().getAttribute('role'), 'tooltip');
});
test('Escape dismisses help and keeps focus without reopening', () => {
  help('Amount').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(popup().hidden, true); assert.equal(d.activeElement, help('Amount'));
});
test('Touch/click help toggles, and outside click closes', () => {
  help('Amount').click(); assert.equal(popup().hidden, false);
  help('Amount').click(); assert.equal(popup().hidden, true);
  help('Amount').click(); d.getElementById('actualAction').click(); assert.equal(popup().hidden, true);
});
test('Long help links remain usable in a labelled popover', () => {
  help('How fees apply').click();
  assert.equal(popup().getAttribute('role'), 'dialog');
  const link = popup().querySelector('a'); assert.equal(link.getAttribute('href'), 'fees.html');
  link.focus(); link.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(popup().hidden, true); assert.equal(d.activeElement, help('How fees apply'));
});
test('Warnings, empty states and primary actions remain visible', () => {
  assert.equal(d.getElementById('important').hidden, false);
  assert.equal(d.querySelector('.fa-triangle-exclamation').closest('.vx-exp2').hidden, false);
  assert.equal(d.getElementById('ag1add').closest('details'), null);
});
test('Secondary sections collapse without losing their original controls', () => {
  const details = d.getElementById('actualAction').closest('details');
  assert.ok(details); assert.equal(details.open, false); details.open = true;
  assert.ok(details.querySelector('#actualAction'));
  assert.equal(d.getElementById('deferred').closest('details'), null);
});
test('Table utilities retain original IDs and handlers', () => {
  assert.ok(d.getElementById('ag1imp').closest('.vx-more-tools'));
  d.getElementById('ag1imp').click(); assert.equal(imports, 1);
});
test('Header help is a real button, without invalid table siblings', () => {
  assert.ok(help('Fee')); assert.equal(d.querySelector('thead tr').children.length, 2);
});
test('Enhancement is idempotent and handles newly rendered fields', () => {
  const count = d.querySelectorAll('.vx-help-button').length;
  w.vxUX.enhance(); w.vxUX.enhance(); assert.equal(d.querySelectorAll('.vx-help-button').length, count);
  const field = d.createElement('div'); field.dataset.fw = 'late';
  field.innerHTML = '<label>Late field</label><input><div data-field-help>Added after a modal render</div>';
  d.body.appendChild(field); w.vxUX.enhance();
  assert.ok(help('Late field')); assert.ok(field.querySelector('label').htmlFor);
});
test('Row menu supports keyboard navigation and original action callback', () => {
  let ran = '';
  const trigger = d.getElementById('menuTrigger');
  w.vxUX.showActions(trigger, [{ label: 'History', run: () => ran = 'history' }, { label: 'Delete', danger: true, run: () => ran = 'delete' }]);
  const buttons = [...d.querySelectorAll('.vx-action-menu button')];
  assert.equal(d.activeElement, buttons[0]);
  buttons[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(d.activeElement, buttons[1]); buttons[1].click();
  assert.equal(ran, 'delete'); assert.equal(d.querySelector('.vx-action-menu'), null);
  assert.equal(d.activeElement, trigger);
});
test('All pages load one shared style, help module and dictionary', () => {
  const root = path.resolve(__dirname, '..');
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const asset of ['assets/css/workspace.css', 'assets/js/ui-ux.js', 'assets/js/tooltip-dictionary.js'])
      assert.equal(html.split(asset).length - 1, 1, file + ': ' + asset);
    assert.equal(html.includes('src="assets/js/column-tooltips.js"'), false);
  }
});
console.log(`${passed} UI behavior checks passed.`);
setTimeout(() => { w.vxUX.dispose(); dom.window.close(); }, 100);
