/* ==========================================================================
   Veridex Rating Engine — multi-LOB premium calculation
   Each calculator returns a structured, expandable breakdown so the Quote
   Portal never implements rating logic itself.
   ========================================================================== */

const ENGINE = (() => {

  const find = (arr, fn, fb) => arr.find(fn) || fb || arr[0];

  /* ==========================================================================
     Factor traces
     A rating factor is almost never a constant — it is the result of looking
     up one of the insured's own answers in a rate table. Emitting only the
     final number (the old [label, value, kind] triple) threw away everything
     a person needs to answer "why is it 1.15 and not 1.00?", so every factor
     is now emitted as a trace carrying the full chain:

        default (table's neutral row)
          -> driver + input (what the insured answered)
          -> matched (which row that answer selected)
          -> value (the factor actually applied)

     `options` carries the rest of the table so the UI can show what *would*
     have applied on a different answer. Bare arrays are still accepted from
     the LOB calculators that haven't been traced yet — see toTrace().
     ========================================================================== */
  function trace(o) {
    return {
      label: o.label, value: o.value, kind: o.kind || "x",
      driver: o.driver || null,                 // which insured question drives it
      input: o.input == null ? null : String(o.input),
      matched: o.matched || null,               // which rule/row that input selected
      table: o.table || null,                   // source rate table
      base: o.base == null ? null : o.base,     // the table's neutral/default row
      options: o.options || null,               // [{label, value, active}]
      varies: !!o.varies,                       // differs across vehicles
      note: o.note || null,
    };
  }
  // legacy [label, value, kind] arrays -> minimal trace, so untraced LOBs keep working
  const toTrace = f => Array.isArray(f) ? { label: f[0], value: f[1], kind: f[2] || "x",
    driver: null, input: null, matched: null, table: null, base: null, options: null, varies: false, note: null } : f;

  /* Build an options list from a rate table, flagging the row that matched. */
  const opts = (rows, labelFn, valFn, activeFn) => rows.map(r => ({
    label: labelFn(r), value: valFn(r), active: !!activeFn(r) }));

  /* ---------------- Commercial Trucking ----------------
     Verified against DIGITAL TRUCKING Rater_2026-03.xlsb (Vehicles!BV10/BW10,
     FinalPremium, Insured, Drivers tabs) on 2026-08-18. Per-vehicle Liability
     and APD formulas, factor order and real factor tables all match the
     source workbook. Three intentional, documented deviations remain — see
     the DEVIATIONS block below and the comments at each site.

     Cross-checked 2026-08-18 against the real ams-service implementation
     (app_type 483, "ISO New Rater") — udf_iso_new_rater_liab_calculations
     confirms the same term order, and LCM/Tort values above match production
     constants exactly. Two gaps found by that check, not yet closed here:
       1. Production has since layered several 2026 date-gated hotfix factors
          on top of this formula (a driver-criteria factor from 2026-03-05,
          broadened-pollution/defense-addback factors from 2026-03-12, a
          stated-value-by-year change from 2026-04-15) that postdate this
          workbook and aren't modeled.
       2. Every trucking product on this platform uses the Custom (483)
          per-vehicle rater — the legacy 501 account-level Auto Liability
          rater was retired, so VeriDex Non-Trucking Auto now maps to 483 and
          rates through this same flow deliberately, rather than falling
          through it as an unmodeled gap. */
  /* ---------------- Commercial Trucking ----------------
     Verified against DIGITAL TRUCKING Rater_2026-03.xlsb (Vehicles!BV10/BW10,
     FinalPremium, Insured, Drivers tabs) on 2026-08-18. Per-vehicle Liability
     and APD formulas, factor order and real factor tables all match the
     source workbook. Three intentional, documented deviations remain — see
     the DEVIATIONS block below and the comments at each site.

     Cross-checked 2026-08-18 against the real ams-service implementation
     (app_type 483, "ISO New Rater") — udf_iso_new_rater_liab_calculations
     confirms the same term order, and LCM/Tort values above match production
     constants exactly. Two gaps found by that check, not yet closed here:
       1. Production has since layered several 2026 date-gated hotfix factors
          on top of this formula (a driver-criteria factor from 2026-03-05,
          broadened-pollution/defense-addback factors from 2026-03-12, a
          stated-value-by-year change from 2026-04-15) that postdate this
          workbook and aren't modeled.
       2. Every trucking product on this platform uses the Custom (483)
          per-vehicle rater — the legacy 501 account-level Auto Liability
          rater was retired, so VeriDex Non-Trucking Auto now maps to 483 and
          rates through this same flow deliberately, rather than falling
          through it as an unmodeled gap.

     This was briefly REMOVED and replaced with two candidate rating models
     (Model A / Model B) at the user's request, then RESTORED at the user's
     further request once they saw the real formula was gone. Both candidate
     models are kept — see truckingReal() below for the real, verified
     formula (this platform's actual, primary Commercial Trucking engine),
     and truckingModelA()/truckingModelB() for the two candidates, still
     computed alongside it purely for comparison (r.modelA / r.modelB on the
     result), clearly disclosed as not filed everywhere they surface. */
  function truckingReal(i) {
    const cob = i.cob && i.cob.length ? i.cob : ["Auto Liability", "Physical Damage", "Cargo"];
    const st = i.state || "TX";
    const vehicles = (i.vehicles && i.vehicles.length) ? i.vehicles : [{ n: 1, desc: "Unit 1", primaryClass: "321", year: 2022, value: 145000, trailer: "None — Power Unit Only", trailerValue: 0, miles: 65000 }];
    const drivers = (i.drivers && i.drivers.length) ? i.drivers : [{ n: 1, name: "Driver 1", age: 42, cdlYears: 8, violations: 0, cls: "A — Clean" }];
    // A schedule row can stand for several identical units (Vehicles!X), so
    // the rated unit count is the sum of quantities, not the row count.
    const units = vehicles.reduce((s, v) => s + Math.max(1, +v.units || 1), 0);

    // Radius values mirror the real ams-ui radiusOfOperationsFormGroup options
    // (local_intermediate / 48_states / 12_western) mapped to rate-table bands.
    /* All five filed radius rows are now selectable. Two of them — Local-200
       (0.95) and Long Haul-1001+ (1.20) — existed in the table but had no key
       mapping to them, so no quote could ever select the cheapest or the most
       expensive band. A production payload rating at 0.95 is what exposed it. */
    const RAD_LABEL = {
      "local_200": "Local-200",
      "local_intermediate": "Intermediate-300",
      "12_western": "Statewide-500",
      "48_states": "Regional-1000",
      "long_haul": "Long Haul-1001+",
    };
    const radLabel = RAD_LABEL[i.radiusClass] || "Intermediate-300";
    const rad = find(VX.truckRadius, r => r.label === radLabel);
    const rc = find(VX.truckRatingClass, r => r.ratingClass === i.ratingClass);
    const dash = find(VX.truckDashcam, d => d.option === i.dashcam);
    const liabDed = find(VX.truckLiabDed, d => d.amount == i.liabDeductible);
    const apdDed = find(VX.truckApdDed, d => d.amount == i.apdDeductible, VX.truckApdDed[0]);
    const naics = find(VX.truckNAICS, n => n.code === i.naicsCode, VX.truckNAICS[0]);
    const lcm = VX.programParams.find(p => p.param === "Liability LCM").value; // ProgramDeviations!B2 — confirmed current (1.67) against ams-service's udf_iso_new_rater_liab_calculations_0564.sql, which hardcodes the same value with a "changed lcm factor" comment
    const minRate = VX.programParams.find(p => p.param === "APD Absolute Minimum Rate").value; // Table26[APDMinRate]
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;
    /* ---- Territory & loss cost ----
       When the full extracted workbook tables are loaded (rate-data-full.js)
       the territory is resolved from the garaging ZIP against the real
       57,084-row ZIPCodes table and the loss cost read from the full 1,953-row
       CA_Liab_LC. Without them we fall back to the per-state sample, which
       always picked that state's FIRST territory — in Texas that is the
       cheapest of 52, spanning 234 to 1,050, so the fallback can understate
       a premium several-fold. The banner in the Quote Portal says so. */
    const FULL = (typeof VXFULL !== "undefined") ? VXFULL : null;
    const quoteZip = i.garageZip || (vehicles[0] && vehicles[0].garageZip) || null;
    const territory = FULL && quoteZip ? FULL.territoryForZip(st, quoteZip) : null;
    const fullLC = FULL && territory
      ? FULL.lossCostFor(st, territory, "Trucks, Tractors And Trailers", "Liability") : null;
    const baseLC = fullLC ?? (VX.truckBaseLC[st] ?? VX.truckBaseLC.DEFAULT);
    const lcSource = fullLC != null ? `CA_Liab_LC — ${st} territory ${territory} (from ZIP ${quoteZip})`
      : `CA_Liab_LC — ${st}, first territory on file (no ZIP supplied)`;
    /* LiabLC_StateAdj_Tbl is extracted and browsable, but deliberately NOT
       applied: it does not appear anywhere in the Vehicles!BV10 chain, so
       adding it would inflate every premium against the source rater. */
    const ilfTable = VX.truckILF[st] || VX.truckILF.DEFAULT; // ILFs, ILTA=2 (Heavy Trucks/Truck-Tractors)
    const fullIlf = FULL ? FULL.ilfFor(st, 2, +i.liabLimit) : null;
    const ilf = fullIlf ?? (ilfTable[i.liabLimit] || ilfTable[1000000]);
    const apdStateFactor = st === "CA" ? VX.truckApdState.CA : VX.truckApdState.DEFAULT; // Table9
    const apdPackageFactor = (cob.includes("Auto Liability") && cob.includes("Physical Damage")) ? VX.truckApdPackage.yes : VX.truckApdPackage.no; // Table11
    const tortFactor = VX.truckTortFactor; // Helper_CovTypesOptions_Liab — 1.0 outside NJ's tort-elimination election; confirmed current — ams-service hardcodes the same constant (_tort_limit_factor numeric := 1.00), not yet varying by state in production either
    /* Vehicles!BI10 applies Deviation_Ded (ProgramDeviations!B6) to the
       liability deductible factor before it is subtracted from the ILF.
       This was previously missed, so every quote with a liability deductible
       was over-crediting the deductible by 33%. */
    const dedDeviation = (VX.programParams.find(p => p.param === "Deductible Factor Adj") || { value: 1 }).value;
    const liabDedFactor = +(liabDed.factor * dedDeviation).toFixed(4);

    /* ---- Driver_Class_Fctr / CDL_Exp_Disc_Fctr — Insured/Drivers tabs ----
       Real formula ranks drivers by class factor, takes the best `units`
       drivers (unassigned vehicle slots use a separate "unassigned driver"
       factor), and averages both across the fleet. */
    /* Driver class factor now comes from the real 4,386-row DriverClassFctr
       grid (age x violation points) when the full tables are loaded.

       An earlier note here claimed that table's 3.05-8.99 values were out of
       scale and substituted a 0.85-1.85 stand-in. That was wrong, and it was
       based on reading only the top of the table: those high values are the
       UNDERAGE and high-point rows. A clean 42-year-old is 0.95, three points
       is 1.28, ten points is 3.05 — a sensible curve. The stand-in was badly
       under-penalising poor driving records, so the real table is used. */
    const FULLD = (typeof VXFULL !== "undefined") ? VXFULL : null;
    const pointsFor = d => {
      if (!FULLD || !d.violationCode) return Math.max(0, (+d.violations || 0) * 2); // count x2 approximates first+additional
      const v = FULLD.violations.find(x => x[0] === String(d.violationCode));
      if (!v) return Math.max(0, (+d.violations || 0) * 2);
      const n = Math.max(1, +d.violations || 1);
      return v[2] + (n - 1) * v[3];                        // VIO FIRST + (n-1) x VIO ADDTL
    };
    const rated = drivers.map(d => {
      const pts = pointsFor(d);
      const real = FULLD ? FULLD.driverClassFor(Math.max(14, Math.min(99, +d.age || 42)), Math.min(50, pts)) : null;
      const c = find(VX.driverClasses, x => x.cls === d.cls, VX.driverClasses[0]);
      return { ...d, points: pts, classFactor: real ?? c.factor, factorSource: real != null ? "DriverClassFctr" : "class band",
        qualified: +d.cdlYears >= 3 ? 1 : 0 };
    }).sort((a, b) => a.classFactor - b.classFactor); // best (lowest factor) first, mirrors AK9 rank
    const topN = rated.slice(0, units);
    const unassignedSlots = Math.max(0, units - rated.length);
    const UNASSIGNED_DRIVER_FACTOR = 1.85; // no on-file driver for that unit — rate as the worst class, same intent as real "UnassignedDrvr"
    const driverClassFctr = topN.length
      ? +(((topN.reduce((s, d) => s + d.classFactor, 0) + unassignedSlots * UNASSIGNED_DRIVER_FACTOR) / units).toFixed(3))
      : UNASSIGNED_DRIVER_FACTOR;
    const cdlQualifiedFrac = topN.length ? topN.filter(d => d.qualified).length / topN.length : 0;
    const CDL_MAX_POL_DISC = 0.10; // named range CDL_MaxPolDisc
    const cdlExpDiscFctr = +(1 - cdlQualifiedFrac * CDL_MAX_POL_DISC).toFixed(3);
    const surcharged = drivers.filter(d => +d.violations > 0).length;

    /* ---- AccountLevelFctr — Insured!Z15, sum of 8 credit/debit lines,
       clamped 0.85-1.50 ---- */
    const acctMin = VX.programParams.find(p => p.param === "Account Factor Min").value;
    const acctMax = VX.programParams.find(p => p.param === "Account Factor Max").value;
    const bizExp = find(VX.truckAcctBizExp, b => String(b.yearsInBusiness) === String(i.yearsInBusiness), { factor: 0 });
    const safetyRow = VX.truckAcctCarrierSafety.find(s => s.rating === i.carrierSafetyRating &&
      (s.fmcsaAlerts === "4+" ? +i.fmcsaAlerts >= 4 : s.fmcsaAlerts === +i.fmcsaAlerts)) || { factor: 0 };
    // Banded lookups — the UI sends the band label the workbook itself uses
    const oosVehRow = find(VX.truckAcctOOS.vehicles, b => b.band === i.oosVehiclesBand, { factor: 0 });
    const oosDrvRow = find(VX.truckAcctOOS.drivers, b => b.band === i.oosDriversBand, { factor: 0 });
    // Loss frequency is keyed by band AND fleet size (Table59 is a 2-D grid)
    const lossFreqRow = VX.truckAcctLossFreq.find(f => f.band === (i.lossFreqBand || "No Loss Data")
      && units >= f.min && units <= f.max) || { factor: 0, unitBand: "—" };
    const iccFactor = VX.truckAcctICC[i.iccFiling || "yes"];
    /* Renewal credit needs BOTH a Renewal policy type and confirmed
       eligibility — the workbook tests C15="Renewal" AND C17="Yes". */
    const isRenewal = (i.policyType || "New Business") === "Renewal";
    const renewalFactor = (isRenewal && (i.renewalEligible || "no") === "yes") ? VX.truckAcctRenewal.yes : VX.truckAcctRenewal.no;

    /* Insured!Z14 — driver licence states. Previously hardcoded to 0 because
       no per-driver licence data was captured; the Driver Schedule has it, so
       it is now computed: any foreign licence is a flat debit, otherwise a
       New York concentration is debited on a sliding scale. */
    const L = VX.truckAcctLicState;
    const licStates = drivers.map(d => String(d.licState || "").toUpperCase());
    const nyShare = licStates.length ? licStates.filter(s => s === "NY").length / licStates.length : 0;
    const driverLicStateFactor = licStates.includes("FOREIGN") ? L.foreign
      : (nyShare > 0 ? (nyShare <= L.nyLowMaxShare ? L.nyLow : L.nyHigh) : 0);

    /* New Venture floor: the workbook wraps Carrier Safety, both OOS lines and
       Loss Frequency in MAX(0, ...) when Years in Business is "New Venture" —
       an unproven account cannot earn those credits, only their debits. */
    const newVenture = String(i.yearsInBusiness) === "New Venture";
    const nvFloor = v => newVenture ? Math.max(0, v) : v;

    /* Three real, flat, account-level answers — verified against ams-service's
       real stored procedure (public.udf_get_factor_for_iso_new_rater):
       _driver_criteria, _broadened_pollution, _defense_addback. Each is a
       single Yes/No UW question, not a per-vehicle lookup — see
       D.truckAcctDriverCriteria / D.truckAcctPollution / D.truckAcctDefenseAddback
       in data.js for the full correction note (this replaces an invented
       age/CDL-derived 4-band "driver criteria" table and an invented graded
       "pollution" table that both previously lived per-vehicle, below in the
       perVehicle map — removed there to avoid double-counting now that they
       are correctly modelled once, at the account level). */
    const driverCriteriaTerm = (i.driverCriteria1Year || "no") === "yes" ? VX.truckAcctDriverCriteria.yes : VX.truckAcctDriverCriteria.no;
    const pollutionTerm = (i.broadenedPollution || "no") === "yes" ? VX.truckAcctPollution.yes : VX.truckAcctPollution.no;
    const defenseAddbackTerm = (i.defenseAddback || "no") === "yes" ? VX.truckAcctDefenseAddback.yes : VX.truckAcctDefenseAddback.no;

    /* CORRECTED — the real source computes Liability's and Physical Damage's
       account-level factor SEPARATELY (_liab_acc_level_factor /
       _pd_acc_level_factor), not one shared value applied to both as this
       platform modelled until now. Both share the same LossFrequency band
       here (the source uses two different loss ratios; this platform
       captures one — a disclosed simplification, not a claim they're the
       same). BroadenedPollution and DefenseCostAddback are Liability-only in
       the source; Physical Damage's list omits both. */
    const liabAcctLines = [
      ["Renewal Discount", renewalFactor], ["Business Experience", bizExp.factor],
      ["Carrier Safety / FMCSA Alerts", nvFloor(safetyRow.factor)],
      ["OOS Violations — Vehicles", nvFloor(oosVehRow.factor)], ["OOS Violations — Drivers", nvFloor(oosDrvRow.factor)],
      ["ICC Filing", iccFactor], ["Loss Frequency", nvFloor(lossFreqRow.factor)],
      ["Driver License States", driverLicStateFactor],
      ["Driver Criteria (1-Year)", driverCriteriaTerm], ["Broadened Pollution", pollutionTerm],
      ["Defense Cost Addback", defenseAddbackTerm],
    ];
    const pdAcctLines = [
      ["Renewal Discount", renewalFactor], ["Business Experience", bizExp.factor],
      ["Carrier Safety / FMCSA Alerts", nvFloor(safetyRow.factor)],
      ["OOS Violations — Vehicles", nvFloor(oosVehRow.factor)], ["OOS Violations — Drivers", nvFloor(oosDrvRow.factor)],
      ["ICC Filing", iccFactor], ["Loss Frequency", nvFloor(lossFreqRow.factor)],
      ["Driver License States", driverLicStateFactor],
      ["Driver Criteria (1-Year)", driverCriteriaTerm],
    ];
    const liabAcctRaw = 1 + liabAcctLines.reduce((s, [, v]) => s + v, 0);
    const liabAcctDefault = +Math.min(acctMax, Math.max(acctMin, liabAcctRaw)).toFixed(3);
    const pdAcctRaw = 1 + pdAcctLines.reduce((s, [, v]) => s + v, 0);
    const pdAcctDefault = +Math.min(acctMax, Math.max(acctMin, pdAcctRaw)).toFixed(3);

    /* The account factor is formula-driven like every other chain. Unlike the
       others it is ADDITIVE and clamped, which is why the evaluator needed
       MIN/MAX. With no Active formula saved this falls back to the *Default
       above — the exact expression above — so behaviour is unchanged until
       someone authors one. Two separate hooks now (__ACCOUNT__ for
       Liability, __ACCOUNT_PD__ for Physical Damage) matching the two real,
       separately-computed factors. */
    const liabAcctR = applySavedFormula("Commercial Trucking", "__ACCOUNT__", {
      RenewalDiscount: renewalFactor,
      BusinessExperience: bizExp.factor,
      CarrierSafetyFMCSA: nvFloor(safetyRow.factor),
      OOSVehicles: nvFloor(oosVehRow.factor),
      OOSDrivers: nvFloor(oosDrvRow.factor),
      ICCFiling: iccFactor,
      LossFrequency: nvFloor(lossFreqRow.factor),
      DriverLicenseStates: driverLicStateFactor,
      DriverCriteria: driverCriteriaTerm,
      BroadenedPollution: pollutionTerm,
      DefenseCostAddback: defenseAddbackTerm,
      AccountFactorMin: acctMin,
      AccountFactorMax: acctMax,
    }, liabAcctDefault);
    const liabAcct = +(+liabAcctR.value).toFixed(3);
    const liabAcctRatedBy = liabAcctR.ratedBy;

    const pdAcctR = applySavedFormula("Commercial Trucking", "__ACCOUNT_PD__", {
      RenewalDiscount: renewalFactor,
      BusinessExperience: bizExp.factor,
      CarrierSafetyFMCSA: nvFloor(safetyRow.factor),
      OOSVehicles: nvFloor(oosVehRow.factor),
      OOSDrivers: nvFloor(oosDrvRow.factor),
      ICCFiling: iccFactor,
      LossFrequency: nvFloor(lossFreqRow.factor),
      DriverLicenseStates: driverLicStateFactor,
      DriverCriteria: driverCriteriaTerm,
      AccountFactorMin: acctMin,
      AccountFactorMax: acctMax,
    }, pdAcctDefault);
    const pdAcct = +(+pdAcctR.value).toFixed(3);
    const pdAcctRatedBy = pdAcctR.ratedBy;

    // Back-compat aliases: everything below and every caller that reads the
    // single "account factor" (traces, r.accountFactor, the UI) means
    // Liability's — the one that was always shown — pd's is exposed
    // separately (r.pdAccountFactor / r.pdAccountFactorLines).
    const acctLines = liabAcctLines, acctRaw = liabAcctRaw, acct = liabAcct, acctRatedBy = liabAcctRatedBy;

    /* ---- Experience Mod — ExperienceRatingMod_ALT1!W7 ----
       Real formula runs off an individual claim listing; this UI captures
       the same inputs in aggregate (claim count >$500, limited incurred
       losses, book premium/car-years implied by the current fleet) rather
       than a full loss-run grid, then applies the identical credibility
       formula.

       LossRating_ALT2 is NOT a second rating path FinalPremium chooses
       between — checked directly against source 2026-08-19: FinalPremium
       contains no reference to LossRating_ALT2 or to ExperienceRatingMod at
       all, and no other sheet in the workbook references LossRating_ALT2
       either. It is an orphaned tab whose own formulas depend on two LDF
       tables (AUTO_LIAB_LDF_Industry, AUTO_LIAB_LDF_Competitors) that are
       themselves blank in this workbook. ExperienceMod alone governs the
       rated premium, both here and in the source file. */
    const priorClaims = +i.priorClaims || 0;
    const priorIncurred = +i.priorIncurredLosses || 0;
    const expMonths = +i.experienceMonths || 36; // ExperienceRatingMod_ALT1!X2 "Experience Period"
    const earnedCarYears = units * (expMonths / 12); // proxy for R3 "Earned Car Years" — real formula sums exposure off the claim listing itself; this UI captures aggregates instead, so current fleet size stands in for historical exposure
    const frequency = earnedCarYears ? priorClaims / earnedCarYears : 0; // R4
    const bookPremiumProxy = baseLC * ilf * lcm * units; // stand-in for U2 "Book Premium" = SUM(Vehicles!BZ10:BZ14), this quote's own basic-limit premium
    const lossRatio = (bookPremiumProxy * earnedCarYears) ? priorIncurred / (bookPremiumProxy * earnedCarYears) : 0; // U4
    // S6: credibility scales with (# vehicles × experience-period months), not earned car years
    const credAdj = units ? ((1 - Math.pow(0.975, units * expMonths)) / 2) * (0.7 - 2 * frequency - lossRatio) : 0;
    const experienceMod = +Math.max(1 - 0.10, 1 - credAdj).toFixed(3); // W7: only the credit side is capped (Max Credit 10%) — a bad loss history can push this arbitrarily high, matching the real formula

    /* ---- rate every vehicle, then sum ---- */
    const CUR = new Date().getFullYear();
    /* ---- Account-level derivations for the newly modelled factors ----
       All are resolved FROM THE REQUEST, never read off it as a pre-computed
       value. Absent input resolves to the neutral row, so a request that does
       not carry the answer rates exactly as it did before these existed.

       Pollution and Driver Criteria used to live here as PER-VEHICLE factors
       (a graded pollution lookup, and a criteria derived by inspecting the
       driver schedule for a young-or-inexperienced driver). Verified against
       ams-service's real stored procedure and corrected: both are real,
       single, ACCOUNT-LEVEL Yes/No answers, not per-vehicle — moved up into
       liabAcctLines/pdAcctLines above (driverCriteriaTerm / pollutionTerm /
       defenseAddbackTerm) so they price once per account, matching the
       source, not once per vehicle. Nothing here replaces them. */

    // Payment plan / bill type -> factor
    const payRow = i.billType
      ? find(VX.truckPaymentPlan, r => r.plan === i.billType, { plan: "Agency Bill", factor: 1 })
      : { plan: "Not supplied", factor: 1 };

    /* Loss experience: derived from the prior-term loss ratio the request
       already carries for the experience mod. */
    const priorLR = (+i.priorIncurredLosses > 0 && +i.bookPremiumProxy > 0)
      ? (+i.priorIncurredLosses / +i.bookPremiumProxy) : null;
    const lossExpRow = priorLR == null
      ? find(VX.truckLossExperience, r => r.band === "No prior experience", { factor: 1 })
      : find(VX.truckLossExperience, r => r.min != null && priorLR > r.min && priorLR <= r.max,
          { band: "No prior experience", factor: 1 });

    /* Underwriter credit/debit is a judgment value, clamped to the filed band
       rather than looked up. */
    const uwBand = VX.truckUwCreditDebit || { min: 0.75, max: 1.25, neutral: 1 };
    const uwRaw = i.uwCreditDebit == null ? uwBand.neutral : +i.uwCreditDebit;
    const uwFactor = Math.min(uwBand.max, Math.max(uwBand.min, isNaN(uwRaw) ? uwBand.neutral : uwRaw));

    const perVehicle = vehicles.map(v => {
      /* The rater sets radius, rating class, NAICS, limit, deductibles and
         coverage selection PER VEHICLE. Each falls back to the account-level
         answer when the schedule row doesn't override it, so a mixed fleet
         can now be expressed without breaking single-answer quotes. */
      const vRad = v.radiusClass ? (find(VX.truckRadius, r => r.label === (RAD_LABEL[v.radiusClass] || v.radiusClass), rad)) : rad;
      const vRc = v.ratingClass ? find(VX.truckRatingClass, r => r.ratingClass === v.ratingClass, rc) : rc;
      /* Declared here rather than further down because both the NAICS and the
         fleet-size lookups below now branch on it. */
      const isPPT = v.vehType === "Private Passenger Types";

      /* CA_NAICS_PPT — extracted but never selected. Every filed PPT factor is
         1.000, so this changes no premium; it selects the correct table and
         lets the trace say which one was read rather than implying the truck
         table applied to a private-passenger unit. */
      const vNaicsPPT = (isPPT && FULL && FULL.naicsPPT)
        ? FULL.naicsPPT.find(r => r[0] === (v.naicsCode || i.naicsCode))
        : null;
      const vNaics = vNaicsPPT
        ? { code: vNaicsPPT[0], label: vNaicsPPT[1], factor: vNaicsPPT[2] }
        : (v.naicsCode ? find(VX.truckNAICS, n => n.code === v.naicsCode, naics) : naics);
      const vLiabDed = v.liabDeductible != null ? find(VX.truckLiabDed, d => d.amount == v.liabDeductible, liabDed) : liabDed;
      const vApdDed = v.apdDeductible != null ? find(VX.truckApdDed, d => d.amount == v.apdDeductible, apdDed) : apdDed;
      const vIlf = v.liabLimit ? (ilfTable[v.liabLimit] || ilf) : ilf;
      const vLiabDedFactor = +(vLiabDed.factor * dedDeviation).toFixed(4);
      const vCovLiab = v.covLiab === undefined ? cob.includes("Auto Liability") : !!v.covLiab;
      const vCovApd = v.covApd === undefined ? cob.includes("Physical Damage") : !!v.covApd;
      const qty = Math.max(1, +v.units || 1);              // Vehicles!X — one row can be several identical units

      const prim = find(VX.truckPrimary, p => p.code === v.primaryClass);
      const vAge = Math.max(0, CUR - (+v.year || CUR));
      const age = find(VX.truckAge, a => a.vehicleAge == Math.min(vAge, 27));
      const milesRow = find(VX.truckMiles, m => m.radiusCategory === vRad.category && +v.miles >= m.min && +v.miles <= m.max, VX.truckMiles[0]);
      const trl = find(VX.trailerTypes, t => t.type === v.trailer, VX.trailerTypes[0]);
      /* Fleet size. The 12 Private Passenger Type classes (738x/739x) carry no
         `fleetType`, so the truck-curve lookup below could never match one and
         every PPT unit silently fell through to {factor:1} — no fleet
         adjustment at all, where the filed PPT curve runs 1.10 down to 0.80.
         CA_Fleet_PPT was extracted but never selected; it is wired here. */
      const fleetPPTRow = (isPPT && FULL && FULL.fleetPPT)
        ? FULL.fleetPPT.find(r => units >= r[2] && units <= r[3])
        : null;
      const fleetRow = fleetPPTRow
        ? { factor: fleetPPTRow[1], label: fleetPPTRow[0], vehicleType: "Private Passenger Types" }
        : find(VX.truckFleetSize, f => f.vehicleType === prim.fleetType && units >= f.min && units <= f.max, { factor: 1 });
      /* OCN bands on the AUTO LIABILITY value, which is not the same figure as
         the stated value used for physical damage. A production payload carried
         stated_value 500,000 and al_value 106,586: banding on the stated value
         gave 1.43 where the filed answer is 1.14 — a 25% overstatement of every
         liability premium on that unit. `alValue` falls back to `value` so a
         quote that only carries one figure is unaffected. */
      const ocnBasis = +(v.alValue != null ? v.alValue : v.value) || 0;
      const ocnRow = VX.truckOCN.find(o => o.vehicleType === prim.ocnType && ocnBasis >= o.min && ocnBasis <= o.max) || { factor: 1 };
      const trailerPdFactor = VX.truckTrailerPdFactor[trl.pdBucket] ?? 1;

      // Liability — Vehicles!BV10: ROUND(BaseLC × (ILF − LiabDedFactor) × LCM
      // × Primary × Secondary × Fleet × Age × OCN × Radius × NAICS × Tort ×
      // Miles × RatingClass × Dashcam × CDL × DriverClass × AccountLevel, 0)
      // CA_SecondaryFactors — full 43-code table when loaded; a single vehicle's
      // secondary class overrides the account-level fallback constant.
      const secRow = v.secondaryClass && FULL ? FULL.secondaryClassFor(v.secondaryClass) : null;
      const secondary = secRow ? secRow[2] : VX.truckSecondaryFactor;
      const liabAge = isPPT ? age.pptLiability : age.tttLiability;
      /* Ownership and specialised-use are per-unit: one schedule can mix an
         owned tractor with an owner-operator unit. */
      const ownRow = v.ownership
        ? find(VX.truckOwnership, r => r.option === v.ownership, { option: "Not specified", factor: 1 })
        : find(VX.truckOwnership, r => r.option === "Not specified", { option: "Not specified", factor: 1 });
      const useRow = find(VX.truckHeavyUse, r => r.use === (v.useType || "General Freight"),
        { use: "General Freight", farm: 1, dumping: 1 });

      const liabDefault = baseLC * (vIlf - vLiabDedFactor) * lcm * prim.liability * secondary * fleetRow.factor
        * liabAge * ocnRow.factor * vRad.liabilityFactor * vNaics.factor * tortFactor
        * ownRow.factor * payRow.factor
        * lossExpRow.factor * uwFactor * useRow.farm * useRow.dumping
        * milesRow.factor * vRc.factor * dash.factor * cdlExpDiscFctr * driverClassFctr * liabAcct;
      const liabR = applySavedFormula("Commercial Trucking", "Auto Liability", {
        BaseLossCost: baseLC, ILF: vIlf, LiabDeductibleFactor: vLiabDedFactor, LCM: lcm, PrimaryClassFactor: prim.liability,
        SecondaryClassFactor: secondary, FleetSizeFactor: fleetRow.factor, VehicleAgeFactor: liabAge, OCNFactor: ocnRow.factor,
        RadiusFactor: vRad.liabilityFactor, NAICSFactor: vNaics.factor, TortLimitationFactor: tortFactor,
        VehicleOwnedFactor: ownRow.factor,
        PaymentPlanFactor: payRow.factor,
        LossExperienceFactor: lossExpRow.factor, UwCreditDebitFactor: uwFactor,
        HeavyFarmFactor: useRow.farm, HeavyDumpingFactor: useRow.dumping,
        MilesDrivenFactor: milesRow.factor, RatingClassFactor: vRc.factor, DashcamFactor: dash.factor,
        CDLExpDiscFactor: cdlExpDiscFctr, DriverClassFactor: driverClassFctr, AccountFactor: liabAcct,
      }, liabDefault);
      const l = vCovLiab ? Math.round(liabR.value) * qty : 0;

      // APD — Vehicles!BW10: VehicleValue × MAX(full chain, floor)
      const apdRateRow = [...VX.truckPhysDamRate].reverse().find(([val]) => (+v.value || 0) >= val) || VX.truckPhysDamRate[0];
      const apdRate = apdRateRow[1];
      // Package credit only applies when THIS vehicle carries both coverages
      const vApdPackage = (vCovLiab && vCovApd) ? VX.truckApdPackage.yes : VX.truckApdPackage.no;
      const fullChainDefault = apdRate * vApdDed.factor * vRad.apdFactor * trailerPdFactor * milesRow.factor * vRc.factor
        * dash.factor * apdStateFactor * vApdPackage * cdlExpDiscFctr * driverClassFctr * pdAcct;
      // VehicleValue pinned to 1 — evaluate the per-$-of-value rate, not a
      // dollar amount, so the floor-rate safety net below still applies
      // regardless of whether a saved formula or the default chain produced it.
      const apdR = applySavedFormula("Commercial Trucking", "Physical Damage", {
        VehicleValue: 1, APDRate: apdRate, APDDeductibleFactor: vApdDed.factor, APDRadiusFactor: vRad.apdFactor,
        TrailerPhysDamFactor: trailerPdFactor, MilesDrivenFactor: milesRow.factor, RatingClassFactor: vRc.factor,
        DashcamFactor: dash.factor, APDStateFactor: apdStateFactor, APDPackageFactor: vApdPackage,
        CDLExpDiscFactor: cdlExpDiscFctr, DriverClassFactor: driverClassFctr, AccountFactor: pdAcct,
      }, fullChainDefault);
      const floorRate = minRate * vApdDed.factor * apdStateFactor;
      const a = vCovApd ? Math.round((+v.value || 0) * Math.max(apdR.value, floorRate)) * qty : 0;

      const tiv = ((+v.value || 0) + (trl.type.startsWith("None") ? 0 : (+v.trailerValue || 0))) * qty;
      return { ...v, vAge, qty, primDesc: prim.desc, primFactor: prim.liability,
        ageFactor: isPPT ? age.pptLiability : age.tttLiability,
        milesFactor: milesRow.factor, trailerFactor: trailerPdFactor, fleetFactor: fleetRow.factor, ocnFactor: ocnRow.factor,
        radiusLabel: vRad.label, ratingClassName: vRc.ratingClass, naicsUsed: vNaics.code,
        liabLimitUsed: v.liabLimit || i.liabLimit, covLiab: vCovLiab, covApd: vCovApd,
        secondaryFactor: secondary, secondaryDesc: secRow ? (secRow[1] || `Secondary Class ${secRow[0]}`) : "Account default",
        ownedFactor: ownRow.factor, ownedLabel: ownRow.option,
        farmFactor: useRow.farm, dumpingFactor: useRow.dumping, useLabel: useRow.use,
        tiv, liab: l, apd: a, total: l + a, liabRatedBy: liabR.ratedBy, apdRatedBy: apdR.ratedBy };
    });

    const groups = [];
    const liabBeforeMod = perVehicle.reduce((s, v) => s + v.liab, 0);
    const apdBeforeMod = perVehicle.reduce((s, v) => s + v.apd, 0);
    // FinalPremium!L9/L11 — both coverages multiplied by the same ExperienceMod after summing
    const liabTotal = Math.round(liabBeforeMod * experienceMod);
    const apdTotal = Math.round(apdBeforeMod * experienceMod);

    /* Several factors are looked up per vehicle, so a policy-level breakdown
       has to say "1.04×" when every unit agrees and "varies 1.04–1.12×" when
       they don't, rather than silently showing unit 1 and implying it's the
       whole fleet. */
    const vSpread = fn => {
      const uniq = [...new Set(perVehicle.map(v => +fn(v)))];
      return { varies: uniq.length > 1, value: uniq[0], min: Math.min(...uniq), max: Math.max(...uniq) };
    };
    const vNote = sp => sp.varies ? `varies by unit — ${sp.min}× to ${sp.max}×` : null;

    const RAD_INPUT_LABEL = { local_intermediate: "Local / Intermediate", "12_western": "12 Western States", "48_states": "48 States" };
    const radInput = RAD_INPUT_LABEL[i.radiusClass] || "Intermediate";

    if (cob.includes("Auto Liability")) {
      const primSp = vSpread(v => v.primFactor), ageSp = vSpread(v => v.ageFactor), secSp = vSpread(v => v.secondaryFactor);
      const ocnSp = vSpread(v => v.ocnFactor), milesSp = vSpread(v => v.milesFactor), fleetSp = vSpread(v => v.fleetFactor);
      groups.push({ name: "Auto Liability", icon: "fa-scale-balanced", color: "var(--cat-1)", subtotal: liabTotal,
        ratedBy: (perVehicle[0] || {}).liabRatedBy,
        factors: [
          trace({ label: "Territory Base Loss Cost (per unit)", value: baseLC, kind: "money",
            driver: quoteZip ? "Garaging State + ZIP" : "Garaging State", input: quoteZip ? `${st} ${quoteZip}` : st,
            table: "CA_Liab_LC — Trucks/Tractors/Trailers, Liability", matched: lcSource,
            note: fullLC != null
              ? "Territory resolved from the garaging ZIP against the full 57,084-row ZIPCodes table."
              : "No garaging ZIP supplied, so this falls back to the first territory on file for the state — often the cheapest. Enter a ZIP on the vehicle for the real territory." }),
          trace({ label: "Increased Limits Factor (ILF)", value: ilf, kind: "x",
            driver: "Liability Limit", input: "$" + Number(i.liabLimit || 1000000).toLocaleString("en-US"),
            table: `IncreasedLimitsFactors — ${st}, ILTA 2 (Heavy Trucks & Truck-Tractors)`,
            matched: `$${Number(i.liabLimit || 1000000).toLocaleString("en-US")} limit in ${st}`, base: 1.00,
            options: opts(Object.entries(ilfTable), ([lim]) => "$" + Number(lim).toLocaleString("en-US"), ([, f]) => f, ([lim]) => +lim === +i.liabLimit),
            note: "1.00 is the basic ($100K) limit. Higher limits cost proportionally more." }),
          trace({ label: "Liability Deductible Factor", value: liabDedFactor, kind: "x",
            driver: "Liability Deductible", input: "$" + Number(liabDed.amount).toLocaleString("en-US"),
            table: "CA_Liab_Deductible — Combined Single Limit", matched: `$${Number(liabDed.amount).toLocaleString("en-US")} deductible × ${dedDeviation} program deviation`, base: 0,
            options: opts(VX.truckLiabDed, d => "$" + d.amount.toLocaleString("en-US"), d => +(d.factor * dedDeviation).toFixed(4), d => d.amount === liabDed.amount),
            note: `Subtracted from the ILF, not multiplied. The table factor (${liabDed.factor}) is first scaled by the ${dedDeviation} program deductible deviation, giving ${liabDedFactor}.` }),
          trace({ label: "Loss Cost Multiplier (LCM)", value: lcm, kind: "x",
            driver: null, input: null, table: "ProgramDeviations", matched: "Program constant — same for every quote", base: lcm,
            note: "Carrier-selected loading for expenses and profit. Not driven by anything the insured enters." }),
          trace({ label: "Primary Class Factor", value: primSp.varies ? primSp.max : primSp.value, kind: "x", varies: primSp.varies,
            driver: "Vehicle Class (per unit)", input: primSp.varies ? `${units} units, mixed classes` : perVehicle[0].primDesc,
            table: "CA_PrimaryFactors", matched: primSp.varies ? `${units} classes matched` : `Class ${perVehicle[0].primaryClass}`,
            note: vNote(primSp) || "No neutral row — every vehicle class is looked up." }),
          trace({ label: "Secondary Class Factor", value: secSp.varies ? secSp.max : secSp.value, kind: "x", varies: secSp.varies,
            driver: "Secondary Class (per unit)", input: secSp.varies ? `${units} units, mixed classes` : (perVehicle[0] && perVehicle[0].secondaryDesc),
            table: "CA_SecondaryFactors", matched: secSp.varies ? "mixed secondary classes" : (perVehicle[0] && perVehicle[0].secondaryDesc),
            base: VX.truckSecondaryFactor,
            note: vNote(secSp) || "The full 43-code table ranges 0.49x–2.35x by what the vehicle actually hauls. Not selected here, so the account default applies." }),
          trace({ label: "Fleet Size Factor", value: fleetSp.varies ? fleetSp.max : fleetSp.value, kind: "x", varies: fleetSp.varies,
            driver: "Number of rated power units", input: `${units} unit${units === 1 ? "" : "s"}`,
            table: "CA_Fleet_TTT", matched: `${units}-unit band, ${perVehicle[0] && find(VX.truckPrimary, p => p.code === perVehicle[0].primaryClass).fleetType} curve`,
            base: 1.00, note: vNote(fleetSp) || "Larger, more predictable fleets move along this curve — add or remove a vehicle and this changes." }),
          trace({ label: "Vehicle Age Factor", value: ageSp.varies ? ageSp.max : ageSp.value, kind: "x", varies: ageSp.varies,
            driver: "Model Year (per unit)", input: primSp.varies || ageSp.varies ? `${units} units` : `${perVehicle[0].vAge} yr old`,
            table: "CA_Age — TTT Liability", matched: ageSp.varies ? "mixed model years" : `${perVehicle[0].vAge} model years old`,
            base: 1.00, note: vNote(ageSp) }),
          trace({ label: "OCN Factor", value: ocnSp.varies ? ocnSp.max : ocnSp.value, kind: "x", varies: ocnSp.varies,
            driver: "Vehicle stated value (per unit)", input: ocnSp.varies ? `${units} units, mixed values` : "$" + Number(perVehicle[0].value).toLocaleString("en-US"),
            table: "CA_OCN_Liability", matched: ocnSp.varies ? "mixed value bands" : `value band containing $${Number(perVehicle[0].value).toLocaleString("en-US")}`,
            base: 1.00, note: vNote(ocnSp) || "Banded by the vehicle's stated value — raise a unit's value and it steps to the next band." }),
          trace({ label: "Liability Radius Factor", value: rad.liabilityFactor, kind: "x",
            driver: "Radius of Operation", input: radInput, table: "RadiusFctrs — Liability",
            matched: `${rad.category} · ${rad.label} (${rad.distance})`, base: 1.00,
            options: opts(VX.truckRadius.filter(r => r.liabilityFactor != null), r => `${r.label} — ${r.distance}`, r => r.liabilityFactor, r => r.label === rad.label),
            note: "Intermediate-300 is the 1.00 neutral row. Change Radius of Operation and a different row applies." }),
          trace({ label: "NAICS Industry Factor", value: naics.factor, kind: "x",
            driver: "Industry Classification (NAICS)", input: naics.code, table: "CA_NAICS_TTT",
            matched: `${naics.code} — ${naics.label}`, base: 1.00,
            options: opts(VX.truckNAICS, n => `${n.code} — ${n.label}`, n => n.factor, n => n.code === naics.code),
            note: "All five trucking NAICS codes on file currently carry 1.10 — no differentiation between them yet." }),
          trace({ label: "Tort Limitation Factor", value: tortFactor, kind: "x",
            driver: "Garaging State", input: st, table: "Helper_CovTypesOptions_Liab", matched: `${st} — standard tort`, base: 1.00,
            note: "1.00 in every state on file except New Jersey's tort-elimination election, which this UI does not expose." }),
          /* ---- factors reconciled against the production rater 2026-08-26 ----
             Each resolves from a request input; a request that omits the input
             gets the neutral row and the factor reports itself as not supplied,
             rather than quietly applying a default. */
          trace({ label: "Vehicle Ownership Factor", value: perVehicle[0].ownedFactor, kind: "x",
            varies: [...new Set(perVehicle.map(v => v.ownedFactor))].length > 1,
            driver: "Vehicle ownership", input: perVehicle[0].ownedLabel,
            table: "Vehicle Ownership", matched: perVehicle[0].ownedLabel, base: 1.00,
            options: opts(VX.truckOwnership, o => o.option, o => o.factor, o => o.option === perVehicle[0].ownedLabel),
            note: "Confirmed against a rated production payload: 0.95 for an owned unit. Neutral when the request does not state ownership." }),
          /* Pollution / Driver Criteria / Defense Cost Addback moved to the
             account-level factor breakdown (r.accountFactorLines /
             r.pdAccountFactorLines) — they are real, flat, account-level
             answers per the source, not per-vehicle factors, so they no
             longer have a per-vehicle trace here. */
          trace({ label: "Loss Experience Factor", value: lossExpRow.factor, kind: "x",
            driver: "Prior-term loss ratio", input: priorLR == null ? "no prior experience" : (priorLR * 100).toFixed(1) + "%",
            table: "Loss Experience", matched: lossExpRow.band, base: 1.00,
            options: opts(VX.truckLossExperience, o => o.band, o => o.factor, o => o.band === lossExpRow.band) }),
          trace({ label: "Payment Plan Factor", value: payRow.factor, kind: "x",
            driver: "Bill type", input: payRow.plan,
            table: "Payment Plan", matched: payRow.plan, base: 1.00,
            options: opts(VX.truckPaymentPlan, o => o.plan, o => o.factor, o => o.plan === payRow.plan) }),
          trace({ label: "UW Credit / Debit", value: uwFactor, kind: "x",
            driver: "Underwriter judgment", input: i.uwCreditDebit == null ? "not applied" : String(i.uwCreditDebit),
            table: "Program band", matched: `clamped to ${uwBand.min}–${uwBand.max}`, base: 1.00,
            note: "A judgment value, not a lookup. Clamped to the filed band." }),
          trace({ label: "Heavy Farm Factor", value: perVehicle[0].farmFactor, kind: "x",
            driver: "Vehicle use type", input: perVehicle[0].useLabel,
            table: "Heavy Use", matched: perVehicle[0].useLabel, base: 1.00 }),
          trace({ label: "Heavy Dumping Factor", value: perVehicle[0].dumpingFactor, kind: "x",
            driver: "Vehicle use type", input: perVehicle[0].useLabel,
            table: "Heavy Use", matched: perVehicle[0].useLabel, base: 1.00 }),
          trace({ label: "Miles Driven Factor", value: milesSp.varies ? milesSp.max : milesSp.value, kind: "x", varies: milesSp.varies,
            driver: "Annual Miles + Radius category", input: milesSp.varies ? `${units} units, mixed mileage` : Number(perVehicle[0].miles).toLocaleString("en-US") + " mi",
            table: "Table58 — Miles Driven", matched: `${rad.category} band`, base: 1.00,
            options: opts(VX.truckMiles.filter(m => m.radiusCategory === rad.category), m => m.label, m => m.factor,
              m => !milesSp.varies && +perVehicle[0].miles >= m.min && +perVehicle[0].miles <= m.max),
            note: vNote(milesSp) || "Keyed by BOTH mileage and radius category — the same mileage rates differently on a long-haul fleet." }),
          trace({ label: "Rating Class Factor", value: rc.factor, kind: "x",
            driver: "Cargo / Hauling Type", input: rc.ratingClass, table: "Table50 — Rating Class",
            matched: rc.ratingClass, base: 1.00,
            options: opts(VX.truckRatingClass, r => r.ratingClass, r => r.factor, r => r.ratingClass === rc.ratingClass),
            note: "What the fleet actually hauls. 29 operation types, 1.00 (Dry Van single trailer) is the neutral row." }),
          trace({ label: "Dashcam Factor", value: dash.factor, kind: "x",
            driver: "Dashcams Installed", input: dash.option, table: "Dashcams_Tbl", matched: dash.option, base: 1.00,
            options: opts(VX.truckDashcam, d => d.option, d => d.factor, d => d.option === dash.option),
            note: "No dashcams is a 1.20 debit — this is one of the few factors an insured can act on to lower their own premium." }),
          trace({ label: "CDL Experience Discount", value: cdlExpDiscFctr, kind: "x",
            driver: "Driver CDL experience (per driver)", input: `${topN.filter(d => d.qualified).length} of ${topN.length} rated drivers have 3+ yrs`,
            table: "Computed — Drivers!AF19", matched: `${Math.round(cdlQualifiedFrac * 100)}% qualified × 10% max discount`, base: 1.00,
            note: "Fleet-wide. Full 10% credit only if every rated driver has 3+ years CDL experience." }),
          trace({ label: "Driver Class Factor", value: driverClassFctr, kind: "x",
            driver: "Driver age, violations & accidents", input: `${drivers.length} driver${drivers.length === 1 ? "" : "s"}, ${surcharged} with violations`,
            table: "Computed — Drivers!AF20", matched: `average of best ${topN.length} driver${topN.length === 1 ? "" : "s"}${unassignedSlots ? ` + ${unassignedSlots} unassigned slot(s)` : ""}`,
            base: 1.00, note: "Ranks drivers best-to-worst, takes as many as there are rated units, and averages them." }),
          trace({ label: "Account-Level Factor (Auto Liability)", value: acct, kind: "x",
            driver: `${acctLines.length} underwriting questions`, input: acctLines.filter(([, v]) => v !== 0).map(([n, v]) => `${n} ${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`).join(", ") || "all neutral",
            table: "Computed — udf_get_factor_for_iso_new_rater", matched: `1 + ${acctRaw > acct || acctRaw < acct ? "sum, clamped to " + acctMin + "–" + acctMax : "sum of credits/debits"}`,
            base: 1.00, options: acctLines.map(([n, v]) => ({ label: n, value: v, active: v !== 0 })),
            note: (acctRaw !== acct ? `Raw total was ${acctRaw}× — clamped to the ${acctMin}–${acctMax} program band. ` : `Sum of the ${acctLines.length} credit/debit answers, then clamped to the program band. `)
              + "Liability's own account factor — Physical Damage computes a separate one (see its own group)." }),
          trace({ label: "Experience Mod", value: experienceMod, kind: "x",
            driver: "Loss history (3yr claims & incurred)", input: `${priorClaims} claim${priorClaims === 1 ? "" : "s"} > $500, $${priorIncurred.toLocaleString("en-US")} incurred`,
            table: "Computed — ExperienceRatingMod_ALT1!W7", matched: `credibility-weighted, ${units} units × ${expMonths} mo`,
            base: 1.00, note: "Applied to the summed coverage premium, not per vehicle. Credit capped at 10%; a bad history can debit without limit." }),
          trace({ label: "Rated Power Units", value: units, kind: "num",
            driver: "Vehicle Schedule", input: `${units} unit${units === 1 ? "" : "s"}`, matched: "count of vehicles on the schedule",
            note: "Each unit is rated separately and then summed — this is the multiplier on the whole chain above." }),
        ]});
    }
    if (cob.includes("Physical Damage")) {
      const milesSp = vSpread(v => v.milesFactor), trlSp = vSpread(v => v.trailerFactor);
      const tiv = perVehicle.reduce((s, v) => s + v.tiv, 0);
      const apdRateSp = vSpread(v => ([...VX.truckPhysDamRate].reverse().find(([val]) => (+v.value || 0) >= val) || VX.truckPhysDamRate[0])[1]);
      groups.push({ name: "Physical Damage", icon: "fa-car-burst", color: "var(--cat-2)", subtotal: apdTotal,
        ratedBy: (perVehicle[0] || {}).apdRatedBy,
        factors: [
          trace({ label: "Total Insured Value (units + trailers)", value: tiv, kind: "money",
            driver: "Vehicle & trailer stated values", input: `${units} unit${units === 1 ? "" : "s"}`,
            matched: "sum of every unit's stated value plus its trailer",
            note: "Physical Damage rates off value, not a territory loss cost — this is the base the rate below applies to." }),
          trace({ label: "APD Rate (per $ of value)", value: apdRateSp.varies ? apdRateSp.max : apdRateSp.value, kind: "num", varies: apdRateSp.varies,
            driver: "Vehicle stated value (per unit)", input: apdRateSp.varies ? `${units} units, mixed values` : "$" + Number(perVehicle[0].value).toLocaleString("en-US"),
            table: "PhysDamRatesByTIV", matched: apdRateSp.varies ? "mixed value bands" : `value band containing $${Number(perVehicle[0].value).toLocaleString("en-US")}`,
            base: minRate, note: vNote(apdRateSp) || `Declines as value rises, flooring at the ${minRate} program minimum around $155K.` }),
          trace({ label: "APD Deductible Factor", value: apdDed.factor, kind: "x",
            driver: "Physical Damage Deductible", input: "$" + Number(apdDed.amount).toLocaleString("en-US"),
            table: "DeductFctr_ALT", matched: `$${Number(apdDed.amount).toLocaleString("en-US")} deductible`, base: 1.00,
            options: opts(VX.truckApdDed, d => "$" + d.amount.toLocaleString("en-US"), d => d.factor, d => d.amount === apdDed.amount),
            note: "$1,000 is the 1.00 neutral row — every higher deductible is a credit." }),
          trace({ label: "APD Radius Factor", value: rad.apdFactor, kind: "x",
            driver: "Radius of Operation", input: radInput, table: "RadiusFctrs — APD",
            matched: `${rad.category} · ${rad.label} (${rad.distance})`, base: 1.00,
            options: opts(VX.truckRadius.filter(r => r.apdFactor != null), r => `${r.label} — ${r.distance}`, r => r.apdFactor, r => r.label === rad.label),
            note: "Same radius answer as Liability, but a different column — APD is less radius-sensitive than Liability." }),
          trace({ label: "Trailer PhysDam Factor", value: trlSp.varies ? trlSp.max : trlSp.value, kind: "x", varies: trlSp.varies,
            driver: "Trailer Type (per unit)", input: trlSp.varies ? `${units} units, mixed trailers` : perVehicle[0].trailer,
            table: "TrailerTypes", matched: trlSp.varies ? "mixed trailer types" : perVehicle[0].trailer, base: 1.00,
            note: vNote(trlSp) || "The real table has only two buckets — Reefer (0.95) and All Other (0.90)." }),
          trace({ label: "APD State Factor", value: apdStateFactor, kind: "x",
            driver: "Garaging State", input: st, table: "Table9 — APD State", matched: `${st}`, base: 1.00,
            note: "0.95 in every state except California, which is 1.00." }),
          trace({ label: "APD Package Factor", value: apdPackageFactor, kind: "x",
            driver: "Coverages selected", input: cob.includes("Auto Liability") ? "Liability + Physical Damage" : "Physical Damage only",
            table: "Table11 — APD Package", matched: cob.includes("Auto Liability") ? "Package policy — Yes" : "Package policy — No", base: 1.00,
            note: "A 10% credit for writing Liability and Physical Damage together. Deselect Auto Liability and this reverts to 1.00." }),
          trace({ label: "Miles Driven Factor", value: milesSp.varies ? milesSp.max : milesSp.value, kind: "x", varies: milesSp.varies,
            driver: "Annual Miles + Radius category", input: milesSp.varies ? `${units} units, mixed mileage` : Number(perVehicle[0].miles).toLocaleString("en-US") + " mi",
            table: "Table58 — Miles Driven", matched: `${rad.category} band`, base: 1.00, note: vNote(milesSp) }),
          trace({ label: "Rating Class Factor", value: rc.factor, kind: "x",
            driver: "Cargo / Hauling Type", input: rc.ratingClass, table: "Table50 — Rating Class", matched: rc.ratingClass, base: 1.00,
            options: opts(VX.truckRatingClass, r => r.ratingClass, r => r.factor, r => r.ratingClass === rc.ratingClass) }),
          trace({ label: "Dashcam Factor", value: dash.factor, kind: "x",
            driver: "Dashcams Installed", input: dash.option, table: "Dashcams_Tbl", matched: dash.option, base: 1.00,
            options: opts(VX.truckDashcam, d => d.option, d => d.factor, d => d.option === dash.option) }),
          /* Physical Damage's OWN account-level factor — previously missing
             from this trace list entirely even though it was already being
             multiplied into the chain above; now both present and correct
             (see engine.js's split of __ACCOUNT__ / __ACCOUNT_PD__ near the
             top of this function). */
          trace({ label: "Account-Level Factor (Physical Damage)", value: pdAcct, kind: "x",
            driver: `${pdAcctLines.length} underwriting questions`, input: pdAcctLines.filter(([, v]) => v !== 0).map(([n, v]) => `${n} ${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`).join(", ") || "all neutral",
            table: "Computed — udf_get_factor_for_iso_new_rater", matched: `1 + ${pdAcctRaw > pdAcct || pdAcctRaw < pdAcct ? "sum, clamped to " + acctMin + "–" + acctMax : "sum of credits/debits"}`,
            base: 1.00, options: pdAcctLines.map(([n, v]) => ({ label: n, value: v, active: v !== 0 })),
            note: (pdAcctRaw !== pdAcct ? `Raw total was ${pdAcctRaw}× — clamped to the ${acctMin}–${acctMax} program band. ` : `Sum of the ${pdAcctLines.length} credit/debit answers, then clamped to the program band. `)
              + "Computed separately from Liability's — it does not carry Broadened Pollution or Defense Cost Addback, both Liability-only in the source." }),
          trace({ label: "Experience Mod", value: experienceMod, kind: "x",
            driver: "Loss history (3yr claims & incurred)", input: `${priorClaims} claim${priorClaims === 1 ? "" : "s"} > $500, $${priorIncurred.toLocaleString("en-US")} incurred`,
            table: "Computed — ExperienceRatingMod_ALT1!W7", matched: "same mod as Auto Liability", base: 1.00 }),
        ]});
    }
    let cargoBreakdown = null;
    if (cob.includes("Cargo")) {
      /* Real schema (ams-service iso_new_rater_cargo_commodity_classification_master
         / iso_new_rater_cargo_classification_factor), representative factor
         values — see the note in data.js. A cargo quote can haul more than
         one commodity (Commodities Hauled schedule); the ISO rule this
         mirrors (udf_iso_new_rater_highest_classification_factor) rates the
         WHOLE policy off the highest (worst) classification factor among
         the commodities actually selected — mixing in one risky commodity
         loads the entire cargo charge, not just its own share. */
      const selected = (i.cargoCommodities && i.cargoCommodities.length)
        ? i.cargoCommodities : [{ code: (VX.truckCargoCommodities[0] || {}).code, loadPct: 100 }];
      const baseRate = +i.cargoBaseRate || 1000;
      const loadFactor = +i.cargoBasicLoad || 1.2; // "Basic Load" — same figure, two names, per the production Underwriting screen
      const loadCharge = +(baseRate * loadFactor).toFixed(2);

      const rows = selected.map(sel => {
        const commodity = find(VX.truckCargoCommodities, c => c.code === sel.code, VX.truckCargoCommodities[0]);
        const excluded = !!commodity.excluded;
        const clsFactor = excluded ? 0 : VX.cargoClassificationFactorFor(st, commodity.classificationNumber);
        const hazFactor = (!excluded && commodity.hazardousMod) ? 1.15 : 1.0;
        const totalBasicCharge = excluded ? 0 : +(loadCharge * clsFactor * hazFactor).toFixed(2);
        return { commodity, loadPct: +sel.loadPct || 100, excluded, clsFactor, hazFactor, totalBasicCharge };
      });
      const ratable = rows.filter(r => !r.excluded);
      // Rates off the single highest classification factor on file, per the real rule.
      const worst = ratable.length ? ratable.reduce((a, b) => (b.clsFactor > a.clsFactor ? b : a)) : null;
      const classificationFactor = worst ? worst.clsFactor : 0;
      const hazardousModFactor = worst ? worst.hazFactor : 1.0;
      const totalBasicCharge = +(loadCharge * classificationFactor * hazardousModFactor).toFixed(2);
      const LOSS_RATIO_CONST = 0.70; // representative — reproduces the production screenshot's own Loss Cost Factor exactly (1140 × 0.70 / 1000 = 0.798) off its own Total Basic Charge
      const lossCostFactor = +(totalBasicCharge * LOSS_RATIO_CONST / 1000).toFixed(3);
      const anyExcludedOnly = ratable.length === 0;

      const cargoDefault = anyExcludedOnly ? 0 : (+i.cargoLimit / 100) * lossCostFactor * rad.apdFactor;
      const cargoR = anyExcludedOnly ? { value: 0, ratedBy: null } : applySavedFormula("Commercial Trucking", "Motor Truck Cargo", {
        CargoLimit: +i.cargoLimit, CargoLossCostFactor: lossCostFactor, CargoRadiusFactor: rad.apdFactor,
      }, cargoDefault);
      const cargo = Math.round(cargoR.value);
      cargoBreakdown = { rows, baseRate, loadFactor, loadCharge, classificationFactor, hazardousModFactor, totalBasicCharge, lossCostFactor };

      groups.push({ name: "Cargo", icon: "fa-box", color: "var(--cat-4)", subtotal: cargo, ratedBy: cargoR.ratedBy,
        factors: [
          trace({ label: "Base Rate", value: baseRate, kind: "money",
            driver: "Underwriter Basic Load entry", input: "$" + baseRate.toLocaleString("en-US"), matched: "Underwriting — Base Rate", base: 1000,
            note: "Underwriter-entered starting rate, matches the production Underwriting screen's Cargo column." }),
          trace({ label: "Load Factor (\"Basic Load\")", value: loadFactor, kind: "x",
            driver: "Underwriter Basic Load entry", input: loadFactor, matched: "Underwriting — Basic Load", base: 1.2,
            note: "Same figure shown as \"Basic Load\" on the Underwriting tab and \"Load Factor\" here — one input, two labels." }),
          trace({ label: "Cargo Classification Factor", value: classificationFactor, kind: "x",
            driver: "Commodities Hauled (highest on file)", input: worst ? worst.commodity.label : "none ratable",
            table: "iso_new_rater_cargo_classification_factor", matched: worst ? `Class ${worst.commodity.classificationNumber}, ${st}` : "—", base: 1.00,
            note: "Rates off the single highest (worst) classification factor among every selected, coverable commodity — matches the ISO rule this mirrors." }),
          trace({ label: "Hazardous Mod Factor", value: hazardousModFactor, kind: "x",
            driver: "Commodities Hauled", input: worst && worst.commodity.hazardousMod ? "Hazard-loaded commodity selected" : "None hazard-loaded",
            matched: hazardousModFactor > 1 ? "Hazard load applied" : "Neutral", base: 1.00 }),
          trace({ label: "Total Basic Charge", value: totalBasicCharge, kind: "money",
            driver: null, input: null, matched: "Load Charge × Classification Factor × Hazardous Mod Factor" }),
          trace({ label: "Loss Cost Factor", value: lossCostFactor, kind: "num",
            driver: null, input: null, matched: `Total Basic Charge × ${LOSS_RATIO_CONST} program loss ratio ÷ $1,000`, base: 0,
            note: "The 0.70 loss-ratio constant is representative, not filed — same disclosure as every other non-sourced value in this program." }),
          trace({ label: "Cargo Limit / $100", value: +i.cargoLimit / 100, kind: "num",
            driver: "Cargo Limit", input: "$" + Number(i.cargoLimit || 0).toLocaleString("en-US"), matched: "limit ÷ 100" }),
          trace({ label: "Cargo Radius Factor", value: rad.apdFactor, kind: "x",
            driver: "Radius of Operation", input: radInput,
            matched: `${rad.category} · ${rad.label}`, base: 1.00,
            note: "Borrows the same radius answer as Physical Damage — Cargo has no radius table of its own." }),
          ...(anyExcludedOnly ? [trace({ label: "Coverage Status", value: 0, kind: "num",
            driver: "Commodities Hauled", input: "All selected commodities excluded", matched: "EXCLUDED — no coverage",
            note: "Cargo premium is $0 because every selected commodity is excluded, not a discount — it is not covered." })] : []),
        ]});
    }

    /* ---------------- Garagekeepers' Insurance ----------------
       CommonCoverages!U38:AB38 (and every repeated row 41, 44, ... in the
       schedule). Verified 2026-08-19 against the workbook, sourced from the
       full 1,620-row GKL_LossCosts table plus GKL_Comp, GKL_CovOptions,
       OnHook_Fctr_*, SoundEq_Fctr_* and the two Garagekeepers program
       deviations (ProgramDeviations — both 1.20).

       Each schedule row picks ONE coverage option (Legal Liability / Direct
       Primary / Direct Excess / On-Hook endorsement / Sound-Receiving-
       Equipment endorsement) at one state + limit, with independent
       Collision and Comprehensive selections:
         row premium = COLL_component + COMP_component
         COLL_component = Deviation_COLL x lossCost x kindFactor.coll x LCM   (0 if no Collision)
         COMP_component = Deviation_COMP x lossCost x kindFactor.comp x dedFactor x LCM  (0 if no Comprehensive)
       This is a genuinely separate coverage from Auto Liability / Physical
       Damage — it insures customer vehicles in the insured's care, custody
       and control, not the insured's own fleet. */
    // The coverage tree offers "Garagekeepers Legal Liability" as its selectable
    // name (VX.cob id 15) — any selection starting with "Garagekeepers" counts.
    if (cob.some(c => c.startsWith("Garagekeepers")) && FULL && i.gkl && i.gkl.length) {
      const gklFactors = [];
      let gklTotal = 0;
      i.gkl.forEach((row, idx) => {
        const opt = find(FULL.gklCoverageOptions, o => o[0] === row.coverage, FULL.gklCoverageOptions[0]);
        const [, lcColumn, kind] = opt;
        const lc = FULL.gklLossCostFor(row.state, lcColumn, +row.limit);
        if (!lc) return; // no rate on file for this state/limit combination
        const kindFactor = kind === "excess" ? { coll: 1.15, comp: 1.15 }
          : kind === "onhook" ? { coll: FULL.gklOnHook.collision, comp: FULL.gklOnHook.comprehensive }
          : kind === "soundequip" ? { coll: FULL.gklSoundEquip.collision, comp: FULL.gklSoundEquip.comprehensive }
          : { coll: 1.0, comp: 1.0 };
        const collDedCol = row.collDed === "Yes - $100 Deductible" ? "c100"
          : row.collDed === "Yes - $250 Deductible" ? "c250"
          : row.collDed === "Yes - $500 Deductible" ? "c500" : null;
        const collPrem = collDedCol
          ? Math.round(FULL.gklDeviation.collision * lc[collDedCol] * kindFactor.coll * lcm) : 0;
        const compDedRow = find(FULL.gklCompDed, d => d[0] === row.compDed, FULL.gklCompDed[0]);
        const compPrem = (row.compDed && row.compDed !== "No")
          ? Math.round(FULL.gklDeviation.comprehensive * lc.comp * kindFactor.comp * compDedRow[1] * lcm) : 0;
        gklTotal += collPrem + compPrem;
        gklFactors.push(trace({ label: `Location ${idx + 1} — ${opt[0]}`, value: collPrem + compPrem, kind: "money",
          driver: "Coverage, State, Limit & Deductibles", input: `${row.state}, $${Number(row.limit).toLocaleString("en-US")} limit`,
          table: "GKL_LossCosts", matched: `${lcColumn} @ $${Number(row.limit).toLocaleString("en-US")}`,
          note: `Collision $${collPrem.toLocaleString("en-US")} (${row.collDed || "not selected"}) + Comprehensive $${compPrem.toLocaleString("en-US")} (${row.compDed || "not selected"}).` }));
      });
      if (gklFactors.length) groups.push({ name: "Garagekeepers' Insurance", icon: "fa-warehouse", color: "var(--cat-5)",
        subtotal: gklTotal, factors: gklFactors });
    }

    const r = assemble("Commercial Trucking", groups, 1, stTax, st, {
      minRule: 2500, acctLabel: "Account-Level Factor (already applied per-vehicle)",
      version: "v2026.03",
      formula: "Per vehicle: Base LC × (ILF − Ded) × LCM × Primary × Secondary × Fleet × Age × OCN × Radius × NAICS × Tort × Miles × RatingClass × Dashcam × CDL × DriverClass × Account  →  summed × Experience Mod",
      units, drivers: drivers.length, surchargedDrivers: surcharged, driverFactor: 1,
      input: i,
    });
    r.perVehicle = perVehicle;
    r.perDriver = rated;
    r.accountFactor = acct;
    r.accountFactorLines = acctLines;
    r.accountFactorRatedBy = acctRatedBy;
    // Physical Damage's own, separately-computed account-level factor — see
    // the split of __ACCOUNT__ / __ACCOUNT_PD__ near the top of this function.
    r.pdAccountFactor = pdAcct;
    r.pdAccountFactorLines = pdAcctLines;
    r.pdAccountFactorRatedBy = pdAcctRatedBy;
    r.experienceMod = experienceMod;
    r.driverClassFctr = driverClassFctr;
    r.cdlExpDiscFctr = cdlExpDiscFctr;
    r.cargoBreakdown = cargoBreakdown;

    /* ---- Loss ratio (5yr adds on top of the same 3yr inputs the Loss
       History card already captures — a longer, noisier window computed
       from the same claim count/incurred figures rather than a second set
       of inputs the UI doesn't have anywhere to put) ---- */
    r.lossRatio = lossRatio;
    r.lossRatio3yr = lossRatio;
    r.lossRatio5yr = expMonths >= 60 ? lossRatio : (earnedCarYears ? priorIncurred / (bookPremiumProxy * (units * (60 / 12))) : 0);
    r.priorClaims = priorClaims;
    r.priorIncurred = priorIncurred;

    /* ---- Driver licence-state distribution + factor summary — real counts
       off the same driver schedule the Account-Level Factor already reads,
       not new data. "Risk State" = the quote's own garaging state. */
    const riskSt = st;
    r.driverStateDistribution = {
      riskState: drivers.filter(d => (d.licState || "").toUpperCase() === riskSt).length,
      ny: drivers.filter(d => (d.licState || "").toUpperCase() === "NY" && riskSt !== "NY").length,
      fl: drivers.filter(d => (d.licState || "").toUpperCase() === "FL" && riskSt !== "FL").length,
      other: drivers.filter(d => { const s = (d.licState || "").toUpperCase(); return s && s !== riskSt && s !== "NY" && s !== "FL" && s !== "FOREIGN"; }).length,
      excluded: drivers.filter(d => (d.licState || "").toUpperCase() === "FOREIGN").length,
    };
    r.driverFactorAvg = rated.length ? +(rated.reduce((s, d) => s + d.classFactor, 0) / rated.length).toFixed(3) : null;
    r.driverFactorApplied = driverClassFctr;

    /* ---- Vehicle Type rollup — buckets perVehicle[] by the same weight
       class the workbook's own PrimaryClasses table encodes in its code
       ranges (011-033 Light, 211-232 Medium, 311-332 Heavy, 341-402
       Extra-Heavy, "Tractor" desc = truck-tractor codes, 671/672 Semi
       Trailers); N/O (non-owned) Trailers comes from each vehicle's own
       trailer selection, a separate dimension from primary class. */
    const vehicleBucket = v => {
      const code = v.primaryClass || "";
      const desc = (v.primDesc || "").toLowerCase();
      if (v.trailer && v.trailer !== "None — Power Unit Only" && desc.includes("trailer")) return "Semi Trailers";
      if (desc.includes("tractor")) return "Tractor";
      if (/^0/.test(code)) return "Light Truck";
      if (/^2/.test(code)) return "Medium Truck";
      if (/^3/.test(code)) return "Heavy Truck";
      if (/^(4|5)/.test(code)) return "Extra Heavy Truck";
      if (/^6/.test(code)) return "Semi Trailers";
      return "Other";
    };
    const vtRoll = {};
    perVehicle.forEach(v => {
      const b = vehicleBucket(v);
      if (!vtRoll[b]) vtRoll[b] = { units: 0, premium: 0 };
      vtRoll[b].units += v.qty;
      vtRoll[b].premium += v.total;
    });
    const noTrailerUnits = perVehicle.filter(v => v.trailer && !v.trailer.startsWith("None") && !(v.primDesc || "").toLowerCase().includes("trailer")).length;
    if (noTrailerUnits) vtRoll["N/O Trailers"] = { units: noTrailerUnits, premium: 0 };
    r.vehicleTypeRollup = Object.entries(vtRoll).map(([type, v]) => ({ type, units: v.units, premium: v.premium, ppu: v.units ? Math.round(v.premium / v.units) : 0 }));

    return r;
  }
  function truckingModelA(i) {
    const st = i.state || "TX";
    const vehicles = (i.vehicles && i.vehicles.length) ? i.vehicles
      : [{ n: 1, desc: "Unit 1", primaryClass: "321" }];
    const drivers = (i.drivers && i.drivers.length) ? i.drivers
      : [{ n: 1, name: "Driver 1", cdlYears: 8 }];
    const units = vehicles.reduce((s, v) => s + Math.max(1, +v.units || 1), 0);
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;

    const avgCdl = drivers.length ? drivers.reduce((a, d) => a + (+d.cdlYears || 0), 0) / drivers.length : 5;
    const drvExpBand = avgCdl < 2 ? "Under 2 years CDL" : avgCdl < 5 ? "2–5 years CDL" : avgCdl < 10 ? "5–10 years CDL" : "10+ years CDL";
    const drvExpRow = find(VX.modelADriverExperience, r => r.band === drvExpBand, VX.modelADriverExperience[1]);
    const safetyRow = find(VX.modelASafetyRating, r => r.rating === (i.carrierSafetyRating || "Satisfactory"), VX.modelASafetyRating[0]);
    const radiusRow = find(VX.modelARadius, r => r.key === (i.radiusClass || "48_states"), VX.modelARadius[3]);
    const fleetRow = find(VX.modelAFleetDiscount, r => units >= r.min && units <= r.max, VX.modelAFleetDiscount[1]);
    const baseRate = VX.modelAConstants.baseRate;

    /* Underwriter judgment, layered on top of the classification chain —
       real quote-portal.html input (uwCreditDebit), clamped to the same
       filed band the removed real formula used (VX.truckUwCreditDebit).
       Applied once to the whole model premium via assemble()'s own acct
       multiplier slot, not per vehicle. */
    const uwBand = VX.truckUwCreditDebit || { min: 0.75, max: 1.25, neutral: 1 };
    const uwRaw = i.uwCreditDebit == null ? uwBand.neutral : +i.uwCreditDebit;
    const uwFactor = Math.min(uwBand.max, Math.max(uwBand.min, isNaN(uwRaw) ? uwBand.neutral : uwRaw));

    const perVehicleFactors = [];
    let subtotal = 0;
    vehicles.forEach(v => {
      const qty = Math.max(1, +v.units || 1);
      const clsRow = find(VX.modelAVehicleClass, r => r.code === v.primaryClass, VX.modelAVehicleClass[2]);
      const unitPremium = Math.round(baseRate * clsRow.factor * radiusRow.factor * drvExpRow.factor * safetyRow.factor * fleetRow.factor);
      subtotal += unitPremium * qty;
      perVehicleFactors.push(trace({
        label: `Unit ${v.n}${v.desc ? " — " + v.desc : ""} (${clsRow.code} — ${clsRow.desc})`,
        value: unitPremium * qty, kind: "money", driver: "Vehicle Class", input: v.primaryClass,
        matched: clsRow.desc, table: "Model A — Vehicle Class (candidate)",
        note: qty > 1 ? `${qty} units at $${unitPremium.toLocaleString("en-US")} each` : null,
      }));
    });

    const groups = [{
      name: "Model A — Classification Rating", icon: "fa-truck", color: "var(--cat-1)",
      subtotal, factors: [
        trace({ label: "Base Rate", value: baseRate, kind: "money", table: "Model A — candidate constant",
          note: "Illustrative starting rate per power unit — not filed." }),
        trace({ label: "Radius of Operation Factor", value: radiusRow.factor, kind: "x",
          driver: "Radius of Operation", input: i.radiusClass || "48_states", matched: radiusRow.label, base: 1.00,
          table: "Model A — Radius (candidate)" }),
        trace({ label: "Driver Experience Factor", value: drvExpRow.factor, kind: "x",
          driver: "Avg. CDL Experience across drivers", input: avgCdl.toFixed(1) + " yrs", matched: drvExpRow.band, base: 1.00,
          table: "Model A — Driver Experience (candidate)" }),
        trace({ label: "Safety Rating Factor", value: safetyRow.factor, kind: "x",
          driver: "FMCSA Carrier Safety Rating", input: i.carrierSafetyRating || "Satisfactory", matched: safetyRow.rating, base: 0.92,
          table: "Model A — Safety Rating (candidate)" }),
        trace({ label: "Fleet Size Discount Factor", value: fleetRow.factor, kind: "x",
          driver: "Rated power units", input: String(units), matched: `${fleetRow.min}–${fleetRow.max === 999999 ? "50+" : fleetRow.max} units`, base: 1.00,
          table: "Model A — Fleet Discount (candidate)" }),
        ...perVehicleFactors,
      ],
    }];

    const r = assemble("Commercial Trucking", groups, uwFactor, stTax, st, {
      minRule: 2000, acctLabel: "Underwriter Credit / Debit",
      version: "Model A (candidate — not filed)",
      formula: "Per vehicle: Base Rate × Vehicle Class Factor × Radius Factor × Driver Experience Factor × Safety Rating Factor × Fleet Discount Factor — summed across the fleet, then × Underwriter Credit/Debit",
      units, drivers: drivers.length, surchargedDrivers: 0, driverFactor: 1, input: i,
    });
    r.modelId = "A";
    r.modelName = "Classification (Manual) Rating";
    return r;
  }

  function truckingModelB(i) {
    const st = i.state || "TX";
    const vehicles = (i.vehicles && i.vehicles.length) ? i.vehicles
      : [{ n: 1, desc: "Unit 1", primaryClass: "321", miles: 65000 }];
    const drivers = (i.drivers && i.drivers.length) ? i.drivers
      : [{ n: 1, name: "Driver 1", violations: 0 }];
    const units = vehicles.reduce((s, v) => s + Math.max(1, +v.units || 1), 0);
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;

    const totalMiles = vehicles.reduce((s, v) => s + Math.max(1, +v.units || 1) * (+v.miles || 65000), 0);
    const territoryRel = VX.modelBTerritory[st] != null ? VX.modelBTerritory[st] : VX.modelBTerritory.DEFAULT;
    const totalViolations = drivers.reduce((a, d) => a + (+d.violations || 0), 0);
    const avgViolations = drivers.length ? totalViolations / drivers.length : 0;
    /* Composite risk score: safety rating (0/2/5/8 points) + average driver
       violations, banded — additive, not multiplicative, matching this
       model's own structure. */
    const safetyPts = { "Satisfactory": 0, "None": 2, "Conditional": 5, "Unsatisfactory": 8 }[i.carrierSafetyRating || "Satisfactory"] ?? 2;
    const compositeScore = safetyPts + avgViolations;
    const riskRow = find(VX.modelBRiskScore, r => compositeScore <= r.max, VX.modelBRiskScore[VX.modelBRiskScore.length - 1]);

    const C = VX.modelBConstants;
    const mileagePremium = Math.round(totalMiles * C.lossCostPerMile * territoryRel);
    const riskLoad = Math.round(mileagePremium * (riskRow.factor - 1));
    const unitExposureCharge = Math.round(C.perUnitExposureCharge * units);
    const subtotal = mileagePremium + riskLoad + unitExposureCharge + C.fixedExpenseLoad;

    /* Same real underwriter judgment input as Model A, same filed clamp
       band — layered on top of this model's own exposure-based subtotal via
       assemble()'s acct multiplier, same mechanism as Model A. */
    const uwBand = VX.truckUwCreditDebit || { min: 0.75, max: 1.25, neutral: 1 };
    const uwRaw = i.uwCreditDebit == null ? uwBand.neutral : +i.uwCreditDebit;
    const uwFactor = Math.min(uwBand.max, Math.max(uwBand.min, isNaN(uwRaw) ? uwBand.neutral : uwRaw));

    const groups = [{
      name: "Model B — Exposure-Based Rating", icon: "fa-road", color: "var(--cat-3)",
      subtotal, factors: [
        trace({ label: "Mileage Premium", value: mileagePremium, kind: "money",
          driver: "Total Annual Fleet Miles", input: totalMiles.toLocaleString("en-US") + " mi",
          matched: `${totalMiles.toLocaleString("en-US")} mi × $${C.lossCostPerMile}/mi × ${territoryRel}× territory`,
          table: "Model B — Loss Cost Per Mile × Territory (candidate)" }),
        trace({ label: "Territory Relativity", value: territoryRel, kind: "x",
          driver: "Garaging State", input: st, matched: st, base: 1.00,
          table: "Model B — Territory (candidate)" }),
        trace({ label: "Risk Score Load", value: riskLoad, kind: "money",
          driver: "Safety Rating + Avg. Driver Violations", input: `score ${compositeScore.toFixed(1)}`,
          matched: riskRow.band, table: "Model B — Risk Score (candidate)",
          note: `${riskRow.factor}× applied to the mileage premium (composite score: ${safetyPts} safety pts + ${avgViolations.toFixed(1)} avg violations).` }),
        trace({ label: "Per-Unit Exposure Charge", value: unitExposureCharge, kind: "money",
          driver: "Rated power units", input: String(units), matched: `$${C.perUnitExposureCharge}/unit × ${units}`,
          table: "Model B — Exposure Charge (candidate)" }),
        trace({ label: "Fixed Expense Load", value: C.fixedExpenseLoad, kind: "money",
          table: "Model B — candidate constant", note: "Flat per-policy expense load — not filed." }),
      ],
    }];

    const r = assemble("Commercial Trucking", groups, uwFactor, stTax, st, {
      minRule: 2000, acctLabel: "Underwriter Credit / Debit",
      version: "Model B (candidate — not filed)",
      formula: "[(Total Fleet Miles × Loss Cost Per Mile × Territory Relativity) + Risk Score Load + (Per-Unit Exposure Charge × Units) + Fixed Expense Load] × Underwriter Credit/Debit",
      units, drivers: drivers.length, surchargedDrivers: 0, driverFactor: 1, input: i,
    });
    r.modelId = "B";
    r.modelName = "Exposure-Based (Mileage/Usage) Rating";
    return r;
  }


  /* The real formula is primary — its own output is what every page reads
     at the top level (r.finalPremium, r.groups, r.perVehicle,
     r.accountFactorLines, r.cargoBreakdown, ...), exactly as before this
     was ever touched. Model A / Model B are computed alongside it purely
     for comparison and attached as r.modelA / r.modelB — additive, not a
     replacement, for pages built during the comparison exercise (Quote
     Portal's Premium tab, Quote JSON's factor tabs) that want to show them. */
  function trucking(i) {
    const real = truckingReal(i);
    const modelA = truckingModelA(i);
    const modelB = truckingModelB(i);
    real.modelA = modelA;
    real.modelB = modelB;
    real.modelDiffPctA = real.finalPremium ? ((modelA.finalPremium - real.finalPremium) / real.finalPremium) * 100 : null;
    real.modelDiffPctB = real.finalPremium ? ((modelB.finalPremium - real.finalPremium) / real.finalPremium) * 100 : null;
    // Kept for compatibility with the comparison UI built while the real
    // formula was removed — that UI compares A directly against B.
    real.modelDiffPct = modelA.finalPremium ? ((modelB.finalPremium - modelA.finalPremium) / modelA.finalPremium) * 100 : null;
    return real;
  }


  /* ---------------- Professional Liability (MPL) — formula verified against workbook ---------------- */
  function mpl(i) {
    const lcm = VX.programParams.find(p => p.param === "LCM Factor").value;      // 1.538
    const minP = VX.programParams.find(p => p.param === "Minimum Premium").value; // 750
    const hg = find(VX.mplHazardGroups, h => h.hg == i.hazardGroup);
    const ilfRow = find(VX.mplILF, l => l.limit == i.limit);
    const ret = find(VX.mplRetention, r => r.retention == i.retention);
    const yip = find(VX.mplYIP, y => y.yip === i.yip);
    const alae = find(VX.mplALAE, a => a.treatment === i.alae);
    const adjILF = +(ilfRow.ilf * (1 - ret.factor)).toFixed(3);
    const baseLC = Math.round((+i.revenue / 1000) * 6.78);
    const expF = +i.experienceFactor || 0.9;
    const stMod = 1.0;
    const uwMod = Math.max(0.75, 1 + (+i.uwAdjust || 0));
    const st = i.state || "TX";
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;

    const f = [
      ["Basic Limit Loss Cost", baseLC, "money"], ["Loss Cost Multiplier", lcm, "x"],
      ["ILF (Adjusted for Retention)", adjILF, "x"], [`Hazard Group ${hg.hg} — ${hg.desc}`, hg.factor, "x"],
      ["Defense Cost (ALAE) Factor", alae.factor, "x"], ["Claims-Made / Year-In-Program", yip.factor, "x"],
      ["Loss Experience Factor", expF, "x"], ["State Modification Factor", stMod, "x"],
      ["Underwriter Mod Factor", uwMod, "x"],
    ];
    const premDefault = Math.round(baseLC * lcm * adjILF * hg.factor * alae.factor * yip.factor * expF * stMod * uwMod);
    const premR = applySavedFormula("Professional Liability (MPL)", "Professional Liability", {
      BasicLimitLossCost: baseLC, LCM: lcm, AdjILF: adjILF, HazardGroupFactor: hg.factor, ALAEFactor: alae.factor,
      ClaimsMadeFactor: yip.factor, LossExperienceFactor: expF, StateModFactor: stMod, UWModFactor: uwMod,
    }, premDefault);
    const prem = Math.round(premR.value);
    const groups = [{ name: "Professional Liability", icon: "fa-user-tie", color: "var(--cat-4)", factors: f, subtotal: prem, ratedBy: premR.ratedBy }];
    return assemble("Professional Liability (MPL)", groups, 1, stTax, st, {
      minRule: minP, acctLabel: "Account Modification", version: "v2024.12",
      formula: "Basic Limit LC × LCM × Adj ILF × Hazard Grp × ALAE × Claims-Made × Loss Exp × State × UW Mod",
      input: i,
    });
  }

  /* ---------------- Commercial Property ---------------- */
  function property(i) {
    const con = find(VX.propConstruction, c => c.code === i.construction);
    const ppc = find(VX.propPPC, p => p.ppc == i.ppc);
    const occ = find(VX.propOccupancy, o => o.code === i.occupancy);
    const wh = find(VX.propWindHail, w => w.code === i.windHail);
    const ded = find(VX.propDed, d => d.amount == i.deductible);
    const lcm = VX.programParams.find(p => p.param === "LCM" && p.lob === "Commercial Property").value;
    const tiv = (+i.buildingValue || 0) + (+i.bppValue || 0);
    const st = i.state || "TX";
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;
    const irpm = 1 + (+i.irpm || 0);

    const base = (tiv / 100) * 0.42;
    const f = [
      trace({ label: "Total Insured Value (Bldg + BPP)", value: tiv, kind: "money",
        driver: "Building & BPP values", input: `$${Number(i.buildingValue || 0).toLocaleString("en-US")} + $${Number(i.bppValue || 0).toLocaleString("en-US")}`,
        matched: "sum of the two declared values",
        note: "Property rates off value, not a territory loss cost — every factor below multiplies this." }),
      trace({ label: "Base Rate per $100 TIV", value: 0.42, kind: "num",
        driver: null, input: null, matched: "Program base rate — same for every property quote", base: 0.42 }),
      trace({ label: "Construction Type Factor", value: con.factor, kind: "x",
        driver: "Construction Type", input: con.label, table: "Construction Type", matched: con.label, base: 1.00,
        options: opts(VX.propConstruction, c => c.label, c => c.factor, c => c.code === con.code),
        note: "Frame is the most combustible and most expensive; fire-resistive earns the largest credit." }),
      trace({ label: "Protection Class Factor", value: ppc.factor, kind: "x",
        driver: "Protection Class (PPC)", input: "PPC " + ppc.ppc, table: "Public Protection Classification", matched: `PPC ${ppc.ppc}`, base: 1.00,
        options: opts(VX.propPPC, p => "PPC " + p.ppc, p => p.factor, p => p.ppc === ppc.ppc),
        note: "1 is the best-protected (hydrants, close fire station); 10 is effectively unprotected." }),
      trace({ label: "Occupancy Factor", value: occ.factor, kind: "x",
        driver: "Occupancy", input: occ.label, table: "Occupancy", matched: occ.label, base: 1.00,
        options: opts(VX.propOccupancy, o => o.label, o => o.factor, o => o.code === occ.code) }),
      trace({ label: "Wind/Hail Zone Factor", value: wh.factor, kind: "x",
        driver: "Wind / Hail Zone", input: wh.label, table: "Wind/Hail Zone", matched: wh.label, base: 1.00,
        options: opts(VX.propWindHail, w => w.label, w => w.factor, w => w.code === wh.code),
        note: "Tier 1 coastal nearly doubles the rate — this is usually the single biggest property factor." }),
      trace({ label: "Deductible Factor", value: ded.factor, kind: "x",
        driver: "All-Other-Perils Deductible", input: "$" + Number(ded.amount).toLocaleString("en-US"),
        table: "Property Deductibles", matched: `$${Number(ded.amount).toLocaleString("en-US")} deductible`, base: 1.00,
        options: opts(VX.propDed, d => "$" + d.amount.toLocaleString("en-US"), d => d.factor, d => d.amount === ded.amount),
        note: "$2,500 is the 1.00 neutral row — lower deductibles are a debit, higher ones a credit." }),
      trace({ label: "Loss Cost Multiplier", value: lcm, kind: "x",
        driver: null, input: null, table: "ProgramParams", matched: "Program constant", base: lcm }),
      trace({ label: "IRPM (Schedule Rating)", value: irpm, kind: "x",
        driver: "IRPM Modification", input: `${(+i.irpm || 0) >= 0 ? "+" : ""}${((+i.irpm || 0) * 100).toFixed(0)}%`,
        table: "Underwriter judgment", matched: (+i.irpm || 0) === 0 ? "no modification applied" : `${((+i.irpm || 0) * 100).toFixed(0)}% underwriter adjustment`,
        base: 1.00, note: "Underwriter judgment for what the formula can't see — typically capped at ±25%." }),
    ];
    const premDefault = Math.round(base * con.factor * ppc.factor * occ.factor * wh.factor * ded.factor * lcm * irpm);
    const premR = applySavedFormula("Commercial Property", "Property", {
      TotalInsuredValue: tiv, BaseRatePer100: 0.42, ConstructionFactor: con.factor, ProtectionClassFactor: ppc.factor,
      OccupancyFactor: occ.factor, WindHailFactor: wh.factor, DeductibleFactor: ded.factor, LCM: lcm, IRPM: irpm,
    }, premDefault);
    const prem = Math.round(premR.value);
    const groups = [{ name: "Property — Building & BPP", icon: "fa-building", color: "var(--cat-3)", factors: f, subtotal: prem, ratedBy: premR.ratedBy }];

    if (i.timeElement) {
      const te = Math.round(prem * 0.22);
      groups.push({ name: "Time Element (BI / Extra Expense)", icon: "fa-business-time", color: "var(--cat-5)",
        factors: [["Business Income Factor", 0.18, "x"], ["Extra Expense Factor", 0.04, "x"]], subtotal: te });
    }
    return assemble("Commercial Property", groups, 1, stTax, st, {
      minRule: 1000, acctLabel: "Account Modification", version: "v2026.01",
      formula: "(TIV/100) × Base Rate × Construction × PPC × Occupancy × Wind/Hail × Deductible × LCM × IRPM",
      input: i,
    });
  }

  /* ---------------- General Liability ---------------- */
  function gl(i) {
    const elp = find(VX.glELP, e => e.limit == i.limit);
    const cob = find(VX.industryClasses, c => c.code === i.classCode, VX.industryClasses[6]);
    const st = i.state || "TX";
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;
    const lcm = 1.62, sched = 1 + (+i.schedMod || 0), exp = Math.max(0.9, +i.expMod || 1);
    const base = Math.round((+i.revenue / 1000) * 4.15);

    const groups = [];
    const f1 = [["Premises/Ops Basic Limit Loss Cost", base, "money"], ["Increased Limits Factor", elp.elp, "x"],
      ["Loss Cost Multiplier", lcm, "x"], [`Class Factor — ${cob.name}`, cob.factor, "x"],
      ["Schedule Rating Mod", sched, "x"], ["Experience Mod (floor 0.90)", exp, "x"]];
    const p1Default = Math.round(base * elp.elp * lcm * cob.factor * sched * exp);
    // Formula Builder execution: if a formula is Active for General Liability,
    // it rates this — not the hardcoded chain above. See applySavedFormula.
    const p1r = applySavedFormula("General Liability", "General Liability", {
      BasicLimitLossCost: base, IncreasedLimitsFactor: elp.elp, LCM: lcm, ClassFactor: cob.factor,
      ScheduleRatingMod: sched, ExperienceMod: exp,
    }, p1Default);
    groups.push({ name: "Premises / Operations", icon: "fa-store", color: "var(--cat-1)", factors: f1, subtotal: Math.round(p1r.value), ratedBy: p1r.ratedBy });

    if (i.products) {
      const p2 = Math.round(Math.round(p1r.value) * 0.34);
      groups.push({ name: "Products / Completed Operations", icon: "fa-boxes-stacked", color: "var(--cat-2)",
        factors: [["Products Basic Limit Loss Cost", Math.round(base * 0.3), "money"], ["Increased Limits Factor", elp.elp, "x"]], subtotal: p2 });
    }
    return assemble("General Liability", groups, 1, stTax, st, {
      minRule: 500, acctLabel: "Account Modification", version: "v2025.10",
      formula: "Basic Limit LC × ILF × LCM × Class Factor × Schedule Mod × Experience Mod",
      input: i,
    });
  }

  /* ---------------- Cyber ---------------- */
  function cyber(i) {
    const ind = find(VX.cyberIndustry, c => c.code === i.industry);
    const mfa = find(VX.cyberMFA, m => m.code === i.mfa);
    const lim = find(VX.cyberLimits, l => l.limit == i.limit);
    const ret = find(VX.cyberRetentions, r => r.retention == i.retention);
    const st = i.state || "TX";
    const stTax = (VX.taxes.find(t => t.state === st) || { surplusTax: 2 }).surplusTax / 100;
    const baseDev = VX.programParams.find(p => p.param === "Base Rate Deviation").value;
    const revF = +i.revenue > 100000000 ? 1.8 : +i.revenue > 25000000 ? 1.35 : +i.revenue > 5000000 ? 1.0 : 0.85;
    const sched = 1 + (+i.schedMod || 0);
    const base = Math.round((+i.revenue / 1000) * 0.42 * baseDev);

    const f = [["Base Rate (revenue-scaled)", base, "money"], ["Base Rate Deviation", baseDev, "x"],
      ["Revenue Band Factor", revF, "x"], ["Industry Class Factor", ind.factor, "x"],
      ["MFA Controls Factor", mfa.factor, "x"], ["Aggregate Limit Factor", lim.factor, "x"],
      ["Retention Factor", ret.factor, "x"], ["Schedule Rating Factor", sched, "x"]];
    const prem = Math.round(base * revF * ind.factor * mfa.factor * lim.factor * ret.factor * sched);
    const groups = [{ name: "Cyber — All Insuring Agreements", icon: "fa-shield-virus", color: "var(--cat-4)", factors: f, subtotal: prem }];
    return assemble("Cyber", groups, 1, stTax, st, {
      minRule: 1500, acctLabel: "Account Modification", version: "v2026.05",
      formula: "Base Rate × Agg Risk Mod × Industry × MFA × Limit ILF × Retention × Schedule Rating",
      input: i,
    });
  }

  /* ---------------- Workers' Compensation ----------------
     Real WC manual-rating method: each class-of-business row on the exposure
     schedule prices independently (its own state, class code and payroll),
     the rows sum to a manual premium, and exactly ONE experience mod and ONE
     schedule credit apply to the policy as a whole — summed-per-row is how
     real WC pricing works, not a simplification the way GL/Property's
     "rate off the primary row" approach is. See D.wcClassRates for what's
     real (the method, the class codes) versus representative (the dollar
     rates — no filed manual ships with this platform).

     No surplus-lines tax: WC is written on admitted paper (see D.lobs'
     licenceBasis note), so the excise-tax mechanism every other LOB on this
     platform models does not apply here — assemble() is called with
     taxPct=0, which shows up honestly as a $0.00 state-tax line rather than
     silently reusing the surplus-lines rate. */
  function workersComp(i) {
    const minP = VX.programParams.find(p => p.lob === "Workers' Compensation" && p.param === "Minimum Premium").value;
    const modMin = VX.programParams.find(p => p.lob === "Workers' Compensation" && p.param === "Experience Mod Min").value;
    const modMax = VX.programParams.find(p => p.lob === "Workers' Compensation" && p.param === "Experience Mod Max").value;
    const schedMin = VX.programParams.find(p => p.lob === "Workers' Compensation" && p.param === "Schedule Credit Min").value;
    const schedMax = VX.programParams.find(p => p.lob === "Workers' Compensation" && p.param === "Schedule Credit Max").value;
    const st = i.state || "TX";

    const exposures = (i.wcExposures || []).map(x => {
      const cls = find(VX.wcClassRates, c => c.classCode === x.classCode, VX.wcClassRates[0]);
      const payroll = +x.payroll || 0;
      const premium = Math.round((payroll / 100) * cls.ratePer100);
      return { ...x, classCode: cls.classCode, desc: cls.desc, ratePer100: cls.ratePer100, payroll, premium };
    });
    const totalManual = exposures.reduce((s, x) => s + x.premium, 0);
    const totalPayroll = exposures.reduce((s, x) => s + x.payroll, 0);

    const expMod = Math.min(modMax, Math.max(modMin, +i.wcExpMod || 1));
    const schedRaw = Math.min(schedMax, Math.max(schedMin, +i.wcSchedMod || 0));
    const schedFactor = 1 + schedRaw;

    const f = exposures.map(x => trace({
      label: `Class ${x.classCode} — ${x.desc}`, value: x.premium, kind: "money",
      driver: "Exposure schedule", input: `$${x.payroll.toLocaleString("en-US")} payroll`,
      table: "NCCI class rates", matched: `$${x.ratePer100.toFixed(2)} per $100 of payroll`,
      note: exposures.length > 1 ? null : "Add another class code on the Risk Details tab to schedule a second exposure." }));
    f.push(trace({ label: "Experience Mod", value: expMod, kind: "x",
      driver: "Bureau-computed experience rating", input: (+i.wcExpMod || 1).toFixed(3),
      matched: `Clamped to the filed ${modMin.toFixed(2)}–${modMax.toFixed(2)} band`, base: 1.00,
      note: "Real mods are computed by NCCI/state bureaus from the account's own loss history — captured here as a direct underwriter input, not derived on this platform." }));
    f.push(trace({ label: "Schedule Rating Credit/Debit", value: schedFactor, kind: "x",
      driver: "Underwriter", input: (schedRaw * 100).toFixed(1) + "%",
      matched: `Clamped to ±${(schedMax * 100).toFixed(0)}% (standard NCCI schedule-rating band)`, base: 1.00 }));

    const premDefault = Math.round(totalManual * expMod * schedFactor);
    const premR = applySavedFormula("Workers' Compensation", "Workers' Compensation", {
      TotalManualPremium: totalManual, ExperienceMod: expMod, ScheduleCreditDebit: schedFactor,
    }, premDefault);
    const prem = Math.round(premR.value);

    const groups = [{ name: "Workers' Compensation", icon: "fa-hard-hat", color: "var(--cat-6)", factors: f, subtotal: prem, ratedBy: premR.ratedBy }];
    const r = assemble("Workers' Compensation", groups, 1, 0, st, {
      minRule: minP, acctLabel: "Schedule Rating", version: "v2026.08",
      formula: "Σ(Class Payroll/100 × Manual Rate) × Experience Mod × Schedule Credit",
      input: i,
    });
    r.wcExposures = exposures;
    r.wcTotalPayroll = totalPayroll;
    r.wcAdmitted = true;
    return r;
  }

  /* ==========================================================================
     Formula Builder execution — closing the configure-to-rate loop.

     Every calculator below used to hardcode its arithmetic in JavaScript,
     completely ignoring whatever a user built and marked Active in Formula
     Builder — a saved formula was pure documentation. This is what actually
     executes one: given the coverage's real per-quote factor values (the
     exact same numbers already going into the trace/factor list a person
     sees), it looks up the matching Active formula and evaluates its token
     chain in place of the hardcoded default.

     Matching is by (lob, cobKey) where cobKey is the formula's `cob` field —
     NOT the display group name, which doesn't always match it (GL's saved
     formula has cob:"General Liability" but its group is named
     "Premises / Operations"; Property's cob is "Property" but its group is
     "Property — Building & BPP"). Each call site below passes the correct
     cobKey explicitly rather than relying on string-matching a label.

     Token evaluation builds a small, fully-whitelisted JS expression from
     controlled {t,v} tokens (operators/numbers/known variable names only —
     never free text) and runs it through Function(), the same technique
     Formula Builder's own Evaluate Formula already uses on the same data. */
  /* A formula that names every factor explicitly silently ignores any factor
     added to the engine afterwards. That is not hypothetical: seven factors
     were added to the trucking chain and changed no premium until each saved
     formula was hand-edited to name them.

     RemainingFactors closes that. It evaluates to the product of every numeric
     variable the engine supplies that the formula does not already reference,
     so a formula ending in "... × RemainingFactors" picks up new factors as
     they are introduced. Placed last because it is a catch-all: anything the
     author cared to order explicitly they will have named explicitly. */
  const REMAINING = "RemainingFactors";
  const FN_MAP = { MIN: "MIN", MAX: "MAX", ROUND: "ROUND", ABS: "ABS" };

  function remainingProduct(tokens, vars) {
    const named = new Set(tokens.filter(t => t.t === "var").map(t => t.v));
    let prod = 1;
    const used = [];
    Object.keys(vars).forEach(k => {
      if (k === REMAINING || named.has(k)) return;
      const v = vars[k];
      if (typeof v !== "number" || !isFinite(v)) return;
      prod *= v;
      if (Math.abs(v - 1) > 1e-9) used.push(k + "=" + v);
    });
    return { value: prod, applied: used };
  }

  function evalTokens(tokens, vars) {
    const js = tokens.map(t => {
      if (t.t === "var" && t.v === REMAINING) {
        return "(" + remainingProduct(tokens, vars).value + ")";
      }
      if (t.t === "var") { const v = vars[t.v]; if (v == null || isNaN(v)) throw new Error("missing value for " + t.v); return "(" + v + ")"; }
      if (t.v === "×") return "*";
      if (t.v === "÷") return "/";
      if (t.v === "−") return "-";
      if (t.v === "^") return "**";
      /* MIN / MAX / ROUND were listed in the palette but had no implementation:
         they fell through as bare identifiers, so any formula using one threw
         ReferenceError and silently rated on its fallback. Mapped onto real
         functions here. Comma is passed through so MIN(a, b) parses. */
      if (FN_MAP[t.v]) return FN_MAP[t.v];
      return t.v; // + - ( ) , or a numeric literal
    }).join(" ");
    const out = Function("MIN", "MAX", "ROUND", "ABS",
      '"use strict";return (' + js + ")")(
      (...a) => Math.min(...a), (...a) => Math.max(...a),
      (v, d) => { const m = Math.pow(10, d || 0); return Math.round(v * m) / m; },
      Math.abs);
    if (typeof out !== "number" || !isFinite(out)) throw new Error("formula did not evaluate to a number");
    return out;
  }
  /* Deliberately does NOT round — a per-unit-of-value rate (Physical Damage's
     chain, evaluated with VehicleValue pinned to 1 so its floor-rate safety
     net still applies afterward) is not a dollar amount and rounding it here
     would collapse a real value like 0.0475 to 0. Callers round where it's
     actually a final dollar figure — matching exactly where the original
     hardcoded formulas rounded before this existed. */
  /* Scoped to the ACTIVE tenant, not just (lob, cob). Every saved formula
     already carries a real tenantId (the same tenant-partitioning pass that
     assigns one to every product/factor), so this was always a latent gap
     rather than a hypothetical one — it only stayed invisible as long as
     exactly one tenant had ever authored a formula for a given line. Onboarding
     a second tenant with its own Active Workers' Compensation formula is what
     surfaced it: without this filter, that formula would have silently rated
     every OTHER tenant's Workers' Compensation quotes too, not just its own. */
  function applySavedFormula(lobName, cobKey, varMap, defaultValue) {
    const tid = (typeof VX !== "undefined") ? VX.activeTenantId : null;
    const f = (typeof VX !== "undefined" && VX.savedFormulas || [])
      .find(x => x.status === "Active" && x.lob === lobName && x.cob === cobKey
        && (x.tenantId == null || tid == null || x.tenantId === tid));
    if (!f) return { value: defaultValue, ratedBy: { mode: "default" } };
    try {
      const value = evalTokens(f.tokens, varMap);
      return { value, ratedBy: { mode: "formula", name: f.name, updated: f.updated,
        version: (f.attachments && f.attachments[0] && f.attachments[0].ratingVersion) || null } };
    } catch (e) {
      // Never let a bad saved formula break a quote — fall back and say why.
      return { value: defaultValue, ratedBy: { mode: "default", error: e.message } };
    }
  }

  /* Pricing rules (discounts / surcharges / fees) are tenant-owned: each
     tenant has its own editable copy, partitioned on /tenantId. A quote must
     rate under its own tenant's rules, never a blend of every tenant's — so
     these are scoped here before the engine's "first N matching" cap applies.
     Rows without a tenantId are treated as shared, which keeps this safe for
     any collection that hasn't been partitioned. */
  function ofTenant(row) {
    const tid = (typeof VX !== "undefined") ? VX.activeTenantId : null;
    return row.tenantId == null || tid == null || row.tenantId === tid;
  }

  /* ==========================================================================
     Credit / debit eligibility.

     Each discount and surcharge row carries a human-readable `condition`
     ("Clean renewal, LR < 50%", "10+ years CDL experience") that nothing ever
     read. assemble() applied the first two matching discounts and the first
     matching surcharge unconditionally, so on Commercial Trucking every
     quote — including new business — received the Renewal Discount and the
     CDL Experience Discount, and every quote took the FMCSA Alert Surcharge
     whether or not the carrier had an alert.

     Each rule returns one of three things, and the difference matters:
       true   the condition holds for this submission — apply it
       false  the condition does not hold — do not apply it
       null   the submission does not carry the data needed to decide

     A null is NOT silently treated as false. It is reported on the quote as
     an undetermined credit, because "we checked and you do not qualify" and
     "we never asked" are different answers, and only one of them is a reason
     for an underwriter to go back to the broker.
     ========================================================================== */
  const yes = v => String(v || "").toLowerCase() === "yes";
  const has = v => v !== undefined && v !== null && v !== "" && String(v).toLowerCase() !== "unknown";

  const CREDIT_RULES = {
    /* The reported bug: gated on the policy actually being a renewal AND the
       renewal being flagged eligible — the same two tests the account factor
       already makes, rather than being applied to every quote. */
    DISC_RENEWAL: i => !has(i.policyType) ? null
      : (String(i.policyType) === "Renewal" && yes(i.renewalEligible)),
    DISC_CDL: i => {
      const d = i.drivers || [];
      if (!d.length) return null;
      const yrs = d.map(x => +x.cdlYears).filter(n => !isNaN(n) && n > 0);
      return yrs.length ? yrs.every(n => n >= 10) : null;
    },
    DISC_DASHCAM: i => has(i.dashcam) ? String(i.dashcam) === "YES - Preferred Vendor" : null,
    DISC_PIF: i => has(i.billType) ? String(i.billType) === "Paid In Full" : null,
    DISC_CF: i => has(i.priorClaims) ? +i.priorClaims === 0 : null,
    DISC_MFA: i => has(i.mfa) ? String(i.mfa).toUpperCase() === "FULL" : null,
    DISC_SPRINK: i => has(i.sprinklered) ? yes(i.sprinklered) : null,
    DISC_ALARM: i => has(i.centralAlarm) ? yes(i.centralAlarm) : null,
    /* No field on any submission asks these, so they can never be earned.
       Returning null rather than false says so out loud instead of quietly
       withholding a credit the insured may well qualify for. */
    DISC_MULTI: () => null,
    DISC_SAFETY: () => null,

    SUR_FMCSA: i => has(i.fmcsaAlerts) ? +i.fmcsaAlerts > 0 : null,
    SUR_OOSV: i => has(i.oosVehiclesBand) ? !/below|at or below|none/i.test(String(i.oosVehiclesBand)) : null,
    SUR_OOSD: i => has(i.oosDriversBand) ? !/below|at or below|none/i.test(String(i.oosDriversBand)) : null,
    SUR_NEWVEN: i => has(i.yearsInBusiness) ? String(i.yearsInBusiness) === "New Venture" : null,
    SUR_NODASH: i => has(i.dashcam) ? String(i.dashcam) === "NO Dashcams" : null,
    SUR_HAZMAT: i => (i.cargoCommodities || []).length
      ? (i.cargoCommodities || []).some(c => c.hazmat) : null,
    SUR_DRV: i => {
      const d = i.drivers || [];
      return d.length ? d.some(x => String(x.violationClass || "").toUpperCase() === "E") : null;
    },
    /* The vehicle schedule has no driver-assignment field anywhere on this
       platform, so this cannot be evaluated at all — reporting "unassigned"
       from the ABSENCE of a link would debit every quote for a fact the
       submission never states. */
    SUR_UNASSIGN: () => null,
    SUR_CYBINC: i => has(i.priorClaims) ? +i.priorClaims >= 2 : null,
    SUR_COASTAL: i => has(i.windHail) ? String(i.windHail) === "Z3" : null,
  };

  /* Facts already priced inside a line's own factor chain. Charging them a
     second time here is double-counting, not a second opinion: the trucking
     account factor is literally built from the same eight answers, and the
     dashcam and CDL-experience factors are applied per vehicle and per driver
     before the premium ever reaches this function. */
  const ALREADY_IN_CHAIN = {
    /* Zone 3 IS "Tier 1 Coastal" and already carries a 1.90 wind/hail factor
       in the property chain — the +90% surcharge is the identical load. */
    "Commercial Property": new Set(["SUR_COASTAL"]),
    /* The cyber chain rates MFA directly off VX.cyberMFA. */
    "Cyber": new Set(["DISC_MFA"]),
    "Commercial Trucking": new Set([
      "DISC_RENEWAL",   // = acctLines "Renewal Discount"
      "SUR_FMCSA",      // = acctLines "Carrier Safety / FMCSA Alerts"
      "SUR_OOSV",       // = acctLines "OOS Violations — Vehicles"
      "SUR_OOSD",       // = acctLines "OOS Violations — Drivers"
      "SUR_NEWVEN",     // = acctLines "Business Experience" (New Venture band)
      "DISC_CDL",       // = per-driver cdlExpDiscFctr
      "DISC_DASHCAM",   // = per-vehicle truckDashcam factor
      "SUR_NODASH",     // = per-vehicle truckDashcam factor (1.20 row)
      "SUR_DRV",        // = per-driver driverClassFctr
      "SUR_HAZMAT",     // = cargo chain's Hazardous Mod Factor
    ]),
  };

  /* Splits a line's credit rows into applied / not-applied-with-a-reason. */
  function resolveCredits(rows, lob, i, basis) {
    const applied = [], skipped = [];
    const inChain = ALREADY_IN_CHAIN[lob] || new Set();
    rows.forEach(row => {
      if (inChain.has(row.code)) {
        skipped.push({ name: row.name, code: row.code, reason: "Already priced in the rating chain" });
        return;
      }
      const rule = CREDIT_RULES[row.code];
      const verdict = rule ? rule(i) : null;
      if (verdict === true) {
        applied.push({ name: row.name, value: row.value, amt: Math.round(basis * row.value), why: row.condition });
      } else if (verdict === false) {
        skipped.push({ name: row.name, code: row.code, reason: "Condition not met: " + row.condition });
      } else {
        skipped.push({ name: row.name, code: row.code, undetermined: true,
          reason: "Submission does not carry the data to evaluate: " + row.condition });
      }
    });
    return { applied, skipped };
  }

  /* ---------------- shared assembly ---------------- */
  function assemble(lob, groups, acct, taxPct, state, o) {
    // normalize every LOB's factors to trace objects, so the UI has one shape
    groups.forEach(g => { g.factors = g.factors.map(toTrace); });
    const coverage = groups.reduce((a, g) => a + g.subtotal, 0);
    const afterAcct = Math.round(coverage * acct);
    const drvF = o.driverFactor || 1;
    const afterDriver = Math.round(afterAcct * drvF);

    /* "All" credits apply to every line, matching how fees already resolve.
       The arbitrary "first two discounts, first one surcharge" caps are gone:
       they were standing in for eligibility, and picking credits by their
       position in a seed array is not a pricing rule. Each row's condition is
       evaluated against this submission instead. */
    const inp = o.input || {}, i0 = inp;
    const dRes = resolveCredits(
      VX.discounts.filter(d => d.active && (d.lob === lob || d.lob === "All")).filter(ofTenant),
      lob, inp, afterDriver);
    const sRes = resolveCredits(
      VX.surcharges.filter(s => s.active && (s.lob === lob || s.lob === "All")).filter(ofTenant),
      lob, inp, afterDriver);
    const discounts = dRes.applied, surcharges = sRes.applied;
    const creditsSkipped = [...dRes.skipped, ...sRes.skipped];
    const dTot = discounts.reduce((a, d) => a + d.amt, 0);
    const sTot = surcharges.reduce((a, s) => a + s.amt, 0);
    const afterAdj = afterDriver + dTot + sTot;

    /* ---- fees: fixed (× quantity) or percent (of a chosen basis, min/max capped) ---- */
    /* FEE_SLFILE is a real, non-admitted-only regulatory fee — its name says
       so. Every other line on this platform is written non-admitted, but
       Workers' Compensation (see D.lobs' licenceBasis note) is not, so it is
       the one explicit exception rather than a second "lob: All-minus-one"
       concept bolted onto the fee schema for a single row. */
    const applicable = VX.fees.filter(f => f.active && (f.lob === "All" || f.lob === lob))
      .filter(f => !(f.code === "FEE_SLFILE" && lob === "Workers' Compensation"))
      .filter(ofTenant);
    const preTax = Math.round(afterAdj * taxPct);
    const BASIS = {
      "Premium Before Fees": afterAdj,
      "Coverage Premium": coverage,
      "Premium + Taxes": afterAdj + preTax,
    };
    const feeLines = [];
    applicable.forEach(f => {
      if (f.valueType === "Percent") {
        const base = BASIS[f.percentOf] ?? afterAdj;
        let amt = base * (f.value / 100);
        let capped = null;
        if (f.minFee && amt < f.minFee) { amt = f.minFee; capped = "min"; }
        if (f.maxFee && amt > f.maxFee) { amt = f.maxFee; capped = "max"; }
        feeLines.push({ name: f.name, code: f.code, valueType: "Percent", pct: f.value,
          percentOf: f.percentOf, base, capped, minFee: f.minFee, maxFee: f.maxFee,
          qty: 1, amt: Math.round(amt), chargeType: f.chargeType, taxable: f.taxable });
      } else {
        let qty = 0;
        if (f.chargeType === "Per Policy") qty = 1;
        else if (f.chargeType === "Per Driver") qty = f.code === "FEE_DRVSUR" ? (o.surchargedDrivers || 0) : (o.drivers || 0);
        else if (f.chargeType === "Per Vehicle") qty = o.units || 0;
        else if (f.chargeType === "Per Location") qty = o.locations || 1;
        if (qty > 0) feeLines.push({ name: f.name, code: f.code, valueType: "Fixed",
          unit: f.value, qty, amt: f.value * qty, chargeType: f.chargeType, taxable: f.taxable });
      }
    });
    const fees = feeLines.reduce((a, f) => a + f.amt, 0);

    // taxable fees are taxed alongside premium
    const taxableFees = feeLines.filter(f => f.taxable).reduce((a, f) => a + f.amt, 0);
    const taxBase = afterAdj + taxableFees;
    const tax = Math.round(taxBase * taxPct);

    /* County / municipal tax.

       This used to be layered on by quote-portal.html AFTER ENGINE.rate()
       returned, which meant it existed on exactly one screen: the Quote JSON
       page ran the identical engine call and produced a total with no local
       tax in it, so the same risk quoted differently depending on which page
       you were standing on. A tax is a pricing rule, and pricing rules belong
       in the engine, so it is charged here for every caller.

       It uses the same base as the state tax (premium plus taxable fees)
       rather than premium alone, so the two lines cannot disagree about what
       is being taxed. */
    const countyName = i0.county || i0.countyName || null;
    const countyRow = countyName
      ? (VX.counties || []).find(c => c.name === countyName && c.state === state)
      : null;
    const countyRate = countyRow ? countyRow.taxRate : 0;
    const countyTax = countyRate ? Math.round(taxBase * countyRate / 100) : 0;
    /* A submission naming a county this tenant has not configured must not
       quietly rate as 0% local tax — that is an under-collection presented as
       a fact. The quote says so instead, and the screens surface it. */
    const countyUnknown = !!countyName && !countyRow;

    let final = afterAdj + fees + tax + countyTax;
    const minApplied = final < o.minRule;
    if (minApplied) final = o.minRule;

    return {
      lob, state, version: o.version, formula: o.formula, groups,
      coveragePremium: coverage, accountFactor: acct, acctLabel: o.acctLabel, afterAccount: afterAcct,
      driverFactor: drvF, afterDriver, units: o.units, driverCount: o.drivers, surchargedDrivers: o.surchargedDrivers,
      discounts, surcharges, discountTotal: dTot, surchargeTotal: sTot, creditsSkipped,
      fees, feeLines, taxPct, tax, taxBase,
      countyTax, countyRate, countyName: countyRow ? countyName : null, countyUnknown, countyRequested: countyName,
      minApplied, minRule: o.minRule, finalPremium: final,
      feeDetail: applicable, taxDetail: VX.taxes.find(t => t.state === state),
    };
  }

  /* ==========================================================================
     Flatten every group's factors into one audit list, each with the dollar
     amount attributable to it.

     "Impact" is measured against the factor's DEFAULT — the table's neutral
     row — not against 1.0, because that is the question people actually ask:
     not "what does LCM contribute" (it contributes to every quote equally)
     but "what did THIS insured's answers do to THIS premium versus a
     baseline risk". A factor sitting on its default row therefore shows an
     impact of zero, which is correct: it moved nothing.

     For a multiplicative factor v against neutral n on a group subtotal S,
     re-rating at n would give S x (n/v), so impact = S x (1 - n/v).
     Factors that are not applied multiplicatively (the liability deductible
     is subtracted from the ILF) declare base 0 and are skipped rather than
     given a fabricated number.
     ========================================================================== */
  function ENGINE_TRACE(r) {
    const out = [];
    (r.groups || []).forEach(g => {
      (g.factors || []).map(toTrace).forEach(f => {
        const neutral = f.base == null ? 1 : f.base;
        const multiplicative = f.kind === "x" && neutral > 0 && f.value > 0;
        const impact = multiplicative ? Math.round(g.subtotal * (1 - neutral / f.value)) : 0;
        out.push({
          ...f, group: g.name, groupColor: g.color, groupSubtotal: g.subtotal,
          neutral, impact, measurable: multiplicative,
          atDefault: multiplicative && Math.abs(f.value - neutral) < 1e-9,
          pct: multiplicative ? (f.value / neutral - 1) * 100 : null,
        });
      });
    });
    return out;
  }

  const MAP = { TRUCK: trucking, MPL: mpl, PROP: property, GL: gl, CYBER: cyber, WC: workersComp };
  return {
    rate: (lobCode, input) => {
      const fn = MAP[lobCode];
      if (!fn) throw new Error("No rating calculator registered for LOB " + lobCode);
      return fn(input);
    },
    explain: r => {
      const all = ENGINE_TRACE(r).filter(t => t.kind === "x");
      const top = all.slice().sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3);
      return {
        summary: `The ${r.lob} premium of ${vxMoney(r.finalPremium)} was produced by rating version ${r.version} for ${r.state}.`,
        formula: r.formula,
        drivers: top.map(t => `${t.label} (${t.value.toFixed(3)}×) in the ${t.group} chain ${t.value > 1 ? "added" : "saved"} about ${vxMoney(Math.abs(t.impact))}` +
          (t.driver ? ` — driven by ${t.driver} = "${t.input}"` : "")),
        taxes: `State premium tax of ${(r.taxPct * 100).toFixed(2)}% (${vxMoney(r.tax)}) and ${vxMoney(r.fees)} in policy fees were applied.`,
        version: `Rating version ${r.version} was selected because the transaction date falls inside its effective window.`,
        warnings: r.minApplied ? [`Calculated premium fell below the ${vxMoney(r.minRule)} program minimum — the minimum premium rule was applied.`] : [],
      };
    },
    /* Flat, group-tagged trace of every factor with its dollar impact —
       the data behind the "why is my premium this?" audit view. */
    trace: r => ENGINE_TRACE(r),
    LOBS: MAP,
    /* The (line, coverage) pairs where a saved formula is actually EXECUTED.
       applySavedFormula() is called at exactly these eight sites; a formula
       saved against any other coverage is stored, versioned and browsable but
       never runs, because no calculator reaches for it. Declared here so the
       screens that offer formula authoring can say so up front rather than
       letting someone find out after building one. */
    REMAINING_VAR: REMAINING,
    remainingFor: (tokens, vars) => remainingProduct(tokens, vars),
    FORMULA_HOOKS: [
      { lob: "Commercial Trucking", cob: "__ACCOUNT__", label: "Account-Level (Auto Liability)" },
      { lob: "Commercial Trucking", cob: "__ACCOUNT_PD__", label: "Account-Level (Physical Damage)" },
      { lob: "Commercial Trucking", cob: "Auto Liability" },
      { lob: "Commercial Trucking", cob: "Physical Damage" },
      { lob: "Commercial Trucking", cob: "Motor Truck Cargo" },
      { lob: "Commercial Property", cob: "Property" },
      { lob: "General Liability", cob: "General Liability" },
      { lob: "Professional Liability (MPL)", cob: "Professional Liability" },
      { lob: "Workers' Compensation", cob: "Workers' Compensation" },
    ],
    runsFormula: (lob, cob) => ENGINE.FORMULA_HOOKS.some(h => h.lob === lob && h.cob === cob),
  };
})();
