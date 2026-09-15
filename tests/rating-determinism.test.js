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

/* 7b. Commercial Trucking rates on the real, filed formula and nothing else.
   Two candidate models (a classification model and an exposure/mileage one)
   were built alongside it during a comparison exercise and both have since
   been removed at the user's request. These checks assert they are actually
   gone — engine functions, data tables, factor rows and result fields — so a
   stale reference cannot quietly reintroduce an unfiled rate. */
console.log("\n7b. Trucking: only the real filed formula remains");
{
  sb.__truckInput2 = Object.assign({}, CASES.TRUCK);
  const base = vm.runInContext(`ENGINE.rate("TRUCK", __truckInput2)`, sb);

  check("the quote carries no candidate-model result",
    base.modelA === undefined && base.modelB === undefined
      && base.modelDiffPct === undefined && base.modelDiffPctA === undefined
      && base.modelDiffPctB === undefined);
  check("no candidate rate tables remain",
    vm.runInContext(`["modelAVehicleClass","modelARadius","modelADriverExperience","modelASafetyRating",
      "modelAFleetDiscount","modelAConstants","modelBTerritory","modelBRiskScore","modelBConstants"]
      .every(k => typeof VX[k] === "undefined")`, sb));
  check("no candidate rows remain in the rating-factor registry",
    vm.runInContext(`VX.ratingFactors.filter(f => /^M[AB]_/.test(f.code)).length`, sb) === 0);
  check("no rate-table registry entry is tagged to a candidate model",
    vm.runInContext(`typeof RATE_TABLES === "undefined" ? true
      : RATE_TABLES.filter(t => /Model [AB]/.test(t.cov || "") || /Model [AB]/.test(t.name || "")).length === 0`, sb));
  check("every factor group on the result belongs to the filed formula",
    (base.groups || []).every(g => !/^Model [AB]/.test(g.name)),
    (base.groups || []).map(g => g.name).join(", "));
  /* Was 9,347 until the trailer/power-unit corrections: the sample fleet
     carries a $35,000 trailer that TIV counted as covered but the premium
     never rated, while TrailerPhysDamFactor discounted the power unit for
     having it. Rating what is actually covered raised this deliberately.
     Was 10,717 until the stamping fee fix (engine.js assemble()): TX's own
     real, already-seeded 0.15% stamping fee (VX.taxes) was never actually
     charged on surplus-lines business — this sample tenant's default paper
     — so every non-admitted TX quote was quietly short by its amount. */
  check("the real formula rates to its baseline",
    base.finalPremium === 10730, `got ${base.finalPremium}`);
}

/* 7ba. A trailer is a rated unit but not a POWER unit, and an attached
   trailer's value is covered so it has to be rated. Both were wrong: a
   trailer created a phantom "unassigned driver" slot at 1.85x that inflated
   every vehicle's premium, and an attached trailer made physical damage
   CHEAPER than no trailer at all. */
