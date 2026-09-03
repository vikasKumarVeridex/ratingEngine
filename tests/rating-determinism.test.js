/* ==========================================================================
   Rating determinism guard
   Run:  node tests/rating-determinism.test.js       (from platform/)

   data.js seeds its sample data from a fixed PRNG. That is fine for cosmetic
   volume data, but anything the rating engine reads must NOT come from it —
   otherwise the same risk quotes differently between page loads, and editing
   unrelated seed data silently shifts every premium. That is exactly what
   happened once: removing a block of generated records moved a Property
   quote from $31,906 to $18,246 without touching a single rate table.

   This test injects extra PRNG draws early in data.js — simulating any
   future data edit — and asserts no premium moves. It also asserts credits
   and debits stay on the right line of business, and that no factor value
   the engine reads is drawn at random.
   ========================================================================== */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const dataSrc = fs.readFileSync(path.join(ROOT, "assets/js/data.js"), "utf8");
const engineSrc = fs.readFileSync(path.join(ROOT, "assets/js/engine.js"), "utf8");

const CASES = {
  TRUCK: { cob: ["Auto Liability", "Physical Damage", "Cargo"], state: "TX",
    vehicles: [{ n: 1, primaryClass: "321", year: 2022, value: 145000, trailer: "Dry Van / Box — Single", trailerValue: 35000, miles: 65000 }],
    drivers: [{ n: 1, age: 42, cdlYears: 8, violations: 0, cls: "A — Clean" }],
    radiusClass: "48_states", ratingClass: "Dry Van or Box - Single Trailer", dashcam: "YES - Preferred Vendor",
    liabLimit: 1000000, liabDeductible: 5000, apdDeductible: 5000, naicsCode: "484230", cargoLimit: 100000,
    yearsInBusiness: 5, carrierSafetyRating: "Satisfactory", fmcsaAlerts: 0, oosVehiclesBand: "<=10%", oosDriversBand: "<=4%",
    lossFreqBand: ">24% and <=26%", iccFiling: "yes", policyType: "New Business", renewalEligible: "no", priorClaims: 0, priorIncurredLosses: 0, experienceMonths: 36 },
  GL: { state: "TX", revenue: 2500000, classCode: "238160", limit: 1000000, products: true, schedMod: 0, expMod: 1 },
  PROP: { state: "TX", construction: "JM", ppc: 4, occupancy: "RETAIL", windHail: "Z1", deductible: 5000,
    buildingValue: 1200000, bppValue: 250000, timeElement: true, irpm: 0 },
  MPL: { state: "TX", revenue: 250000, hazardGroup: 2, yip: "4th or More", limit: 200000, retention: 5000,
    alae: "Defense Within Limits", experienceFactor: 0.9, uwAdjust: 0 },
  CYBER: { state: "TX", revenue: 8000000, industry: "RETAIL", mfa: "PARTIAL", limit: 1000000, retention: 25000, schedMod: 0 },
  WC: { state: "TX", wcExposures: [{ n: 1, classCode: "5645", payroll: 620000 }, { n: 2, classCode: "8810", payroll: 95000 }],
    wcExpMod: 1.08, wcSchedMod: 0, oshaViolations: 1, wcFatality: false, wcSubcontractorsUninsured: false, wcPriorDeclined: false },
};

function boot(extraDraws) {
  const sb = {
    localStorage: { getItem: () => null, setItem: () => {} },
    console: { log() {}, warn() {}, error() {} },
    vxMoney: n => "$" + Math.round(n).toLocaleString("en-US"),
    vxNum: n => Number(n).toLocaleString("en-US"),
  };
  sb.window = sb;
  vm.createContext(sb);
  const src = extraDraws
    ? dataSrc.replace("const pick = a =>", `for(let _q=0;_q<${extraDraws};_q++) rnd();\n  const pick = a =>`)
    : dataSrc;
  vm.runInContext(src, sb, { filename: "data.js" });
  vm.runInContext(engineSrc, sb, { filename: "engine.js" });
  return sb;
}

