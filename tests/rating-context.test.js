/* Run: node tests/rating-context.test.js. No browser or dependencies needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function boot(eligibility = true) {
  const sb = { localStorage: { getItem: () => null, setItem() {} }, console,
    vxMoney: n => '$' + Math.round(n), vxNum: String };
  sb.window = sb;
  vm.createContext(sb);
  for (const name of ['data', 'engine', ...(eligibility ? ['eligibility'] : [])])
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/' + name + '.js'), 'utf8'), sb);
  sb.rate = vm.runInContext('ENGINE.rate', sb);
  return sb;
}
const input = { state: 'TX', revenue: 2500000, classCode: '238160', limit: 1000000,
  products: false, schedMod: 0, expMod: 1, effectiveDate: '2026-09-01' };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function setup() {
  const sb = boot();
  sb.VX.activeTenantId = 1;
  sb.VX.products = [{ name: 'Program A', tenantId: 1 }, { name: 'Program B', tenantId: 1 }];
  sb.VX.versions = [
    { product: 'Program A', tenantId: 1, lob: 'General Liability', version: 'old', status: 'Expired', effectiveStart: '2025-01-01', effectiveEnd: '2025-12-31' },
    { product: 'Program A', tenantId: 1, lob: 'General Liability', version: 'new', status: 'Published', effectiveStart: '2026-01-01' },
    { product: 'Program B', tenantId: 1, lob: 'General Liability', version: 'new', status: 'Published', effectiveStart: '2026-01-01' },
  ];
  const formula = (id, product, version, value) => ({ id, name: 'Formula ' + id, tenantId: 1,
    lob: 'General Liability', cob: 'General Liability', status: 'Active',
    attachments: [{ product, ratingVersion: version }], tokens: [{ t: 'num', v: String(value) }] });
  sb.VX.savedFormulas = [formula(1, 'Program B', 'new', 9000), formula(2, 'Program A', 'old', 3000), formula(3, 'Program A', 'new', 6000)];
  sb.VX.eligibilityRules = [];
  return sb;
}
test('Product and version choose the executed formula; array order cannot choose it', () => {
  const sb = setup();
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 6000);
  assert.equal(sb.rate('GL', { ...input, product: 'Program B' }).coveragePremium, 9000);
  sb.VX.savedFormulas.reverse();
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 6000);
});
test('Endorsement uses inception version; renewal uses current date', () => {
  const sb = setup();
  assert.equal(sb.rate('GL', { ...input, product: 'Program A', policyType: 'Endorsement', originalEffectiveDate: '2025-05-01' }).coveragePremium, 3000);
  assert.equal(sb.rate('GL', { ...input, product: 'Program A', policyType: 'Renewal' }).coveragePremium, 6000);
});
test('Explicit request tenant scopes formulas, fees, product paper and version pins together', () => {
  const sb = setup();
  sb.VX.products.unshift({ name: 'Program A', tenantId: 2, licenceBasis: 'Admitted', versionByTransaction: { new: 'foreign' } });
  sb.VX.versions.unshift({ product: 'Program A', tenantId: 2, lob: 'General Liability', version: 'foreign', status: 'Published', effectiveStart: '2026-01-01' });
  sb.VX.savedFormulas.unshift({ ...sb.VX.savedFormulas[2], id: 22, tenantId: 2, attachments: [{ product: 'Program A', ratingVersion: 'foreign' }], tokens: [{ t: 'num', v: '12000' }] });
  sb.VX.fees = [{ tenantId: 2, active: true, lob: 'All', code: 'TEST', name: 'Other fee', valueType: 'Fixed', chargeType: 'Per Policy', value: 700 }];
  const one = sb.rate('GL', { ...input, product: 'Program A', policyType: 'New Business' });
  const two = sb.rate('GL', { ...input, product: 'Program A', policyType: 'New Business', tenantId: 2 });
  assert.equal(one.coveragePremium, 6000); assert.equal(one.feeLines.length, 0);
  assert.equal(two.coveragePremium, 12000); assert.equal(two.feeLines.length, 1);
  assert.equal(two.ratingVersion.version, 'foreign'); assert.equal(two.admitted, true);
  assert.equal(sb.VX.activeTenantId, 1);
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 6000);
});
test('Duplicate active matches fall back with visible failure and referral', () => {
  const sb = setup(); sb.VX.savedFormulas.push({ ...sb.VX.savedFormulas[2], id: 44 });
  const r = sb.rate('GL', { ...input, product: 'Program A' });
  assert.equal(r.usedSavedFormula, false); assert.equal(r.formulaFailures.length, 1);
  assert.match(r.formulaFailures[0].error, /Multiple active/);
  assert.equal(r.underwriting.decision, 'refer');
});
test('State and effective date restrictions prevent out-of-scope formulas', () => {
  const sb = setup(); const f = sb.VX.savedFormulas[2];
  f.states = ['CA'];
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).usedSavedFormula, false);
  f.states = ['TX']; f.effectiveStart = '2026-09-02';
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).usedSavedFormula, false);
  f.effectiveStart = '2026-09-01'; f.effectiveEnd = '2026-09-01';
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 6000);
});
test('Malformed formula reports fallback instead of throwing in error reporting', () => {
  const sb = setup(); sb.VX.savedFormulas[2].tokens = null;
  const r = sb.rate('GL', { ...input, product: 'Program A' });
  assert.equal(r.formulaFailures.length, 1); assert.ok(Number.isFinite(r.finalPremium));
});
test('Eligibility is returned by engine and scoped to request tenant', () => {
  const sb = setup();
  sb.VX.eligibilityRules = [{ tenantId: 2, active: true, lob: 'All', code: 'EL_WCFATAL', name: 'Fatality' }];
  assert.equal(sb.rate('GL', { ...input, wcFatality: true }).underwriting.decision, 'refer'); // ambiguous formulas in no-product sandbox
  const r = sb.rate('GL', { ...input, product: 'Program A', tenantId: 2, wcFatality: true });
  assert.equal(r.underwriting.decision, 'decline'); assert.equal(r.eligibility.declines.length, 1);
  assert.equal(r.underwriting.premiumIsIndicative, true);
});
test('Unknown eligibility rules require review; missing module never auto-approves', () => {
  const sb = setup(); sb.VX.eligibilityRules = [{ active: true, lob: 'All', code: 'UNKNOWN' }];
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).underwriting.decision, 'refer');
  const bare = boot(false).rate('GL', input);
  assert.equal(bare.underwriting.decision, 'not_evaluated');
  assert.equal(bare.ratingBasis.immutableSnapshot, false);
});
test('Failed request restores tenant context for next quote', () => {
  const sb = setup();
  const bad = { ...input, tenantId: 2, get product() { throw new Error('bad product'); } };
  assert.throws(() => sb.rate('GL', bad), /bad product/);
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 6000);
});
test('Formula evaluation accepts arithmetic and rejects executable text', () => {
  const sb = setup(); const evaluate = vm.runInContext('ENGINE.evalFormula', sb);
  assert.equal(evaluate([{ t: 'op', v: 'MAX' }, { t: 'op', v: '(' }, { t: 'num', v: '2' }, { t: 'op', v: ',' }, { t: 'num', v: '3' }, { t: 'op', v: ')' }], {}), 3);
  assert.equal(evaluate([{ t: 'fn', v: 'MAX' }, { t: 'op', v: '(' }, { t: 'num', v: '2' }, { t: 'op', v: ',' }, { t: 'num', v: '3' }, { t: 'op', v: ')' }], {}), 3);
  assert.throws(() => evaluate([{ t: 'num', v: '(globalThis.__injected = 1)' }], {}), /Unsupported/);
  assert.equal(sb.__injected, undefined);
  assert.throws(() => evaluate([{ t: 'var', v: 'constructor' }], {}), /non-numeric/);
  assert.throws(() => evaluate([{ t: 'var', v: 'x' }], { x: '1;globalThis.__injected=1' }), /non-numeric/);
});
test('Custom factors cannot cross tenant boundaries', () => {
  const sb = setup();
  // Use an explicit custom variable to isolate the test from built-in RemainingFactors.
  sb.VX.savedFormulas[2].tokens = [{ t: 'var', v: 'CUSTOM_TEST' }];
  sb.VX.ratingFactors = [{ custom: true, approvedForFormulas: true, tenantId: 2,
    lob: 'General Liability', coverage: 'General Liability', code: 'CUSTOM_TEST', defaultValue: 99000 }];
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).formulaFailures.length, 1);
  sb.VX.ratingFactors[0].tenantId = 1;
  assert.equal(sb.rate('GL', { ...input, product: 'Program A' }).coveragePremium, 99000);
});
console.log(`${passed} context checks passed.`);