console.log("\n7ba. Trailers: rated, but not counted as power units");
{
  const rate = veh => {
    sb.__trInput = Object.assign({}, CASES.TRUCK, { cob: ["Auto Liability", "Physical Damage"], vehicles: veh });
    return vm.runInContext(`ENGINE.rate("TRUCK", __trInput)`, sb);
  };
  const tractor = withTrailer => ({ n: 1, desc: "Tractor", primaryClass: "321", year: 2022, value: 145000, miles: 65000,
    trailer: withTrailer ? "Dry Van / Box — Single" : "None — Power Unit Only", trailerValue: withTrailer ? 35000 : 0 });
  const trailerRow = { n: 2, desc: "Trailer", primaryClass: "672", year: 2021, value: 35000, miles: 65000,
    trailer: "None — Power Unit Only", trailerValue: 0 };
  const powerUnitsOf = r => r.groups[0].factors.find(f => f.label === "Rated Power Units").value;

  const alone = rate([tractor(false)]);
  const attached = rate([tractor(true)]);
  const ownRow = rate([tractor(false), trailerRow]);

  check("attaching a trailer no longer makes the policy cheaper",
    attached.coveragePremium > alone.coveragePremium,
    `${alone.coveragePremium} -> ${attached.coveragePremium}`);
  check("an attached trailer's value is rated, not just insured",
    attached.perVehicle[0].tiv === 180000 && attached.perVehicle[0].apd > alone.perVehicle[0].apd,
    `tiv=${attached.perVehicle[0].tiv} apd ${alone.perVehicle[0].apd} -> ${attached.perVehicle[0].apd}`);

  check("a trailer scheduled as its own row is a rated unit",
    ownRow.units === 2, `units=${ownRow.units}`);
  check("but it is NOT counted as a power unit",
    powerUnitsOf(ownRow) === 1, `power units=${powerUnitsOf(ownRow)}`);
  check("so it creates no phantom unassigned-driver slot",
    ownRow.driverClassFctr === alone.driverClassFctr,
    `${alone.driverClassFctr} -> ${ownRow.driverClassFctr}`);
  check("and it does not move the tractor's own liability premium",
    ownRow.perVehicle[0].liab === alone.perVehicle[0].liab,
    `${alone.perVehicle[0].liab} -> ${ownRow.perVehicle[0].liab}`);
  check("and it does not push the tractor into a bigger fleet-size band",
    ownRow.perVehicle[0].fleetFactor === alone.perVehicle[0].fleetFactor,
    `${alone.perVehicle[0].fleetFactor} -> ${ownRow.perVehicle[0].fleetFactor}`);
  check("the trailer itself still earns its own premium",
    ownRow.perVehicle[1].liab > 0 && ownRow.perVehicle[1].apd > 0,
    `liab=${ownRow.perVehicle[1].liab} apd=${ownRow.perVehicle[1].apd}`);

  /* Two power units DO legitimately create a driver shortage with one driver. */
  const twoTractors = rate([tractor(false), { ...tractor(false), n: 2, desc: "Tractor 2" }]);
  check("two POWER units with one driver still raise the driver factor, as they should",
    twoTractors.driverClassFctr > alone.driverClassFctr,
    `${alone.driverClassFctr} -> ${twoTractors.driverClassFctr}`);
  check("a trailer-only schedule cannot divide by zero power units",
    rate([trailerRow]).finalPremium > 0);
}

/* 7bb. Every formula application is recorded, so "what calculation was
   performed" is answerable from the result itself.

   This instrumentation immediately caught a real defect: the Active
   "Trucking — Cargo" formula still named CargoRatePer100, a variable retired
   by the Cargo rebuild, so it threw on every quote and the engine silently
   fell back to its default chain. An Active formula that never rated
   anything is invisible without this — the premium looked correct. */
console.log("\n7bb. The engine records the calculation it actually performed");
{
  const rate = (lob, over) => {
    sb.__calcInput = Object.assign({}, CASES[lob], over); sb.__calcLob = lob;
    return vm.runInContext(`ENGINE.rate(__calcLob, __calcInput)`, sb);
  };
  const t = rate("TRUCK", {});

  check("a rated quote carries its calculation steps",
    Array.isArray(t.calculationSteps) && t.calculationSteps.length > 0,
    `${t.calculationSteps.length} steps`);
  check("each step names the coverage, mode and result it produced",
    t.calculationSteps.every(s => s.coverage && s.mode && typeof s.result === "number"));
  check("NO active saved formula fails and silently falls back",
    t.formulaFailures.length === 0,
    t.formulaFailures.map(f => `${f.coverage}: ${f.error}`).join("; "));
  check("a step that ran a saved formula shows the substituted arithmetic",
    t.calculationSteps.filter(s => s.mode === "formula")
      .every(s => s.expression && s.substituted && !/[A-Za-z]{4,}/.test(s.substituted)),
    (t.calculationSteps.find(s => s.mode === "formula") || {}).substituted);
  check("per-vehicle steps say which unit they belong to",
    t.calculationSteps.some(s => s.context));

  /* The seeded Cargo formula must reproduce the default chain exactly —
     activating a formula that restates the engine's own math must not move
     a premium. This is the check that would have caught the defect. */
  const cargoStep = t.calculationSteps.find(s => s.coverage === "Motor Truck Cargo");
  check("the seeded Cargo formula runs (not silently skipped)",
    cargoStep && cargoStep.mode === "formula" && !cargoStep.failed,
    cargoStep ? `${cargoStep.mode}${cargoStep.error ? " — " + cargoStep.error : ""}` : "no cargo step");
  check("and it reproduces the engine's own default chain",
    Math.round(cargoStep.result) === (t.groups.find(g => g.name === "Cargo") || {}).subtotal,
    `${cargoStep.result} vs ${(t.groups.find(g => g.name === "Cargo") || {}).subtotal}`);

  ["GL", "PROP", "MPL", "WC"].forEach(lob => {
    const r = rate(lob, {});
    check(`${lob} records its calculation and no formula fails`,
      r.calculationSteps.length > 0 && r.formulaFailures.length === 0,
      r.formulaFailures.map(f => f.error).join("; "));
  });
}