function quoteAll(sb) {
  const out = {};
  for (const [lob, input] of Object.entries(CASES)) {
    sb.__input = input;
    out[lob] = vm.runInContext(`ENGINE.rate(${JSON.stringify(lob)}, __input).finalPremium`, sb);
  }
  return out;
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "\n          " + detail}`);
  if (!ok) failures++;
};

console.log("\nRating determinism guard\n" + "=".repeat(60));

/* 1. Premiums must not move when unrelated seed data shifts the PRNG. */
console.log("\n1. Premium stability under unrelated seed-data change");
const base = quoteAll(boot(0));
[37, 500].forEach(n => {
  const other = quoteAll(boot(n));
  Object.keys(base).forEach(lob => {
    check(`${lob} unchanged with +${n} extra PRNG draws`, base[lob] === other[lob],
      `expected ${base[lob]}, got ${other[lob]}`);
  });
});

/* 2. No value the engine reads may be randomly generated. */
console.log("\n2. Engine-read values are deterministic");
const sb = boot(0);
const V = sb.VX;
check("state surplus lines tax is from a fixed table", V.taxes.find(t => t.state === "TX").surplusTax === 4.85,
  `TX surplusTax = ${V.taxes.find(t => t.state === "TX").surplusTax}`);
check("industry class factors derive from hazard group",
  V.industryClasses.every(c => [0.75, 0.90, 1.00, 1.25, 1.55].includes(c.factor)),
  "some class factor is off the hazard-group curve");
check("county tax rates come from a fixed ladder",
  V.counties.every(c => [0, 0.25, 0.35, 0.45, 0.55, 0.65, 0.80, 0.95, 1.10, 1.35, 1.60, 1.85].includes(c.taxRate)));

/* 3. Credits and debits must belong to the line they are applied to. */
console.log("\n3. Credits / debits stay on the correct line of business");
const TRUCK_ONLY = ["FMCSA", "OOS", "CDL", "Dashcam"];
[["PROP", "Commercial Property"], ["CYBER", "Cyber"], ["GL", "General Liability"], ["WC", "Workers' Compensation"]].forEach(([code]) => {
  sb.__input = CASES[code];
  const r = vm.runInContext(`ENGINE.rate(${JSON.stringify(code)}, __input)`, sb);
  const names = [...r.discounts, ...r.surcharges].map(x => x.name).join(" ");
  check(`${code} gets no motor-carrier-only credit`, !TRUCK_ONLY.some(t => names.includes(t)), names);
});

/* 4. A credit is earned by meeting its condition, never by its position in a
   seed array.

   assemble() used to apply the first two matching discounts and the first
   matching surcharge with no eligibility test at all, so every Commercial
   Trucking quote — new business included — carried the Renewal Discount, and
   every Property quote carried the Tier 1 Coastal Wind surcharge whether or
   not the building was anywhere near the coast.

   These assertions were confirmed to FAIL against that code before being
   kept: without the eligibility gate, "New Business earns no renewal credit"
   is false. */
console.log("\n4. Credits are earned, not positional");
{
  const rate = (lob, over) => {
    sb.__input = { ...CASES[lob], ...over };
    return vm.runInContext(`ENGINE.rate(${JSON.stringify(lob)}, __input)`, sb);
  };
  const hasDisc = (r, n) => (r.discounts || []).some(d => d.name === n);
  const hasSur = (r, n) => (r.surcharges || []).some(d => d.name === n);

  // The reported bug, on a line where the credit runs through the generic pass.
  check("GL new business earns no renewal credit",
    !hasDisc(rate("GL", { policyType: "New Business", renewalEligible: "no" }), "Renewal Discount"));
  check("GL renewal that is NOT flagged eligible earns no renewal credit",
    !hasDisc(rate("GL", { policyType: "Renewal", renewalEligible: "no" }), "Renewal Discount"));
  check("GL eligible renewal DOES earn the renewal credit",
    hasDisc(rate("GL", { policyType: "Renewal", renewalEligible: "yes" }), "Renewal Discount"));

  // On trucking the same credit belongs to the account factor, and must not
  // also be charged by the generic pass — that would apply it twice.
  const tNew = rate("TRUCK", { policyType: "New Business", renewalEligible: "no" });
  const tRen = rate("TRUCK", { policyType: "Renewal", renewalEligible: "yes" });
  check("TRUCK never double-charges the renewal credit",
    !hasDisc(tNew, "Renewal Discount") && !hasDisc(tRen, "Renewal Discount"));
  const term = r => (r.accountFactorLines.find(l => l[0] === "Renewal Discount") || [])[1];
  check("TRUCK account factor carries no renewal term on new business", term(tNew) === 0, String(term(tNew)));
  check("TRUCK account factor carries the renewal term on an eligible renewal",
    term(tRen) === -0.05, String(term(tRen)));

  // An account off the band floor must actually see the credit in the premium.
  const midBand = { fmcsaAlerts: 2, oosVehiclesBand: ">10% and <=20%",
    oosDriversBand: ">4% and <=8%", lossFreqBand: ">30%" };
  const mNew = rate("TRUCK", { ...midBand, policyType: "New Business", renewalEligible: "no" });
  const mRen = rate("TRUCK", { ...midBand, policyType: "Renewal", renewalEligible: "yes" });
  check("an eligible renewal off the band floor pays less than new business",
    mRen.finalPremium < mNew.finalPremium,
    `new $${mNew.finalPremium} vs renewal $${mRen.finalPremium}`);

  // Inland property must not be charged the Tier 1 coastal load.
  check("inland property (Z1) earns no coastal wind surcharge",
    !hasSur(rate("PROP", { windHail: "Z1" }), "Coastal Wind Exposure"));

  // Nothing already priced inside a line's factor chain may be charged again.
  const inChain = ["Renewal Discount", "CDL Experience Discount", "Dashcam / Telematics",
    "FMCSA Alert Surcharge", "OOS Vehicle Violations", "OOS Driver Violations",
    "No Dashcam Surcharge", "High-Risk Driver", "New Venture Debit"];
  const applied = [...tNew.discounts, ...tNew.surcharges].map(x => x.name);
  check("TRUCK charges nothing that its factor chain already prices",
    !applied.some(n => inChain.includes(n)), applied.join(", "));

  // A credit that cannot be evaluated is reported, not silently dropped.
  check("undetermined credits are reported with a reason",
    (tNew.creditsSkipped || []).some(s => s.undetermined && s.reason),
    `${(tNew.creditsSkipped || []).length} skipped rows`);
}

/* 5. Workers' Compensation — added as the first genuinely new LOB this
   platform ships. Real WC pricing sums per-class-code manual premium across
   the whole exposure schedule, then applies exactly one experience mod and
   one schedule credit to the total; WC is also the one line on this platform
   written on ADMITTED paper (see D.lobs' licenceBasis note), not surplus
   lines like everywhere else, which is why it must carry zero surplus-lines
   tax and never the Surplus Lines Filing Fee — both asserted below rather
   than assumed, since a copy-pasted LOB block would silently inherit them. */
console.log("\n5. Workers' Compensation (new LOB)");
{
  sb.__wcInput = CASES.WC;
  const wc = vm.runInContext(`ENGINE.rate("WC", __wcInput)`, sb);
  check("WC rates to a real, non-zero premium", wc.finalPremium > 0, String(wc.finalPremium));
  check("WC charges zero surplus-lines tax (admitted line)", wc.tax === 0 && wc.taxPct === 0,
    `tax=${wc.tax} taxPct=${wc.taxPct}`);
  check("WC never charges the Surplus Lines Filing Fee",
    !wc.feeLines.some(f => f.code === "FEE_SLFILE"), wc.feeLines.map(f => f.code).join(","));
  check("WC exposure schedule prices every row, not just the first",
    wc.wcExposures.length === 2 && wc.wcExposures.every(x => x.premium > 0),
    JSON.stringify(wc.wcExposures.map(x => x.premium)));
  const expectedManual = wc.wcExposures.reduce((s, x) => s + x.premium, 0);
  check("WC coverage premium is manual premium × exp mod × schedule credit, not just row 1",
    wc.coveragePremium === Math.round(expectedManual * 1.08 * 1),
    `coveragePremium=${wc.coveragePremium} vs Σrows×mod=${Math.round(expectedManual * 1.08)}`);
}

/* 6. Saved formulas are scoped to the tenant that authored them.
   Onboarding a second tenant (Ironclad Specialty Insurance) with its own
   Active Workers' Compensation formula surfaced a real gap: applySavedFormula
   matched on (lob, cob) alone, so that formula would have silently rated
   every OTHER tenant's Workers' Compensation quotes too — including
   VeriDex's own — the moment it went Active. */
console.log("\n6. Saved formulas do not leak across tenants");
{
  sb.__wcInput2 = CASES.WC;
  vm.runInContext("VX.activeTenantId = 1", sb);
  const veridex = vm.runInContext(`ENGINE.rate("WC", __wcInput2)`, sb);
  check("VeriDex's own WC quote does not pick up another tenant's formula",
    veridex.groups[0].ratedBy.mode === "default", JSON.stringify(veridex.groups[0].ratedBy));

  vm.runInContext("VX.activeTenantId = 2", sb);
  const ironclad = vm.runInContext(`ENGINE.rate("WC", __wcInput2)`, sb);
  check("Ironclad's own WC quote DOES pick up its own Active formula",
    ironclad.groups[0].ratedBy.mode === "formula" && /Ironclad/.test(ironclad.groups[0].ratedBy.name || ""),
    JSON.stringify(ironclad.groups[0].ratedBy));

  check("the seeded formula reproduces the default expression exactly (activating it changes nothing)",
    veridex.finalPremium === ironclad.finalPremium, `${veridex.finalPremium} vs ${ironclad.finalPremium}`);

  vm.runInContext("VX.activeTenantId = 1", sb); // leave state as later sections expect it
}

/* 7. Trucking's account-level factor is real, and it is TWO factors, not one.
   Verified against ams-service's real stored procedure
   (public.udf_get_factor_for_iso_new_rater): Auto Liability and Physical
   Damage each compute their own account-level factor
   (_liab_acc_level_factor / _pd_acc_level_factor) from mostly-shared but not
   identical term sets — Liability alone carries Broadened Pollution and
   Defense Cost Addback; both carry the new Driver Criteria term this
   platform previously modelled as an invented per-vehicle age/CDL proxy
   instead of the real flat account-level answer it actually is. */
console.log("\n7. Trucking account factor: Liability and PD are separate");
{
  const rate = over => {
    sb.__truckInput = Object.assign({}, CASES.TRUCK, over);
    return vm.runInContext(`ENGINE.rate("TRUCK", __truckInput)`, sb);
  };
  const base = rate({});
  const withCrit = rate({ driverCriteria1Year: "yes" });
  const withPoll = rate({ broadenedPollution: "yes" });
  const withDef = rate({ defenseAddback: "yes" });

  check("Liability and PD account factors are exposed as distinct fields",
    typeof base.accountFactor === "number" && typeof base.pdAccountFactor === "number");
  check("Driver Criteria moves BOTH Liability's and PD's account factor",
    withCrit.accountFactor > base.accountFactor && withCrit.pdAccountFactor > base.pdAccountFactor,
    `liab ${base.accountFactor}->${withCrit.accountFactor}, pd ${base.pdAccountFactor}->${withCrit.pdAccountFactor}`);
  check("Broadened Pollution moves Liability's account factor only",
    withPoll.accountFactor > base.accountFactor && withPoll.pdAccountFactor === base.pdAccountFactor,
    `liab ${base.accountFactor}->${withPoll.accountFactor}, pd ${base.pdAccountFactor}->${withPoll.pdAccountFactor}`);
  check("Defense Cost Addback moves Liability's account factor only",
    withDef.accountFactor > base.accountFactor && withDef.pdAccountFactor === base.pdAccountFactor,
    `liab ${base.accountFactor}->${withDef.accountFactor}, pd ${base.pdAccountFactor}->${withDef.pdAccountFactor}`);
}

/* 7b. Two CANDIDATE rating models (Model A: per-vehicle classification/
   manual rating; Model B: exposure-based mileage/usage rating) are computed
   alongside the real formula above, purely for a side-by-side actuarial
   comparison — neither is a filed rate, both disclosed as candidate/
   experimental throughout the platform (r.modelA / r.modelB on every
   Trucking rating result). Checks: both rate for real off the same inputs,
   their outputs diverge significantly (the explicit goal of building two
   structurally different models), and each model's own distinguishing
   factor actually moves its own premium. */
console.log("\n7b. Trucking: two candidate models (Model A / Model B), alongside the real formula");
{
  const rate = over => {
    sb.__truckInput2 = Object.assign({}, CASES.TRUCK, over);
    return vm.runInContext(`ENGINE.rate("TRUCK", __truckInput2)`, sb);
  };
  const base = rate({});

  check("both candidate models return a real, positive premium",
    base.modelA.finalPremium > 0 && base.modelB.finalPremium > 0,
    `A=${base.modelA.finalPremium} B=${base.modelB.finalPremium}`);
  check("the two models' premiums diverge significantly (>15%), by design",
    Math.abs(base.modelDiffPct) > 15,
    `diff = ${base.modelDiffPct.toFixed(1)}%`);
  check("the models are structurally different — different group names, not just re-scaled versions of the same chain",
    base.modelA.groups[0].name !== base.modelB.groups[0].name,
    `A: "${base.modelA.groups[0].name}" vs B: "${base.modelB.groups[0].name}"`);
  check("Model A's factor chain has no mileage/exposure concept, Model B's has no vehicle-class concept",
    !base.modelA.groups[0].factors.some(f => /Mileage|Exposure Charge|Territory Relativity/.test(f.label))
      && !base.modelB.groups[0].factors.some(f => /Vehicle Class|Fleet Size Discount|Driver Experience/.test(f.label)),
    `A labels: ${base.modelA.groups[0].factors.map(f => f.label).join(", ")} | B labels: ${base.modelB.groups[0].factors.map(f => f.label).join(", ")}`);

  // Each model's own distinguishing factor must actually move its own premium.
  const heavierClass = rate({ vehicles: [{ n: 1, primaryClass: "351", year: 2022, value: 145000, miles: 65000 }] });
  check("Model A: a heavier vehicle class raises Model A's premium",
    heavierClass.modelA.finalPremium > base.modelA.finalPremium,
    `${base.modelA.finalPremium} -> ${heavierClass.modelA.finalPremium}`);

  const moreMiles = rate({ vehicles: [{ n: 1, primaryClass: "321", year: 2022, value: 145000, miles: 150000 }] });
  check("Model B: more annual miles raises Model B's premium",
    moreMiles.modelB.finalPremium > base.modelB.finalPremium,
    `${base.modelB.finalPremium} -> ${moreMiles.modelB.finalPremium}`);
  check("Model A is not moved by a mileage-only change (structural independence)",
    moreMiles.modelA.finalPremium === base.modelA.finalPremium,
    `${base.modelA.finalPremium} vs ${moreMiles.modelA.finalPremium}`);
}

/* 8. Same input twice in one session must give the same answer. */
console.log("\n8. Repeat rating is stable within a session");
Object.keys(CASES).forEach(lob => {
  sb.__input = CASES[lob];
  const a = vm.runInContext(`ENGINE.rate(${JSON.stringify(lob)}, __input).finalPremium`, sb);
  const b = vm.runInContext(`ENGINE.rate(${JSON.stringify(lob)}, __input).finalPremium`, sb);
  check(`${lob} rates identically twice`, a === b, `${a} then ${b}`);
});

console.log("\n" + "=".repeat(60));
console.log(failures ? `${failures} FAILURE(S)` : "All checks passed.");
console.log("Reference premiums: " + Object.entries(base).map(([k, v]) => `${k} $${v.toLocaleString("en-US")}`).join("  ") + "\n");
process.exit(failures ? 1 : 0);