/* 7c. Primary class is DERIVED from size/use/radius, not taken as a raw
   input. The real system resolves primary_code out of a composite lookup
   before the factor lookup ever happens; treating the code as user input
   skipped that entire step. */
console.log("\n7c. Trucking: primary class is resolved, not supplied");
{
  const rate = over => {
    sb.__truckInput3 = Object.assign({}, CASES.TRUCK, over);
    return vm.runInContext(`ENGINE.rate("TRUCK", __truckInput3)`, sb);
  };
  const veh = o => [Object.assign({ n: 1, year: 2022, value: 145000, miles: 65000 }, o)];

  const derived = rate({ vehicles: veh({ sizeClass: "Heavy Truck-Tractor" }) });
  check("a vehicle with no class code still rates, by resolving one",
    derived.perVehicle[0].primClassSource === "resolved" && derived.finalPremium > 0,
    `source=${derived.perVehicle[0].primClassSource} premium=${derived.finalPremium}`);
  check("the resolved code is reported, not left blank",
    derived.perVehicle[0].primaryClass === "321",
    `got ${derived.perVehicle[0].primaryClass}`);
  check("an ambiguous resolution is flagged rather than silently picked",
    derived.perVehicle[0].primClassAmbiguous === true
      && derived.perVehicle[0].primClassCandidates.length > 1,
    `candidates=${JSON.stringify(derived.perVehicle[0].primClassCandidates)}`);

  const explicit = rate({ vehicles: veh({ primaryClass: "321", sizeClass: "Light Truck", businessUse: "Service" }) });
  check("an explicitly-assigned class code overrides resolution",
    explicit.perVehicle[0].primClassSource === "explicit" && explicit.perVehicle[0].primaryClass === "321",
    `source=${explicit.perVehicle[0].primClassSource} code=${explicit.perVehicle[0].primaryClass}`);

  const lightLocal = rate({ radiusClass: "local_200", vehicles: veh({ sizeClass: "Light Truck", businessUse: "Service" }) });
  check("resolution is real: a different size/use/radius resolves a different class and premium",
    lightLocal.perVehicle[0].primaryClass === "011" && lightLocal.finalPremium !== derived.finalPremium,
    `code=${lightLocal.perVehicle[0].primaryClass} ${lightLocal.finalPremium} vs ${derived.finalPremium}`);
  check("radius genuinely participates: same unit, longer radius resolves a different class",
    rate({ radiusClass: "long_haul", vehicles: veh({ sizeClass: "Light Truck", businessUse: "Service" }) })
      .perVehicle[0].primaryClass !== lightLocal.perVehicle[0].primaryClass);
}

/* 7d. Rate versioning: which filed generation rates a quote is a date
   question, and the date depends on the transaction. */
console.log("\n7d. Trucking: rate version is selected by date, not hardcoded");
{
  const rate = over => {
    sb.__truckInput4 = Object.assign({}, CASES.TRUCK, over);
    return vm.runInContext(`ENGINE.rate("TRUCK", __truckInput4)`, sb);
  };
  const PROD = "Digital Trucking Program";

  check("the rating date is resolved and reported",
    !!rate({}).asOf && !!rate({}).asOfBasis, rate({}).asOfBasis);
  check("policy effective date drives the rating date",
    rate({ effectiveDate: "2026-07-01" }).asOf === "2026-07-01");
  check("a rate lock struck before the effective date is honoured",
    rate({ effectiveDate: "2027-01-15", rateLockDate: "2026-11-20" }).asOf === "2026-11-20");
  check("an endorsement rates on the ORIGINAL inception date, not today",
    rate({ policyType: "Endorsement", effectiveDate: "2027-05-01", originalEffectiveDate: "2026-06-01" }).asOf === "2026-06-01");

  const named = rate({ product: PROD });
  check("naming a product resolves a real version record",
    named.versionResolved && named.versionRecord.version === named.version,
    `${named.version} (${named.versionRecord && named.versionRecord.status})`);
  check("with no product named, an ambiguous line reports the ambiguity instead of adopting a label",
    rate({}).versionAmbiguous === true && rate({}).versionResolved === false);

  /* Prove the machinery switches generations. Built HERE, in the test, not
     seeded into the shipped tables — no second filing's real values are
     known, and inventing them would put unfiled numbers in front of a user. */
  vm.runInContext(`(() => {
    const cur = VX.truckPrimary.find(p => p.code === "321");
    cur.effectiveEnd = "2026-12-10";
    VX.truckPrimary.push(Object.assign({}, cur, { id: 9001, liability: cur.liability * 2,
      ratingVersion: "vTEST", effectiveStart: "2026-12-11", effectiveEnd: "" }));
  })()`, sb);

  const beforeRev = rate({ product: PROD, asOf: "2026-09-01" });
  const afterRev = rate({ product: PROD, asOf: "2026-12-15" });
  check("a later rating date picks up the superseding generation",
    afterRev.perVehicle[0].primFactor === beforeRev.perVehicle[0].primFactor * 2,
    `${beforeRev.perVehicle[0].primFactor} -> ${afterRev.perVehicle[0].primFactor}`);
  check("and that actually changes the premium",
    afterRev.finalPremium > beforeRev.finalPremium,
    `${beforeRev.finalPremium} -> ${afterRev.finalPremium}`);
  check("the superseded row is retained, so history stays answerable",
    vm.runInContext(`VX.truckPrimary.filter(p => p.code === "321").length`, sb) === 2);
  check("exactly one generation is in force on any given date",
    vm.runInContext(`VX.tableAsOf(VX.truckPrimary, "2026-09-01").filter(p => p.code === "321").length`, sb) === 1
      && vm.runInContext(`VX.tableAsOf(VX.truckPrimary, "2026-12-15").filter(p => p.code === "321").length`, sb) === 1);
  check("a date before any filing rates on no generation rather than a wrong one",
    vm.runInContext(`VX.tableAsOf(VX.truckPrimary, "2020-01-01").length`, sb) === 0);

  /* Version info must reach a caller on EVERY line, not just Trucking, and a
     date with nothing in force must still name what it rated on. */
  const rateLob = (lob, over) => {
    sb.__vInput = Object.assign({}, CASES[lob], over); sb.__vLob = lob;
    return vm.runInContext(`ENGINE.rate(__vLob, __vInput)`, sb);
  };
  ["GL", "PROP", "MPL", "CYBER", "WC"].forEach(lob => {
    const rv = rateLob(lob, {}).ratingVersion;
    check(`${lob} reports rating-version info to the caller`,
      !!rv && !!rv.asOf && !!rv.version && Array.isArray(rv.available),
      rv ? `${rv.version}, ${rv.available.length} available` : "missing");
  });

  const noneInForce = rateLob("GL", { asOf: "2019-01-01", product: "Standard GL Program" });
  check("with no version in force, the quote still rates",
    noneInForce.finalPremium > 0, `${noneInForce.finalPremium}`);
  check("and it names the available version it fell back to, flagged as a fallback",
    noneInForce.ratingVersion.resolved === false
      && !!noneInForce.ratingVersion.fallback
      && !!noneInForce.ratingVersion.version,
    noneInForce.ratingVersion.fallback || "no fallback reported");
  check("the caller is told every version it could rate on instead",
    noneInForce.ratingVersion.available.length > 0,
    noneInForce.ratingVersion.available.map(a => a.version).join(", "));
  check("explain() describes the fallback rather than asserting a selection",
    (() => { sb.__er = noneInForce; return /fallback/i.test(vm.runInContext(`ENGINE.explain(__er).version`, sb)); })());

  /* Per-transaction version pinning: new business, renewals and endorsements
     need not rate on the same filing. */
  const TXN_PROD = "Digital Trucking Program";
  const truckTxn = (policyType, over) => {
    sb.__txn = Object.assign({}, CASES.TRUCK, { product: TXN_PROD, policyType,
      effectiveDate: "2026-07-31", originalEffectiveDate: "2025-12-01" }, over || {});
    return vm.runInContext(`ENGINE.rate("TRUCK", __txn)`, sb);
  };
  const setTxnVersions = map => {
    sb.__m = map; sb.__prod = TXN_PROD;
    vm.runInContext(`VX.products.find(p => p.name === __prod).versionByTransaction = __m`, sb);
  };

  setTxnVersions({ new: "", renewal: "", endorsement: "" });
  check("unset, every transaction type resolves by date",
    truckTxn("New Business").ratingVersion.pinnedTo === null
      && truckTxn("Renewal").ratingVersion.pinnedTo === null);
  check("and an endorsement still rates on the version in force at inception",
    truckTxn("Endorsement").ratingVersion.version === "v2025.11",
    truckTxn("Endorsement").ratingVersion.version);

  setTxnVersions({ new: "", renewal: "v2025.11", endorsement: "" });
  check("a renewal can be pinned to a different version than new business",
    truckTxn("Renewal").ratingVersion.version === "v2025.11"
      && truckTxn("Renewal").ratingVersion.pinnedTo === "Renewal"
      && truckTxn("New Business").ratingVersion.version === "v2026.03",
    `renewal=${truckTxn("Renewal").ratingVersion.version} new=${truckTxn("New Business").ratingVersion.version}`);
  check("pinning one transaction type does not pin the others",
    truckTxn("New Business").ratingVersion.pinnedTo === null);

  setTxnVersions({ new: "v2026.03", renewal: "v2026.03", endorsement: "v2026.03" });
  check("all three may be pinned to the SAME version — valid, and stated explicitly",
    ["New Business", "Renewal", "Endorsement"].every(t =>
      truckTxn(t).ratingVersion.version === "v2026.03" && truckTxn(t).ratingVersion.pinnedTo === t));

  setTxnVersions({ new: "v9999.99", renewal: "", endorsement: "" });
  check("a pin naming a version that does not exist falls back to date resolution, not to nothing",
    truckTxn("New Business").ratingVersion.version === "v2026.03",
    truckTxn("New Business").ratingVersion.version);

  /* A Draft has no effective date, so it is invisible to date resolution.
     Pinning to one used to match nothing and fall through silently — the
     product said one version and the quote rated on another, with no sign
     anything had been ignored. An explicit pin is honoured, and flagged. */
  setTxnVersions({ new: "v2026.06", renewal: "", endorsement: "" });
  const draftPin = truckTxn("New Business").ratingVersion;
  check("pinning to an unpublished Draft is honoured, not silently ignored",
    draftPin.version === "v2026.06" && draftPin.pinnedTo === "New Business",
    `${draftPin.version} (pinnedTo=${draftPin.pinnedTo})`);
  check("and it warns that the pinned version is not what the date would have chosen",
    !!draftPin.pinnedWarning && /Draft/.test(draftPin.pinnedWarning),
    draftPin.pinnedWarning || "no warning");

  setTxnVersions({ new: "v2026.03", renewal: "", endorsement: "" });
  check("pinning to the version the date would pick anyway raises no warning",
    truckTxn("New Business").ratingVersion.pinnedWarning === null);

  setTxnVersions({ new: "", renewal: "", endorsement: "" });
}

/* 7e. Admitted vs surplus lines. Two real money items ride on the licence
   basis, and it used to be decided by matching a hardcoded LOB name — which
   billed the one admitted tenant surplus-lines tax on every line but WC. */
console.log("\n7e. Licence basis: admitted paper owes no surplus-lines charges");
{
  const rate = (lob, over) => {
    sb.__licInput = Object.assign({}, CASES[lob], over);
    sb.__licLob = lob;
    return vm.runInContext(`ENGINE.rate(__licLob, __licInput)`, sb);
  };
  const slFee = r => r.feeLines.some(f => /Surplus Lines Filing/i.test(f.name || ""));

  const sl = rate("GL", { tenantId: 1 });   // VeriDex — non-admitted
  const ad = rate("GL", { tenantId: 2 });   // Ironclad — admitted

  check("a surplus-lines carrier is charged surplus-lines tax",
    sl.licenceBasis === "Surplus Lines" && sl.taxPct > 0 && sl.tax > 0, `tax=${sl.tax}`);
  check("an admitted carrier is charged none",
    ad.licenceBasis === "Admitted" && ad.taxPct === 0 && ad.tax === 0, `tax=${ad.tax}`);
  check("the surplus-lines filing fee follows the same rule",
    slFee(sl) === true && slFee(ad) === false);
  check("and that genuinely changes what the insured pays",
    ad.finalPremium < sl.finalPremium, `${sl.finalPremium} -> ${ad.finalPremium}`);
  check("the coverage premium itself is untouched — only the excise charges differ",
    ad.coveragePremium === sl.coveragePremium, `${sl.coveragePremium} vs ${ad.coveragePremium}`);

  check("a statutorily-admitted line stays admitted on a non-admitted carrier",
    rate("WC", { tenantId: 1 }).admitted === true && rate("WC", { tenantId: 1 }).taxPct === 0);
  check("Trucking on the default (surplus lines) tenant is unchanged",
    rate("TRUCK", {}).licenceBasis === "Surplus Lines");

  /* Product-level paper: the same line written both ways at once, which is
     how trucking is actually sold. */
  const setPaper = (prod, basis) => {
    sb.__p = prod; sb.__b = basis;
    vm.runInContext(`VX.products.find(p => p.name === __p).licenceBasis = __b`, sb);
  };
  check("a product with no licence basis inherits (nothing changes)",
    rate("TRUCK", { product: "Digital Trucking Program" }).licenceBasis === "Surplus Lines");

  setPaper("Digital Trucking Program", "Admitted");
  const admProd = rate("TRUCK", { product: "Digital Trucking Program" });
  const slProd = rate("TRUCK", { product: "VeriDex Non-Trucking Auto" });
  check("a product can be written on admitted paper",
    admProd.licenceBasis === "Admitted" && admProd.tax === 0 && !slFee(admProd),
    `${admProd.finalPremium}`);
  check("another product on the SAME line stays surplus lines",
    slProd.licenceBasis === "Surplus Lines" && slProd.tax > 0 && slFee(slProd),
    `${slProd.finalPremium}`);
  check("the two differ only in the excise charges, not the coverage premium",
    admProd.finalPremium < slProd.finalPremium
      && admProd.coveragePremium === slProd.coveragePremium);

  setPaper("VeriDex Workers' Comp Program", "Surplus Lines");
  check("a statutorily admitted line cannot be overridden to surplus lines by a product",
    rate("WC", { product: "VeriDex Workers' Comp Program" }).admitted === true);

  setPaper("Digital Trucking Program", "");
  setPaper("VeriDex Workers' Comp Program", "");
  check("clearing the override restores the inherited basis",
    rate("TRUCK", { product: "Digital Trucking Program" }).licenceBasis === "Surplus Lines");
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
