/* ==========================================================================
   Veridex Rating Platform — Sample Data Store
   Program parameters marked [REAL] are extracted from the five source .xlsb
   rating workbooks. Volume data (counties, factor rows, quotes, audit) is
   generated to realistic shape for prototype purposes.
   ========================================================================== */
(function (g) {
  const D = {};

  /* deterministic PRNG so the prototype looks identical on every load */
  let _s = 20260805;
  const rnd = () => (_s = (_s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const rf = (a, b, d = 2) => +(a + rnd() * (b - a)).toFixed(d);
  const dt = (dm, dM) => { const x = new Date(2026, 0, 1); x.setDate(x.getDate() - ri(dm, dM)); return x.toISOString().slice(0, 10); };

  /* This prototype has no backend, so any state a user can change through the
     UI (publishing a rating version, saving/attaching a formula) needs to
     survive navigating to another page. loadPersisted() swaps in a browser
     localStorage snapshot over the freshly-generated seed data when one
     exists; the seed data is what a first-ever load (or an incognito tab)
     falls back to. */
  const loadPersisted = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  };

  /* Data-version guard: a browser that persisted state from before Commercial
     Trucking's real formulas were restored (see truckingReal() in engine.js)
     keeps re-loading that stale snapshot forever — loadPersisted() always
     prefers a browser's own storage over the current seed, so no amount of
     reloading the page picks up a fix that lives only in the seed data below.
     Bumping this stamp forces exactly one full reset of every persisted key
     on the next load, for every browser, no manual cache-clearing required;
     unchanged on later deploys, so normal edits after this one stay durable. */
  /* ---------- Effective-dated rate rows (rate versioning) ----------
     A filed rate table is not one set of numbers, it is a series of them,
     each in force for a window. ams-service models this by physically
     copying the whole table per filing (iso_new_rater_primary_factor and
     iso_new_rater_primary_factor_12152025, chosen by an if/else on the
     quote's lock_rate_date). That works but multiplies tables per filing and
     buries the cutover date inside a stored procedure.

     This platform uses row-level effective dating instead: a revision ADDS
     rows and closes the superseded ones, so one table carries its own
     history and "what did we charge on <date>" is answerable by query.

     A row with no effectiveStart is treated as always-in-force — that keeps
     every table that has not been given a revision history working exactly
     as before rather than silently rating to nothing. */
  /* This prototype's standing "today". Every date-relative table here rates
     off this rather than the browser clock, so a quote produces the same
     premium on any machine on any day — the same reason the PRNG is seeded. */
  D.referenceDate = "2026-09-01";

  D.tableAsOf = (rows, asOf) => {
    if (!asOf) return rows;
    return rows.filter(r => (!r.effectiveStart || r.effectiveStart <= asOf)
                         && (!r.effectiveEnd || r.effectiveEnd >= asOf));
  };

  const VX_DATA_VERSION = "2026-09-08-lookup-table-samples";
  try {
    if (localStorage.getItem("vxDataVersion") !== VX_DATA_VERSION) {
      localStorage.clear();
      localStorage.setItem("vxDataVersion", VX_DATA_VERSION);
    }
  } catch (e) {}

  /* ---------------- Source workbooks ---------------- */
  D.workbooks = [
    { id: 1, name: "DIGITAL TRUCKING Rater_2026-03.xlsb", lob: "Commercial Trucking", sheets: 31, rows: "57k+ (ZIP)", imported: "2026-07-02", status: "Imported", owner: "J. Romero" },
    { id: 2, name: "STD_PLAN_General_Liability_Rater_2025-10-28.xlsb", lob: "General Liability", sheets: 15, rows: "236k (AddlParams)", imported: "2026-08-05", status: "Imported", owner: "S. Patel" },
    { id: 3, name: "Commercial_Property_Rater_2026-01-14.xlsb", lob: "Commercial Property", sheets: 37, rows: "63k (ZIP_SCL)", imported: "2026-08-05", status: "Imported", owner: "S. Patel" },
    { id: 4, name: "MPL_Rater_2024_12-13_4.xlsb", lob: "Professional Liability (MPL)", sheets: 11, rows: "57k (ZIP)", imported: "2026-08-05", status: "Imported", owner: "M. Alvarez" },
    { id: 5, name: "cyber_template.xlsb", lob: "Cyber", sheets: 3, rows: "184 (Helper)", imported: "2026-08-05", status: "Imported", owner: "M. Alvarez" },
  ];

  /* ---------------- Lines of Business ---------------- */
  D.lobs = [
    { id: 1, code: "TRUCK", name: "Commercial Trucking", sourceSheets: 31, engine: "Multiplicative + Exp/Loss Mod", status: "Active", products: 2, desc: "Auto Liability, Physical Damage & Cargo for motor carriers" },
    { id: 2, code: "GL", name: "General Liability", sourceSheets: 15, engine: "ISO Loss Cost × ILF × LCM", status: "Active", products: 2, desc: "Premises/Ops and Products/Completed-Ops liability" },
    { id: 3, code: "PROP", name: "Commercial Property", sourceSheets: 37, engine: "Rate × TIV × COPE + Time Element", status: "Active", products: 2, desc: "Building Group 1/2 and Special Class List property" },
    { id: 4, code: "MPL", name: "Professional Liability (MPL)", sourceSheets: 11, engine: "Loss Cost × LCM × ILF × Hazard Grp", status: "Active", products: 1, desc: "Miscellaneous professional liability, claims-made" },
    { id: 5, code: "CYBER", name: "Cyber", sourceSheets: 3, engine: "Base Rate × Agg Risk × ILF × Sched", status: "Active", products: 1, desc: "Privacy/security, breach response, cyber crime, business loss" },
    { id: 6, code: "UMB", name: "Umbrella / Excess", sourceSheets: 0, engine: "Follow-form over underlying", status: "Draft", products: 1, desc: "Excess over Auto, GL and Employers Liability" },
    /* Workers' Compensation (ams_service application_type_id 491) was entirely
       absent from this platform — every other real line here has at least a
       Draft product; WC had none. Real, dedicated fields exist in the source
       system (exposure schedule, experience mod, an eligibility questionnaire)
       and it is filed across a confirmed 13-state/company variant family
       server-side, which is why it's modeled for real rather than disclosed
       as a stub — see D.wcClassRates below for what "real" does and doesn't
       mean for the rate VALUES specifically.
       licenceBasis: "Admitted" (not "Surplus Lines" like every other line on
       this platform) because WC is a mandatory statutory coverage in nearly
       every US state and non-admitted/E&S carriers generally cannot write it
       standalone — the real system's own "Stop Gap Liability" coverage
       (already modeled under General Liability) exists specifically because
       it's the E&S-eligible substitute for Employers Liability in monopolistic
       states. A carrier offering both, as VeriDex does here, normally does so
       through a separate admitted paper/subsidiary, not the same non-admitted
       shell — flagged here rather than silently treated as one more E&S line. */
    { id: 7, code: "WC", name: "Workers' Compensation", sourceSheets: 0, engine: "Manual Rate × Payroll/100 × Exp Mod × Schedule Credit", status: "Active", products: 1,
      desc: "Statutory employers'-liability coverage — exposure-schedule rated, admitted paper (not surplus lines like the rest of this platform)",
      licenceBasis: "Admitted" },
  ];

  /* ---------------- Products ----------------
     Every product on this platform uses the **Custom** rater: the
     per-vehicle/per-risk calculation engine implemented in engine.js. The
     shared "Generic" form-driven rater and the legacy 501 account-level Auto
     Liability rater are not part of this platform — a product either has a
     purpose-built rater here or it isn't offered.

     appTypeId still mirrors the real ams_service.ins_application_type ids so
     the mapping back to the source system stays traceable: 483=Commercial
     Trucking (per-vehicle "ISO New Rater" / Digital Trucking Rater),
     496=GL Package, 497=MPL, 499=General Liability (single location — NOT
     Cyber, a mislabel this prototype used to carry), 1102=Cyber,
     492=Property, 495=Excess/Umbrella.

     This is a NON-ADMITTED (surplus lines / E&S) platform for every line
     except Workers' Compensation (491) — see D.tenants, where every carrier
     is flagged nonAdmitted, and D.lobs' note on WC's licenceBasis for why
     that one line is the exception rather than a blanket claim. */
  D.products = [
    { id: 1, code: "DTP", name: "Digital Trucking Program", lob: "Commercial Trucking", cob: ["Auto Liability", "Physical Damage", "Motor Truck Cargo"], states: 50, version: "v2026.03", status: "Active", owner: "J. Romero", updated: "2026-07-28", quotes: 428, gwp: 3620000, appTypeId: 483, raterType: "Custom" },
    { id: 3, code: "NTA", name: "VeriDex Non-Trucking Auto", lob: "Commercial Trucking", cob: ["Auto Liability"], states: 50, version: "v2025.09", status: "Active", owner: "J. Romero", updated: "2026-05-02", quotes: 94, gwp: 385000, appTypeId: 483, raterType: "Custom" },
    { id: 4, code: "GLSTD", name: "Standard GL Program", lob: "General Liability", cob: ["Premises / Operations", "Products / Completed Operations"], states: 50, version: "v2025.10", status: "Active", owner: "S. Patel", updated: "2026-07-22", quotes: 512, gwp: 2870000, appTypeId: 499, raterType: "Custom" },
    { id: 5, code: "GLPKG", name: "VeriDex GL Package", lob: "General Liability", cob: ["Premises / Operations", "Liquor Liability"], states: 38, version: "v2026.02", status: "Active", owner: "S. Patel", updated: "2026-07-19", quotes: 267, gwp: 1490000, appTypeId: 496, raterType: "Custom" },
    { id: 6, code: "CPBG", name: "Commercial Property — Building Group", lob: "Commercial Property", cob: ["Building", "Business Personal Property", "Business Income"], states: 46, version: "v2026.01", status: "Active", owner: "S. Patel", updated: "2026-07-26", quotes: 341, gwp: 2110000, appTypeId: 492, raterType: "Custom" },
    { id: 7, code: "CPSCL", name: "Commercial Property — Special Class", lob: "Commercial Property", cob: ["Property", "Extra Expense"], states: 41, version: "v2026.01", status: "Active", owner: "S. Patel", updated: "2026-07-26", quotes: 128, gwp: 760000, appTypeId: 492, raterType: "Custom" },
    { id: 8, code: "MPL", name: "VeriDex MPL Select", lob: "Professional Liability (MPL)", cob: ["Misc Professional Liability"], states: 50, version: "v2024.12", status: "Active", owner: "M. Alvarez", updated: "2026-06-30", quotes: 219, gwp: 640000, appTypeId: 497, raterType: "Custom" },
    { id: 9, code: "CYBER", name: "VeriDex CyberShield", lob: "Cyber", cob: ["Liability", "Breach Response", "Cyber Crime", "Business Loss"], states: 50, version: "v2026.05", status: "Active", owner: "M. Alvarez", updated: "2026-07-31", quotes: 173, gwp: 520000, appTypeId: 1102, raterType: "Custom" },
    { id: 10, code: "UMB", name: "VeriDex Umbrella Advantage", lob: "Umbrella / Excess", cob: ["Excess Liability"], states: 50, version: "v2026.07-draft", status: "Draft", owner: "J. Romero", updated: "2026-07-10", quotes: 0, gwp: 0, appTypeId: 495, raterType: "Custom" },
    { id: 11, code: "WCPROG", name: "VeriDex Workers' Comp Program", lob: "Workers' Compensation", cob: ["Workers' Compensation"], states: 46 /* overridden below: real ND/OH/WA/WY monopolistic-fund exclusion, not a slice */, version: "v2026.08", status: "Active", owner: "M. Alvarez", updated: "2026-08-15", quotes: 0, gwp: 0, appTypeId: 491, raterType: "Custom" },
  ];
  /* ---------------- Product licence basis ----------------
     Which paper a PRODUCT is written on. This sits on the product, not the
     line, because the same carrier group routinely writes one trucking
     program on admitted paper and another on E&S — the line itself is not
     inherently one or the other. It decides two real money items: the
     surplus-lines premium tax and the surplus-lines filing fee, neither of
     which an admitted carrier owes.

     Left UNSET on every product here, which means "inherit" — the engine
     falls back to the line's own basis (Workers' Compensation is
     statutorily admitted) and then to the writing carrier's licence. Set it
     on a product to override, e.g. an admitted trucking program.

     One rule is not overridable: a statutorily admitted line stays admitted
     whatever a product says, because no private surplus-lines carrier can
     write it standalone. See isAdmitted() in engine.js. */
  D.productLicenceOptions = ["", "Admitted", "Surplus Lines"];

  /* ---------------- Rating version by transaction type ----------------
     New business, renewals and endorsements do not have to rate on the same
     version, and often shouldn't: a carrier can put new business on its
     latest filing while renewals stay on the prior one for a transition
     period, and endorsements normally rate on whatever was in force when the
     policy incepted.

     Left EMPTY on every product, which means "resolve by date" — the normal
     behaviour (see resolveRatingAsOf / resolveRatingVersion in engine.js,
     which already rate an endorsement on its original inception date). Set
     one to pin that transaction type to a specific version regardless of
     date. Same value in all three is perfectly valid and simply says so
     explicitly. */
  D.productTransactionTypes = [
    { key: "new", label: "New Business", policyType: "New Business" },
    { key: "renewal", label: "Renewal", policyType: "Renewal" },
    { key: "endorsement", label: "Endorsement", policyType: "Endorsement" },
  ];
  D.products.forEach(p => { if (!p.versionByTransaction) p.versionByTransaction = { new: "", renewal: "", endorsement: "" }; });
  D.products = loadPersisted("vxProductsState", D.products);

  /* ---------------- Program parameters [REAL from workbooks] ---------------- */
  D.programParams = [
    { id: 1, lob: "Commercial Trucking", param: "Liability LCM", value: 1.67, src: "ProgramDeviations" },
    { id: 2, lob: "Commercial Trucking", param: "Target Loss Ratio", value: 0.60, src: "ProgramDeviations" },
    { id: 3, lob: "Commercial Trucking", param: "Deductible Factor Adj", value: 0.75, src: "ProgramDeviations" },
    { id: 4, lob: "Commercial Trucking", param: "Selected Loss Trend", value: 0.07, src: "Trend" },
    { id: 5, lob: "Commercial Trucking", param: "APD Absolute Minimum Rate", value: 0.0475, src: "HelperTables" },
    { id: 6, lob: "Commercial Trucking", param: "Account Factor Min", value: 0.85, src: "Insured" },
    { id: 7, lob: "Commercial Trucking", param: "Account Factor Max", value: 1.50, src: "Insured" },
    { id: 8, lob: "Professional Liability (MPL)", param: "LCM Factor", value: 1.538, src: "RatingMod" },
    { id: 9, lob: "Professional Liability (MPL)", param: "Minimum Premium", value: 750, src: "RatingMod" },
    { id: 10, lob: "Professional Liability (MPL)", param: "Max UW Credit", value: -0.25, src: "Rater" },
    { id: 11, lob: "Commercial Property", param: "LCM", value: 1.923077, src: "ProgramParameters" },
    { id: 12, lob: "Commercial Property", param: "Target Loss Ratio", value: 0.52, src: "ProgramParameters" },
    { id: 13, lob: "Commercial Property", param: "Carrier UW Expense + Profit", value: 0.48, src: "ProgramParameters" },
    { id: 14, lob: "Commercial Property", param: "Reinsurer Margin", value: 0.50, src: "ProgramParameters" },
    { id: 15, lob: "Commercial Property", param: "Reinsurer/Carrier Provision", value: 1.04, src: "ProgramParameters" },
    { id: 16, lob: "General Liability", param: "Experience Mod Floor", value: 0.90, src: "ExperienceRatingMod" },
    { id: 17, lob: "Cyber", param: "Base Rate Deviation", value: 1.15, src: "Program Deviations" },
    /* Target Loss Ratio for GL, MPL and Cyber — illustrative, not filed. Only
       Trucking (0.60) and Property (0.52) above are real, sourced values.
       Added so the Loss Run Dashboard has a target to compare every line
       against; src: "Illustrative" marks these apart from the real ones. */
    { id: 18, lob: "General Liability", param: "Target Loss Ratio", value: 0.58, src: "Illustrative" },
    { id: 19, lob: "Professional Liability (MPL)", param: "Target Loss Ratio", value: 0.55, src: "Illustrative" },
    { id: 20, lob: "Cyber", param: "Target Loss Ratio", value: 0.45, src: "Illustrative" },
    /* Workers' Comp bounds. The ±25% schedule-rating band is a real NCCI
       convention (most state schedule-rating plans cap at ±25%); the
       experience-mod floor/ceiling is illustrative — real mods are computed
       by NCCI/state bureaus from an account's own loss history and can
       exceed 2.00 for a genuinely bad risk, but no bureau-computed mod table
       ships with this platform (the same "we don't have the source" gap as
       everywhere else) so it is captured as a direct underwriter input,
       clamped to a sane illustrative range rather than left unbounded. */
    { id: 21, lob: "Workers' Compensation", param: "Schedule Credit Min", value: -0.25, src: "NCCI convention" },
    { id: 22, lob: "Workers' Compensation", param: "Schedule Credit Max", value: 0.25, src: "NCCI convention" },
    { id: 23, lob: "Workers' Compensation", param: "Experience Mod Min", value: 0.60, src: "Illustrative" },
    { id: 24, lob: "Workers' Compensation", param: "Experience Mod Max", value: 3.00, src: "Illustrative" },
    { id: 25, lob: "Workers' Compensation", param: "Minimum Premium", value: 500, src: "Illustrative" },
    { id: 26, lob: "Workers' Compensation", param: "Target Loss Ratio", value: 0.65, src: "Illustrative" },
  ];

  /* ---------------- MPL factor tables [REAL] ---------------- */
  D.mplHazardGroups = [
    { id: 1, hg: 1, desc: "Very Low Risk", factor: 0.60 },
    { id: 2, hg: 2, desc: "Low Risk", factor: 0.80 },
    { id: 3, hg: 3, desc: "Moderate Risk", factor: 1.00 },
    { id: 4, hg: 4, desc: "High Risk", factor: 1.45 },
    { id: 5, hg: 5, desc: "Very High Risk", factor: 2.75 },
  ];
  D.mplYIP = [
    { id: 1, yip: "1st", factor: 0.65 }, { id: 2, yip: "2nd", factor: 0.75 },
    { id: 3, yip: "3rd", factor: 0.85 }, { id: 4, yip: "4th or More", factor: 1.00 },
  ];
  D.mplALAE = [
    { id: 1, treatment: "Defense Within Limits", factor: 1.00 },
    { id: 2, treatment: "Defense Outside Limits", factor: 1.30 },
  ];
  D.mplILF = [
    { id: 1, limit: 100000, ilf: 1.000 }, { id: 2, limit: 200000, ilf: 1.286 },
    { id: 3, limit: 300000, ilf: 1.472 }, { id: 4, limit: 500000, ilf: 1.715 },
    { id: 5, limit: 1000000, ilf: 2.048 }, { id: 6, limit: 2000000, ilf: 2.386 },
  ];
  D.mplRetention = [
    { id: 1, retention: 1000, factor: 0.000 }, { id: 2, retention: 2500, factor: 0.035 },
    { id: 3, retention: 5000, factor: 0.061 }, { id: 4, retention: 10000, factor: 0.098 },
    { id: 5, retention: 25000, factor: 0.164 }, { id: 6, retention: 50000, factor: 0.221 },
  ];

  /* ---------------- Trucking factor tables [REAL] ---------------- */
  D.truckPrimary = [
    ["011","Light, Service, Local Truck",1.15],["012","Light, Service, Intermediate",1.53],["013","Light, Service, Long Distance",1.50],
    ["021","Light, Retail, Local",1.60],["022","Light, Retail, Intermediate",2.13],["023","Light, Retail, Long Distance",2.07],
    ["031","Light, Commercial, Local",1.29],["032","Light, Commercial, Intermediate",1.71],["033","Light, Commercial, Long Distance",1.67],
    ["211","Medium Truck - Local",1.18],["212","Medium Truck - Intermediate",1.58],["221","Medium Truck - Retail Local",1.64],
    ["222","Medium Truck - Retail Intermediate",2.19],["231","Medium Truck - Commercial Local",1.32],["232","Medium Truck - Commercial Intermediate",1.76],
    ["311","Heavy Truck-Tractor - Local",1.16],["312","Heavy Truck-Tractor - Intermediate",1.62],["321","Heavy Truck-Tractor - Long Distance A",1.62],
    ["322","Heavy Truck-Tractor - Long Distance B",2.25],["331","Heavy Truck-Tractor - Long Distance C",1.31],["332","Heavy Truck-Tractor - Long Distance D",1.80],
    ["341","Extra-Heavy Truck-Tractor - Local",1.53],["342","Extra-Heavy Truck-Tractor - Intermediate",2.04],
    ["351","Extra-Heavy TT - Long Distance A",2.13],["352","Extra-Heavy TT - Long Distance B",2.63],
    ["361","Extra-Heavy TT - Long Distance C",1.71],["362","Extra-Heavy TT - Long Distance D",2.28],
    ["401","Extra-Heavy TT - Interstate A",2.12],["402","Extra-Heavy TT - Interstate B",2.62],
    ["501","Extra-Heavy TT - Special Hauling A",2.00],["502","Extra-Heavy TT - Special Hauling B",2.66],
    ["671","Service/Utility Trailer",0.18],["672","Semi-Trailer",0.23],["681","Service/Utility Trailer Alt",0.09],
    ["682","Semi-Trailer (aligned 672)",0.23],["691","Service/Utility Trailer Alt 2",0.21],["692","Semi-Trailer (aligned 672)",0.23],
    ["7381","PPT - Sedan",1.00],["7382","PPT - SUV",1.09],["7383","PPT - Van",1.09],["7386","PPT - Pickup Light",1.47],
    ["7387","PPT - Pickup Medium",1.61],["7388","PPT - Pickup Heavy",1.64],["7391","PPT - Cargo Van",1.15],
    ["7392","PPT - Long Distance A",2.23],["7393","PPT - Long Distance B",2.42],["7394","PPT - Long Distance C",2.45],
    ["7398","PPT - Misc A",1.15],["7399","PPT - Misc B",0.92],
  ].map(([code, desc, f], i) => ({ id: i + 1, code, desc, liability: f,
    category: f < 0.3 ? "Trailer" : (+code >= 7000 ? "Private Passenger Type" : "Truck / Truck-Tractor"),
    /* One generation on file. A revision would ADD rows carrying the next
       version's effectiveStart and set effectiveEnd on these, rather than
       overwriting them — see D.tableAsOf. No second generation is seeded
       because no second filing's values are known; inventing one would put
       unfiled numbers in front of a user as though they were rates. */
    ratingVersion: "v2026.03", effectiveStart: "2026-03-01", effectiveEnd: "",
    effectiveDate: "2026-03-01", active: true }));
  /* Fleet Size / OCN "vehicle type" bucket each Primary Class code rolls up
     to (PrimaryClasses!TTT_Fleet_Type_Liab / OCN_Vehicle_Type_Liab) — drives
     which D.truckFleetSize / D.truckOCN curve a vehicle uses. Looked up by
     the Primary Class code directly (see note in engine.js's trucking()
     about the real workbook's ISO-vs-USE code collapse, not replicated here
     since this UI's curated Primary Class list doesn't expose that
     distinction). */
  const FLEET_OCN_MAP = {
    "011":["Light","Light"],"012":["Light","Light"],"013":["Light","Light"],
    "021":["Light","Light"],"022":["Light","Light"],"023":["Light","Light"],
    "031":["Light","Light"],"032":["Light","Light"],"033":["Light","Light"],
    "211":["Medium","Medium"],"212":["Medium","Medium"],"221":["Medium","Medium"],
    "222":["Medium","Medium"],"231":["Medium","Medium"],"232":["Medium","Medium"],
    "311":["Heavy Trucks","Heavy"],"312":["Heavy Trucks","Heavy"],"321":["Heavy Trucks","Heavy"],
    "322":["Heavy Trucks","Heavy"],"331":["Heavy Trucks","Heavy"],"332":["Heavy Trucks","Heavy"],
    "341":["Heavy Truck-Tractors","Heavy Truck-Tractors"],"342":["Heavy Truck-Tractors","Heavy Truck-Tractors"],
    "351":["Heavy Truck-Tractors","Heavy Truck-Tractors"],"352":["Heavy Truck-Tractors","Heavy Truck-Tractors"],
    "361":["Heavy Truck-Tractors","Heavy Truck-Tractors"],"362":["Heavy Truck-Tractors","Heavy Truck-Tractors"],
    "401":["Extra Heavy Trucks","ExtraHeavyTrucks"],"402":["Extra Heavy Trucks","ExtraHeavyTrucks"],
    "501":["Extra Heavy Truck-Tractors","ExtraHeavyTruckTractors"],"502":["Extra Heavy Truck-Tractors","ExtraHeavyTruckTractors"],
    "671":["Semi-trailers","SemiTrailers"],"672":["Semi-trailers","SemiTrailers"],
    "681":["Trailers","Trailers"],"682":["Trailers","Trailers"],
    "691":["Service or Utility Trailers","ServiceUtility"],"692":["Service or Utility Trailers","ServiceUtility"],
  };
  D.truckPrimary.forEach(p => { const m = FLEET_OCN_MAP[p.code]; if (m) { p.fleetType = m[0]; p.ocnType = m[1]; } });

  /* ---------- Primary Class RESOLUTION (the derived-key gap) ----------
     A primary class code is not something an insured supplies — in the real
     system it is the OUTPUT of a composite lookup. ams-service resolves it as

       vehicle.model  -> ins_vehicle_models   -> major_class_code
       vehicle.weight -> ins_vehicle_type_new -> vehicle_type_id
       (class code, type id, radius, vehicle use)
                      -> iso_new_rater_service_radius_primarycode
                      -> primary_code  (+ fleet_type_liability, ocn_vehicle_type)
       primary_code   -> iso_new_rater_primary_factor -> liability_factor

     …and only that LAST step is a flat lookup. This platform previously
     skipped the whole resolution and took the class code as a raw input.

     What is real here vs. not, stated plainly:
       - REAL: the resolution SHAPE above, verified against ams-service's
         own UDFs, and the size/use/radius decomposition below, which is read
         out of each class row's own filed description ("Light, Service,
         Local Truck" genuinely IS size=Light, use=Service, radius=Local).
       - NOT RECOVERABLE: the contents of iso_new_rater_service_radius_-
         primarycode itself. Only its DDL is in source control; the mapping
         rows live in a production database. So this resolves against the
         curated class list's own descriptions rather than that table.
       - CONSEQUENCE: where the filed list carries several variants at one
         (size, use, radius) — the Long Distance A/B/C/D codes — this cannot
         tell them apart, because the inputs that separate them are exactly
         the ones that were not recoverable. Those resolve to the first
         candidate and are reported `ambiguous`, never silently picked. */
  const SIZE_CLASSES = [
    [/^Extra-Heavy (?:TT|Truck-Tractor)/i, "Extra-Heavy Truck-Tractor"],
    [/^Heavy Truck-Tractor/i,              "Heavy Truck-Tractor"],
    [/^Medium Truck/i,                     "Medium Truck"],
    [/^Light/i,                            "Light Truck"],
    [/^PPT/i,                              "Private Passenger Type"],
  ];
  const RADIUS_BANDS = ["Special Hauling", "Interstate", "Long Distance", "Intermediate", "Local"];
  const USE_TYPES = ["Service", "Retail", "Commercial"];
  D.truckPrimary.forEach(p => {
    const hit = SIZE_CLASSES.find(([re]) => re.test(p.desc));
    p.sizeClass = hit ? hit[1] : (p.category === "Trailer" ? "Trailer" : "");
    /* Business use is only a real distinction for power units. "Service/
       Utility Trailer" contains the word Service but is a trailer body
       style, not a service-use truck — reading a use out of it would be
       inventing a distinction the filed list does not draw. */
    p.businessUse = p.category === "Truck / Truck-Tractor"
      ? (USE_TYPES.find(u => new RegExp("[ ,-]" + u, "i").test(p.desc)) || "")
      : "";
    p.radiusBand = p.category === "Trailer"
      ? "" : (RADIUS_BANDS.find(b => new RegExp(b, "i").test(p.desc)) || "");
  });

  /* Radius-of-operation key (what the quote form and the ams-ui submission
     both carry) -> the label the rate table is keyed on. Lives here so the
     engine and every screen read ONE mapping; it was previously a private
     const inside engine.js that other callers had to restate. */
  D.truckRadiusKeyToLabel = {
    "local_200": "Local-200",
    "local_intermediate": "Intermediate-300",
    "12_western": "Statewide-500",
    "48_states": "Regional-1000",
    "long_haul": "Long Haul-1001+",
  };

  /* Radius rows carry their own band in their label ("Local-200",
     "Long Haul-1001+"), so the quote's radius selection maps to a resolution
     band without a second invented table. */
  D.truckRadiusBand = label => {
    const l = String(label || "");
    if (/^Local/i.test(l)) return "Local";
    if (/^Intermediate/i.test(l)) return "Intermediate";
    return "Long Distance";   // Statewide / Regional / Long Haul
  };

  /* The resolver. Returns the resolution CHAIN, not just an answer, so the
     rating trace can show how the class was arrived at — and so an ambiguous
     resolution is visible rather than looking like a determined one. */
  D.truckPrimaryResolve = (sizeClass, businessUse, radiusBand, asOf) => {
    const pool = D.tableAsOf(D.truckPrimary, asOf)
      .filter(p => p.sizeClass === sizeClass);
    let cands = pool;
    if (businessUse) {
      const byUse = cands.filter(p => p.businessUse === businessUse);
      if (byUse.length) cands = byUse;
    }
    if (radiusBand) {
      const byRad = cands.filter(p => p.radiusBand === radiusBand);
      if (byRad.length) cands = byRad;
    }
    if (!cands.length) return { row: null, candidates: [], ambiguous: false, resolved: false };
    return { row: cands[0], candidates: cands, ambiguous: cands.length > 1, resolved: true,
      key: [sizeClass, businessUse || "—", radiusBand || "—"].join(" / ") };
  };
  /* Every size class a vehicle may be assigned, for the quote form's picker —
     read off the class list itself so the two can never drift apart. */
  D.truckSizeClasses = [...new Set(D.truckPrimary.map(p => p.sizeClass).filter(Boolean))];
  D.truckBusinessUses = USE_TYPES.slice();

  D.truckAge = [
    ["Current Model Year",0,1.04,0.92],["1st Preceding",1,1.08,0.99],["2nd Preceding",2,1.10,1.03],["3rd Preceding",3,1.12,1.07],
    ["4th Preceding",4,1.13,1.09],["5th Preceding",5,1.09,1.06],["6th Preceding",6,1.05,1.03],["7th Preceding",7,1.02,1.00],
    ["8th Preceding",8,1.00,1.00],["9th Preceding",9,1.00,1.00],["10th Preceding",10,1.00,1.00],["15th Preceding",15,1.00,1.00],
    ["20th Preceding",20,1.00,1.00],["27th & Older",27,1.00,1.00],
  ].map(([label, age, ttt, ppt], i) => ({ id: i + 1, label, vehicleAge: age, tttLiability: ttt, pptLiability: ppt, effectiveDate: "2026-03-01", active: true }));

  /* Fleet Size Factor — CA_Fleet_TTT, one curve per "TTT_Fleet Type_Liab" bucket
     (PrimaryClasses column), banded by count of rated Power Units of that same
     bucket. Previously this was a single curve mislabeled "FleetOCN" that
     conflated Fleet Size with the separate, value-banded OCN factor below. */
  const FLEET_BANDS = ["1","2","3 to 4","5 to 9","10 to 14","15 to 19","20 to 29","30 to 39","40 to 49","50 to 59","60 to 69","70 to 79","80 to 89","90 to 99","100 to 114","115 to 129","130 to 154","155 to 194","195 to 289","290 or greater"];
  const FLEET_MINMAX = [[1,1],[2,2],[3,4],[5,9],[10,14],[15,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,89],[90,99],[100,114],[115,129],[130,154],[155,194],[195,289],[290,100000]];
  const FLEET_CURVES = {
    "Light": [0.92,0.97,1.02,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Medium": [0.97,0.98,1.00,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Heavy Trucks": [0.97,0.98,1.00,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Heavy Truck-Tractors": [1.03,1.04,1.04,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Extra Heavy Trucks": [1.03,1.04,1.04,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Extra Heavy Truck-Tractors": [1.05,1.04,1.04,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Semi-trailers": [0.84,0.89,0.94,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Trailers": [0.84,0.89,0.94,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061,1.061],
    "Service or Utility Trailers": [0.92,0.97,1.02,1.08,1.13,1.16,1.18,1.16,1.16,1.15,1.14,1.14,1.13,1.13,1.13,1.12,1.12,1.11,1.10,1.08],
  };
  D.truckFleetSize = [];
  { let id = 1; Object.entries(FLEET_CURVES).forEach(([type, factors]) => {
    factors.forEach((f, i) => D.truckFleetSize.push({ id: id++, vehicleType: type, label: FLEET_BANDS[i],
      min: FLEET_MINMAX[i][0], max: FLEET_MINMAX[i][1], factor: f,
      ratingVersion: "v2026.03", effectiveStart: "2026-03-01", effectiveEnd: "" })); }); }

  /* OCN Factor — CA_OCN_Liability, value-banded (vehicle stated value), one
     column per "OCN_Vehicle Type_Liab" bucket. Was entirely missing before. */
  const OCN_BANDS = [[0,999],[1000,1999],[2000,2999],[3000,3999],[4000,4999],[5000,5999],[6000,7999],[8000,9999],[10000,11999],[12000,13999],[14000,15999],[16000,17999],[18000,19999],[20000,24999],[25000,29999],[30000,34999],[35000,39999],[40000,44999],[45000,49999],[50000,54999],[55000,64999],[65000,74999],[75000,84999],[85000,99999],[100000,114999],[115000,129999],[130000,149999],[150000,174999],[175000,199999],[200000,229999],[230000,259999],[260000,299999],[300000,349999],[350000,399999],[400000,449999],[450000,499999],[500000,599999],[600000,699999],[700000,799999],[800000,899999],[900000,10000000]];
  const OCN_COLS = { Light:[0.57,0.63,0.7,0.74,0.77,0.8,0.83,0.86,0.88,0.91,0.93,0.94,0.96,0.98,1.01,1.04,1.06,1.08,1.1,1.11,1.13,1.16,1.18,1.21,1.23,1.26,1.28,1.31,1.34,1.36,1.39,1.42,1.45,1.48,1.5,1.53,1.55,1.59,1.63,1.66,1.69],
    Medium:[0.55,0.61,0.67,0.71,0.74,0.77,0.8,0.83,0.86,0.88,0.9,0.91,0.93,0.95,0.98,1.0,1.02,1.04,1.06,1.08,1.1,1.12,1.15,1.17,1.19,1.22,1.24,1.27,1.29,1.32,1.34,1.37,1.4,1.43,1.45,1.48,1.5,1.54,1.58,1.61,1.63],
    Heavy:[0.52,0.58,0.64,0.68,0.71,0.73,0.76,0.79,0.81,0.83,0.85,0.87,0.88,0.9,0.93,0.95,0.97,0.99,1.01,1.02,1.04,1.07,1.09,1.11,1.14,1.16,1.18,1.2,1.23,1.25,1.28,1.3,1.33,1.36,1.38,1.4,1.43,1.47,1.5,1.53,1.55],
    ExtraHeavyTrucks:[0.78,0.81,0.84,0.85,0.87,0.88,0.89,0.9,0.91,0.92,0.92,0.93,0.93,0.94,0.95,0.96,0.97,0.97,0.98,0.98,0.99,1.0,1.0,1.01,1.02,1.02,1.03,1.04,1.05,1.05,1.06,1.07,1.07,1.08,1.09,1.09,1.1,1.11,1.12,1.13,1.13],
    "Heavy Truck-Tractors":[0.51,0.56,0.62,0.66,0.69,0.71,0.74,0.77,0.79,0.81,0.83,0.85,0.86,0.88,0.91,0.93,0.95,0.97,0.98,1.0,1.02,1.04,1.06,1.08,1.11,1.13,1.15,1.17,1.2,1.22,1.24,1.27,1.29,1.32,1.35,1.37,1.39,1.43,1.46,1.49,1.51],
    ExtraHeavyTruckTractors:[0.79,0.81,0.84,0.86,0.87,0.88,0.89,0.9,0.91,0.92,0.93,0.93,0.94,0.95,0.96,0.96,0.97,0.98,0.98,0.99,0.99,1.0,1.01,1.01,1.02,1.03,1.03,1.04,1.05,1.06,1.06,1.07,1.08,1.09,1.09,1.1,1.11,1.11,1.12,1.13,1.14],
    SemiTrailers:[0.42,0.53,0.66,0.75,0.82,0.88,0.95,1.04,1.11,1.17,1.23,1.28,1.33,1.4,1.49,1.57,1.64,1.71,1.77,1.83,1.91,2.01,2.1,2.19,2.3,2.4,2.5,2.62,2.74,2.86,2.98,3.1,3.25,3.4,3.54,3.66,3.81,4.03,4.22,4.4,4.56],
    Trailers:[0.42,0.53,0.66,0.75,0.82,0.88,0.95,1.04,1.11,1.17,1.23,1.28,1.33,1.4,1.49,1.57,1.64,1.71,1.77,1.83,1.91,2.01,2.1,2.19,2.3,2.4,2.5,2.62,2.74,2.86,2.98,3.1,3.25,3.4,3.54,3.66,3.81,4.03,4.22,4.4,4.56],
    ServiceUtility:[0.54,0.67,0.83,0.95,1.04,1.11,1.21,1.32,1.41,1.49,1.56,1.62,1.68,1.77,1.89,1.99,2.09,2.17,2.25,2.32,2.43,2.55,2.66,2.78,2.92,3.04,3.17,3.32,3.48,3.63,3.78,3.94,4.12,4.31,4.49,4.65,4.84,5.11,5.36,5.58,5.79],
    PPT:[1.26,1.21,1.17,1.14,1.12,1.11,1.09,1.07,1.06,1.05,1.04,1.03,1.03,1.02,1.01,1.0,0.99,0.98,0.97,0.97,0.96,0.95,0.95,0.94,0.93,0.92,0.92,0.91,0.9,0.89,0.89,0.88,0.87,0.87,0.86,0.85,0.85,0.84,0.83,0.83,0.82] };
  D.truckOCN = [];
  { let id = 1; OCN_BANDS.forEach(([min, max], i) => {
    Object.entries(OCN_COLS).forEach(([type, col]) => D.truckOCN.push({ id: id++, vehicleType: type, min, max, factor: col[i] })); }); }

  D.truckRadius = [
    { id: 1, category: "Local-Intermediate", label: "Local-200", distance: "0 - 200 Miles", liabilityFactor: 0.95, apdFactor: 0.95 },
    { id: 2, category: "Local-Intermediate", label: "Intermediate-300", distance: "0 - 300 Miles", liabilityFactor: 1.00, apdFactor: 1.00 },
    { id: 3, category: "Long Distance", label: "Statewide-500", distance: "0 - 500 Miles", liabilityFactor: 1.10, apdFactor: 1.10 },
    { id: 4, category: "Long Distance", label: "Regional-1000", distance: "0 - 1,000 Miles", liabilityFactor: 1.15, apdFactor: 1.125 },
    { id: 5, category: "Long Distance", label: "Long Haul-1001+", distance: "1,001+ Miles", liabilityFactor: 1.20, apdFactor: 1.15 },
  ];
  D.truckRatingClass = [
    { id: 1, ratingClass: "Auto or Boat Hauling", factor: 1.30 },
    { id: 2, ratingClass: "Container/Intermodal Hauling", factor: 1.05 },
    { id: 3, ratingClass: "Courier-Specialized Delivery", factor: 1.00 },
    { id: 4, ratingClass: "Agricultural Goods Hauling", factor: 1.05 },
    { id: 5, ratingClass: "Dry Van or Box - Double Trailer", factor: 1.136 },
    { id: 6, ratingClass: "Dry Van or Box - Single Trailer", factor: 1.00 },
    { id: 7, ratingClass: "Sand & Gravel Dumping", factor: 1.30 },
    { id: 8, ratingClass: "Dumping - Coal", factor: 1.30 },
    { id: 9, ratingClass: "Flatbed", factor: 1.15 },
    { id: 10, ratingClass: "Livestock", factor: 1.15 },
    { id: 11, ratingClass: "Log or Pulp Hauling", factor: 1.25 },
    { id: 12, ratingClass: "Mobile Home Hauling", factor: 1.55 },
    { id: 13, ratingClass: "Refrigerated Goods", factor: 1.10 },
    { id: 14, ratingClass: "Special Type Operations - Oversize/Overweight (STP)", factor: 1.40 },
    { id: 15, ratingClass: "Tanker - Fuel", factor: 1.20 },
    { id: 16, ratingClass: "Tanker - Liquids or Compressed Gases", factor: 1.20 },
    { id: 17, ratingClass: "Towing and Recovery - Loaded GVW 20,000 or less", factor: 1.50 },
    { id: 18, ratingClass: "Towing and Recovery - Loaded GVW 20,001-45,000", factor: 1.55 },
    { id: 19, ratingClass: "Towing and Recovery - Loaded GVW over 45,000", factor: 1.65 },
    { id: 20, ratingClass: "Waste or Garbage", factor: 1.55 },
    { id: 21, ratingClass: "Oilfield Equipment (STP)", factor: 1.40 },
    { id: 22, ratingClass: "Roll-Offs (For hire and Commercial only)", factor: 1.30 },
    { id: 23, ratingClass: "Concrete Pumpers, Redi-Mix, Mix-in-Transit (STP)", factor: 1.50 },
    { id: 24, ratingClass: "Frac Sand - Clean (STP)", factor: 1.40 },
    { id: 25, ratingClass: "Frac Sand - Dirty (STP)", factor: 1.60 },
    { id: 26, ratingClass: "Hot Shots (Dually Pickups only)", factor: 2.00 },
    { id: 27, ratingClass: "Hay, Grain, Feed Haulers", factor: 1.05 },
    { id: 28, ratingClass: "Private Fleets (Not for Hire)", factor: 1.00 },
    { id: 29, ratingClass: "Dirty Dirt", factor: 1.40 },
  ];
  D.truckDashcam = [
    { id: 1, option: "NO Dashcams", factor: 1.20 },
    { id: 2, option: "YES - Non-Preferred Vendor", factor: 1.00 },
    { id: 3, option: "YES - Preferred Vendor", factor: 0.95 },
  ];
  /* Miles Driven Factor — Table58, keyed by BOTH radius category and mileage
     band (previously a single curve applied regardless of radius). */
  D.truckMiles = [
    { id: 1, radiusCategory: "Local-Intermediate", label: "0 - 25,000", min: 0, max: 25000, factor: 0.95 },
    { id: 2, radiusCategory: "Local-Intermediate", label: "25,001 - 50,000", min: 25001, max: 50000, factor: 0.97 },
    { id: 3, radiusCategory: "Local-Intermediate", label: "50,001 - 75,000", min: 50001, max: 75000, factor: 1.00 },
    { id: 4, radiusCategory: "Local-Intermediate", label: "75,001 - 100,000", min: 75001, max: 100000, factor: 1.03 },
    { id: 5, radiusCategory: "Local-Intermediate", label: "100,001 - 125,000", min: 100001, max: 125000, factor: 1.05 },
    { id: 6, radiusCategory: "Local-Intermediate", label: "125,001 - 150,000", min: 125001, max: 150000, factor: 1.08 },
    { id: 7, radiusCategory: "Local-Intermediate", label: "150,001+", min: 150001, max: 99999999, factor: 1.10 },
    { id: 8, radiusCategory: "Long Distance", label: "0 - 25,000", min: 0, max: 25000, factor: 0.93 },
    { id: 9, radiusCategory: "Long Distance", label: "25,001 - 50,000", min: 25001, max: 50000, factor: 0.95 },
    { id: 10, radiusCategory: "Long Distance", label: "50,001 - 75,000", min: 50001, max: 75000, factor: 0.97 },
    { id: 11, radiusCategory: "Long Distance", label: "75,001 - 100,000", min: 75001, max: 100000, factor: 0.98 },
    { id: 12, radiusCategory: "Long Distance", label: "100,001 - 125,000", min: 100001, max: 125000, factor: 1.00 },
    { id: 13, radiusCategory: "Long Distance", label: "125,001 - 150,000", min: 125001, max: 150000, factor: 1.05 },
    { id: 14, radiusCategory: "Long Distance", label: "150,001+", min: 150001, max: 99999999, factor: 1.10 },
  ];
  D.truckLiabDed = [0,1000,2500,5000,10000,20000,25000,50000,75000,100000]
    .map((a, i) => ({ id: i + 1, deductibleType: "Combined Single Limit", amount: a, factor: [0,.038,.083,.138,.209,.298,.332,.451,.527,.585][i] }));
  /* APD base rate by stated value — PhysDamRatesByTIV!A:G ("AVERAGED"
     column), approximate-match lookup. Real table has 296 rows; thinned to
     every ~10th here (same representative-sample pattern as elsewhere) —
     it's a smooth, near-monotonic curve that floors at APDMinRate (0.0475)
     around $230k, so thinning doesn't lose the shape. */
  D.truckPhysDamRate = [
    [5000,0.124573],[15000,0.080595],[25000,0.065850],[35000,0.057428],[45000,0.053000],
    [55000,0.053000],[65000,0.052000],[75000,0.051000],[85000,0.050500],[95000,0.050000],
    [105000,0.049500],[115000,0.049500],[125000,0.049000],[135000,0.048500],[145000,0.048500],
    [155000,0.047500],[165000,0.047500],[175000,0.047500],[185000,0.047500],[195000,0.047500],
    [205000,0.047500],[215000,0.047500],[225000,0.047500],[235000,0.047500],[245000,0.047500],
    [255000,0.047500],[265000,0.047500],[275000,0.047500],[285000,0.047500],[295000,0.047500],
    [300000,0.047500],
  ];
  /* APD Deductible Factor — DeductFctr_ALT (PhysDamRatesByTIV!J1:L8). Was
     entirely missing before — engine.js had no APD deductible input at all. */
  D.truckApdDed = [1000,2500,5000,7500,10000,15000,20000]
    .map((a, i) => ({ id: i + 1, amount: a, factor: [1.0,0.925,0.875,0.85,0.825,0.8,0.775][i] }));
  /* APD State Factor — Table9 (0.95 every state except CA=1.0). */
  D.truckApdState = { CA: 1.0, DEFAULT: 0.95 };
  /* APD Package Factor — Table11 (bundling Liability + APD on one vehicle). */
  D.truckApdPackage = { yes: 0.9, no: 1.0 };
  /* Secondary Class Factor — CA_SecondaryFactors. Every "Trucks, Tractors And
     Trailers" secondary-class option in the real Vehicles-tab dropdown maps
     to the same Liability factor (1.98) — verified against all 11 codes. */
  D.truckSecondaryFactor = 1.98;
  /* NAICS Industry Factor — CA_NAICS_TTT. All 5 real trucking NAICS codes
     currently on file carry the same Liability factor (1.10). */
  D.truckNAICS = [
    { code: "484110", label: "General Freight Trucking, Local", factor: 1.10 },
    { code: "484121", label: "General Freight Trucking, Long-Distance, Truckload", factor: 1.10 },
    { code: "484122", label: "General Freight Trucking, Long-Distance, LTL", factor: 1.10 },
    { code: "484220", label: "Specialized Freight Trucking, Local", factor: 1.10 },
    { code: "484230", label: "Specialized Freight Trucking, Long-Distance", factor: 1.10 },
  ];
  /* Tort Limitation Factor — Helper_CovTypesOptions_Liab. 1.0 in every state
     sampled except NJ's "tort limitation eliminated" election (1.333), which
     isn't exposed as a UI option here — so this is a constant for now. */
  D.truckTortFactor = 1.0;

  /* ======================================================================
     Factors confirmed present in the production rater (app_type 483) but not
     previously modelled here. Found by reconciling a real rated payload:
     feeding its own factor values through this engine's chain reproduced its
     `al_premium_wo_mod_factor` exactly (33,010.514), and the residual to its
     `liability_premium` (31,360) was one unmodelled term.

     Each is DERIVED FROM AN INPUT, not read from a payload — a rating request
     carries the answer (ownership, pollution grade, use type), and the engine
     looks up the factor. Where a row's value is confirmed by that payload it
     is marked verified; the rest are representative and clearly labelled,
     because the filed tables behind them are not in the extract.

     Neutral-when-absent is deliberate: a request that does not supply the
     answer gets 1.000 rather than a guessed default, so adding these factors
     cannot silently move an existing quote.
     ====================================================================== */

  /* Vehicle Ownership. The residual term above: 33,010.514 x 0.95 = 31,359.988,
     which the payload rounds to its liability_premium. That vehicle carries
     ownership "Owned", so 0.95 is a confirmed filed value. */
  D.truckOwnership = [
    { id: 1, option: "Owned",           factor: 0.95, verified: true,
      note: "Confirmed against a rated production payload (vehicle 903139)." },
    { id: 2, option: "Owner-Operator",  factor: 1.00, verified: false },
    { id: 3, option: "Leased",          factor: 1.00, verified: false },
    { id: 4, option: "Non-Owned",       factor: 1.05, verified: false },
    { id: 5, option: "Not specified",   factor: 1.00, verified: true,
      note: "Neutral. No ownership answer supplied means no adjustment." },
  ];

  /* CORRECTED 2026-09-01 against ams-service's real stored procedure —
     public.udf_get_factor_for_iso_new_rater. Two real things were true at
     different times, not one replacing a mistake: a production payload
     observed earlier carried a GRADED al_pollution/al_pollution_factor
     ("Low" -> 1.03), and that observation was genuine. But the stored
     procedure gates its OWN pollution logic on
     `(_lock_rate_date)::date >= ('2026-03-12')` — the graded field predates
     that date; from 2026-03-12 forward the real system replaced it with a
     flat, account-level Yes/No ("broadend_pollution_form") worth a flat
     +10% if answered Yes, folded directly into the account-level factor —
     not a per-vehicle grade lookup at all. Every rating version on this
     platform is dated 2026-03 or later, so the flat, current behaviour is
     what belongs here now. See truckAcctPollution below (account-level,
     engine.js) — this per-vehicle graded table is retired, not reused. */
  D.truckAcctPollution = { yes: 0.10, no: 0 };
  /* Same source, same date gate: "defence_add_back" — a flat +10% Yes/No,
     Liability-only, folded into the account-level factor. Nothing on this
     platform modelled this at all before this correction; it isn't a
     replacement for an existing (wrong) value, it's a real factor that was
     simply missing. */
  D.truckAcctDefenseAddback = { yes: 0.10, no: 0 };

  /* Payment plan. Agency Bill confirmed neutral; the instalment load is
     representative. */
  D.truckPaymentPlan = [
    { id: 1, plan: "Agency Bill",  factor: 1.00, verified: true },
    { id: 2, plan: "Direct Bill",  factor: 1.00, verified: false },
    { id: 3, plan: "Instalments",  factor: 1.02, verified: false },
  ];

  /* Specialised heavy use. Both are 1.000 on a general-freight risk, which is
     why they were invisible until a farm or dump risk was rated. Driven by the
     vehicle's use type, not by a separate answer. */
  D.truckHeavyUse = [
    { id: 1, use: "General Freight", farm: 1.00, dumping: 1.00, verified: true },
    { id: 2, use: "Service",         farm: 1.00, dumping: 1.00, verified: true },
    { id: 3, use: "Farm",            farm: 0.90, dumping: 1.00, verified: false },
    { id: 4, use: "Dump",            farm: 1.00, dumping: 1.15, verified: false },
    { id: 5, use: "Farm and Dump",   farm: 0.90, dumping: 1.15, verified: false },
  ];

  /* CORRECTED 2026-09-01 — same source verification as truckAcctPollution
     above. This platform previously modelled "Driver Criteria Factor" as a
     4-band table DERIVED by inspecting the driver schedule for a young
     (under 23) or inexperienced (under 2yr CDL) driver — a plausible-looking
     invention, not something read off any real source. The real stored
     procedure's `_driver_criteria` is a single account-level UW answer
     ("1Year" or not — not age/CDL-derived at all) worth a flat +15% when
     set, gated the same way (`lock_rate_date >= '2026-03-05'`), folded into
     the account-level factor for BOTH Auto Liability and Physical Damage —
     the one term of the three corrected here that both coverages share. */
  D.truckAcctDriverCriteria = { yes: 0.15, no: 0 };

  /* Loss experience. Derived from the prior-term loss ratio the request
     carries; the bands mirror the shape already used by the experience-mod
     credibility logic. */
  D.truckLossExperience = [
    { id: 1, band: "No prior experience", min: null, max: null, factor: 1.00, verified: true },
    { id: 2, band: "LR <= 30%",  min: 0,    max: 0.30, factor: 0.90, verified: false },
    { id: 3, band: "LR 30-50%",  min: 0.30, max: 0.50, factor: 0.95, verified: false },
    { id: 4, band: "LR 50-70%",  min: 0.50, max: 0.70, factor: 1.00, verified: false },
    { id: 5, band: "LR 70-90%",  min: 0.70, max: 0.90, factor: 1.10, verified: false },
    { id: 6, band: "LR > 90%",   min: 0.90, max: 99,   factor: 1.25, verified: false },
  ];

  /* Underwriter credit/debit is NOT a lookup — it is a judgment value the
     underwriter enters, clamped to the filed band. Stored as the band, not a
     table of options. */
  D.truckUwCreditDebit = { min: 0.75, max: 1.25, neutral: 1.00 };


  /* Real per-state Base Loss Cost (CA_Liab_LC, Trucks/Tractors/Trailers,
     Liability, first territory on file) and Increased Limits Factor
     (ILFs, ILTA=2 "Heavy Trucks And Truck-Tractors") for the states this
     prototype's Quote Portal actually offers. Not the full 1,955/5,217-row
     tables — a representative territory per state, same "sample, not full
     fidelity" pattern already used for the large migrated lookup tables
     elsewhere in this app. */
  D.truckBaseLC = { AK:321, AL:358, AZ:288, CA:196, FL:581, GA:445, IL:313, NC:337, NY:199, OH:226, PA:216, TX:234, DEFAULT:300 };
  D.truckILF = {
    AK: { 500000:1.70, 1000000:2.12, 2000000:2.60 }, AL: { 500000:1.80, 1000000:2.19, 2000000:2.61 },
    AZ: { 500000:1.58, 1000000:1.91, 2000000:2.26 }, CA: { 500000:1.55, 1000000:1.94, 2000000:2.42 },
    FL: { 500000:1.93, 1000000:2.47, 2000000:3.07 }, GA: { 500000:1.70, 1000000:2.12, 2000000:2.60 },
    IL: { 500000:1.76, 1000000:2.22, 2000000:2.74 }, NC: { 500000:1.50, 1000000:1.79, 2000000:2.12 },
    NY: { 500000:1.78, 1000000:2.24, 2000000:2.77 }, OH: { 500000:1.41, 1000000:1.64, 2000000:1.89 },
    PA: { 500000:1.60, 1000000:1.92, 2000000:2.29 }, TX: { 500000:1.66, 1000000:2.06, 2000000:2.50 },
    DEFAULT: { 500000:1.65, 1000000:2.05, 2000000:2.55 },
  };

  /* ---- Account-Level Credits/Debits (Insured tab) ----
     Every one of these is a BANDED DROPDOWN in the source workbook, not a
     free number. That distinction matters: "No Inspections" and "No Loss
     Data" are real selectable answers with a 0.00 factor, and neither can be
     expressed as a percentage. A numeric input silently loses them. */
  D.truckAcctBizExp = [["New Venture",0.20],[1,0.10],[2,0.05],[3,0.01],[4,0.00],[5,-0.03],[6,-0.04],["7+",-0.05]]
    .map(([yrs, f]) => ({ yearsInBusiness: yrs, factor: f }));
  D.truckAcctCarrierSafety = [
    ["Satisfactory",0,-0.05],["Satisfactory",1,0.05],["Satisfactory",2,0.10],["Satisfactory",3,0.25],["Satisfactory","4+",0.40],
    ["None",0,-0.05],["None",1,0.05],["None",2,0.10],["None",3,0.25],["None","4+",0.40],
    ["Conditional",0,0.10],["Conditional",1,0.25],["Conditional",2,0.30],["Conditional",3,0.45],["Conditional","4+",0.60],
  ].map(([rating, alerts, f]) => ({ rating, fmcsaAlerts: alerts, factor: f }));
  /* Table56 — banded, and the two sides use DIFFERENT bands. */
  D.truckAcctOOS = {
    vehicles: [["No Inspections",0.00],["<=10%",-0.05],[">10 and <=15%",-0.02],[">15 and <=20%",0.00],
      [">20 and <=30%",0.02],[">30 and <=40%",0.03],[">40 and <=50%",0.04],[">50%",0.05]]
      .map(([band, factor]) => ({ band, factor })),
    drivers: [["No Inspections",0.00],["<=4%",-0.05],[">4 and <=8%",-0.02],[">8 and <=12%",0.00],
      [">12 and <=18%",0.02],[">18 and <=25%",0.03],[">25 and <=33%",0.04],[">33%",0.05]]
      .map(([band, factor]) => ({ band, factor })),
  };
  /* Table59 — keyed by loss-frequency band AND fleet size. The credit for a
     clean book is bigger on a large fleet, and the debit for a bad one is far
     bigger; a single-dimension lookup understates both ends. */
  D.truckAcctLossFreqBands = ["No Loss Data",">=0% and <=10%",">10 and <=15%",">15 and <=20%",
    ">20% and <=24%",">24% and <=26%",">26% and <=40%",">40% and <=60%",">60%"];
  D.truckAcctUnitBands = [["1 to 5",1,5],["6 to 10",6,10],["11 to 25",11,25],["26 to 49",26,49],["50+",50,99999]]
    .map(([band, min, max]) => ({ band, min, max }));
  D.truckAcctLossFreq = (() => {
    const G = {
      "No Loss Data":      [0.00, 0.00, 0.00, 0.00, 0.00],
      ">=0% and <=10%":    [-0.12,-0.12,-0.15,-0.15,-0.15],
      ">10 and <=15%":     [-0.10,-0.10,-0.10,-0.12,-0.15],
      ">15 and <=20%":     [-0.07,-0.07,-0.05,-0.07,-0.10],
      ">20% and <=24%":    [-0.03,-0.03,-0.03,-0.03,-0.05],
      ">24% and <=26%":    [ 0.00, 0.00, 0.00, 0.00, 0.00],
      ">26% and <=40%":    [ 0.05, 0.05, 0.10, 0.10, 0.10],
      ">40% and <=60%":    [ 0.10, 0.20, 0.30, 0.35, 0.40],
      ">60%":              [ 0.25, 0.40, 0.50, 0.60, 1.00],
    };
    const out = [];
    D.truckAcctLossFreqBands.forEach(band => D.truckAcctUnitBands.forEach((u, i) =>
      out.push({ band, unitBand: u.band, min: u.min, max: u.max, factor: G[band][i] })));
    return out;
  })();
  D.truckAcctICC = { yes: 0.0, no: -0.05 };
  D.truckAcctRenewal = { yes: -0.05, no: 0.0 };
  /* Insured!Z14 — driver licence states. Any foreign licence is a flat debit;
     otherwise a New York concentration is debited on a sliding basis. */
  D.truckAcctLicState = { foreign: 0.15, nyLow: 0.05, nyHigh: 0.20, nyLowMaxShare: 0.25 };
  /* Insured tab dropdowns, taken from the workbook's own lists. */
  D.truckPolicyTypes = ["New Business", "Renewal"];
  D.truckValuationBasis = ["Original Cost New", "Stated Amount"];
  D.truckLiabDeductTypes = ["Combined Single Limit", "Property Damage Per Accident", "None"];

  /* Cargo commodity list — real schema, representative values.
     ams-service (liquibase/core/changelog.sql) has two real Postgres tables
     backing this: iso_new_rater_cargo_commodity_classification_master
     (classification_number, classification_text) and
     iso_new_rater_cargo_classification_factor (state_code,
     classification_number, factor), selected via
     udf_iso_new_rater_highest_classification_factor — a multi-commodity
     cargo quote rates off its HIGHEST (worst) classification factor. No
     seed data ships with that schema, so classificationNumber and every
     factor value below are curated/representative, not extracted from a
     filing — same as this program's other "structure real, values not
     filed" tables. The real commodity master has ~2,215 rows (per the
     production screenshots); this is a curated subset, not the full list.
     Excluded commodities are real cargo exclusions common across the
     market: selecting one blocks the Cargo premium rather than silently
     rating something uncovered. hazardousMod marks a commodity that IS
     coverable but carries a rate load — distinct from excluded (prohibited
     outright). */
  D.truckCargoCommodities = [
    { code: "GENFRT", label: "General Freight / Dry Goods", classificationNumber: 14, excluded: false },
    { code: "BLDGMAT", label: "Building Materials & Construction Supplies", classificationNumber: 22, excluded: false },
    { code: "MACHEQ", label: "Machinery & Industrial Equipment", classificationNumber: 31, excluded: false },
    { code: "RETAIL", label: "Retail / Consumer Merchandise", classificationNumber: 18, excluded: false },
    { code: "FOODBEV", label: "Food & Beverage — Non-Perishable, Packaged", classificationNumber: 14, excluded: false },
    { code: "REEFER", label: "Perishable / Refrigerated Goods", classificationNumber: 27, excluded: false, note: "Rate does not include spoilage/breakdown coverage — write as a separate rider." },
    { code: "FLAMMABLE", label: "Flammable Liquids — Non-Bulk, DOT Placarded", classificationNumber: 41, excluded: false, hazardousMod: true, note: "Coverable at a rate load — distinct from Class 1 explosives (prohibited) below." },
    { code: "LIVESTOCK", label: "Livestock / Live Animals", classificationNumber: 52, excluded: true, reason: "Requires a specific livestock mortality endorsement — standard Cargo does not respond." },
    { code: "HHG", label: "Household Goods (Moving / Storage-in-Transit)", classificationNumber: 53, excluded: true, reason: "Rated under a separate Household Goods program, not standard motor cargo." },
    { code: "VALUABLES", label: "Jewelry, Furs, Precious Metals & Currency", classificationNumber: 54, excluded: true, reason: "Requires a Valuable Papers / Fine Arts rider with its own limits." },
    { code: "HAZMAT", label: "Hazardous Materials (DOT Hazmat Placarded)", classificationNumber: 55, excluded: true, reason: "Requires Environmental Impairment / Pollution Liability coverage, not standard Cargo." },
    { code: "EXPLOSIVES", label: "Explosives (DOT Class 1)", classificationNumber: 56, excluded: true, reason: "Prohibited — no standard or excess market appetite for Class 1 explosives cargo." },
    { code: "RADIOACTIVE", label: "Radioactive / Nuclear Materials (DOT Class 7)", classificationNumber: 57, excluded: true, reason: "Prohibited — nuclear cargo requires specialty nuclear-pool placement, entirely outside this program." },
  ];
  /* iso_new_rater_cargo_classification_factor — (state, classificationNumber) -> factor.
     Representative values (see note above); DEFAULT covers states not listed. */
  const CARGO_CF_BASE = { 14: 0.95, 18: 1.05, 22: 1.10, 27: 1.20, 31: 1.15, 41: 1.45, 52: 1.30, 53: 1.10, 54: 1.55, 55: 1.60, 56: 2.00, 57: 2.00 };
  const CARGO_STATE_ADJ = { CA: 1.05, FL: 1.08, NY: 1.10, TX: 1.00, DEFAULT: 1.00 };
  D.cargoClassificationFactor = [];
  Object.entries(CARGO_STATE_ADJ).forEach(([st, adj]) => {
    Object.entries(CARGO_CF_BASE).forEach(([cn, base]) => {
      D.cargoClassificationFactor.push({ state: st, classificationNumber: +cn, factor: +(base * adj).toFixed(3) });
    });
  });
  D.cargoClassificationFactorFor = (state, classificationNumber) => {
    const row = D.cargoClassificationFactor.find(r => r.state === state && r.classificationNumber === classificationNumber)
      || D.cargoClassificationFactor.find(r => r.state === "DEFAULT" && r.classificationNumber === classificationNumber);
    return row ? row.factor : 1.0;
  };

  /* ---------------- Property factor tables ---------------- */
  D.propConstruction = [
    { id: 1, code: "FRAME", label: "Frame", factor: 1.35 }, { id: 2, code: "JM", label: "Joisted Masonry", factor: 1.10 },
    { id: 3, code: "NC", label: "Non-Combustible", factor: 0.95 }, { id: 4, code: "MNC", label: "Masonry Non-Combustible", factor: 0.85 },
    { id: 5, code: "MFR", label: "Modified Fire Resistive", factor: 0.78 }, { id: 6, code: "FR", label: "Fire Resistive", factor: 0.70 },
  ];
  D.propPPC = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, ppc: i + 1, label: `Protection Class ${i + 1}`, factor: +(0.86 + i * 0.075).toFixed(3) }));
  D.propOccupancy = [
    { id: 1, code: "OFFICE", label: "Office / Mercantile", factor: 0.90 }, { id: 2, code: "WHSE", label: "Warehouse / Distribution", factor: 1.05 },
    { id: 3, code: "MFG", label: "Light Manufacturing", factor: 1.25 }, { id: 4, code: "REST", label: "Restaurant", factor: 1.40 },
    { id: 5, code: "HAB", label: "Habitational / Apartments", factor: 1.18 }, { id: 6, code: "RETAIL", label: "Retail Store", factor: 1.00 },
  ];
  D.propDed = [1000,2500,5000,10000,25000,50000,100000].map((a, i) => ({ id: i + 1, amount: a, factor: [1.15,1.00,0.90,0.80,0.68,0.58,0.48][i] }));
  D.propWindHail = [
    { id: 1, code: "Z1", label: "Zone 1 - Inland", factor: 1.00 },
    { id: 2, code: "Z2", label: "Zone 2 - Coastal Adjacent", factor: 1.35 },
    { id: 3, code: "Z3", label: "Zone 3 - Tier 1 Coastal", factor: 1.90 },
  ];
  D.propIRPM = ["Management","Location","Building Features","Premises And Equipment","Employees","Protection"]
    .map((n, i) => ({ id: i + 1, characteristic: n, minCredit: -0.10, maxDebit: 0.10, selected: 0,
      desc: ["Cooperation in safeguarding and proper handling of property covered","Accessibility, congestion and exposures","Age, condition and unusual structural features","Care, condition and type","Selection, training, supervision and experience","Not otherwise recognized"][i] }));

  /* ---------------- GL factor tables ---------------- */
  D.glSchedRating = ["Location","Premises","Equipment","Classification","Employees","Cooperation","Credit Score/Financial Stability","Crime Score"]
    .map((n, i) => ({ id: i + 1, characteristic: n, minCredit: -0.10, maxDebit: 0.10, selected: 0,
      desc: ["Exposure inside/outside premises","Condition and care of premises","Type, condition and care of equipment","Peculiarities of classification","Selection, training, supervision, experience","Medical facilities & safety program","D&B stress indicator","Habitation / hospitality accounts"][i] }));
  D.glELP = [
    { id: 1, limit: 100000, elp: 0.615 }, { id: 2, limit: 300000, elp: 0.812 }, { id: 3, limit: 500000, elp: 1.000 },
    { id: 4, limit: 1000000, elp: 1.262 }, { id: 5, limit: 2000000, elp: 1.581 }, { id: 6, limit: 5000000, elp: 2.043 },
  ];

  /* ---------------- Cyber factor tables ---------------- */
  D.cyberIndustry = [
    { id: 1, code: "PROF_SVC", label: "Professional Services", factor: 0.85 }, { id: 2, code: "RETAIL", label: "Retail / E-Commerce", factor: 1.10 },
    { id: 3, code: "HEALTH", label: "Healthcare", factor: 1.55 }, { id: 4, code: "FIN", label: "Financial Services", factor: 1.40 },
    { id: 5, code: "MFG", label: "Manufacturing", factor: 0.95 }, { id: 6, code: "EDU", label: "Education", factor: 1.25 },
  ];
  D.cyberMFA = [
    { id: 1, code: "NONE", label: "No MFA", factor: 1.30 }, { id: 2, code: "PARTIAL", label: "Partial MFA", factor: 1.05 }, { id: 3, code: "FULL", label: "Full MFA", factor: 0.80 },
  ];
  D.cyberLimits = [1000000,2000000,3000000,5000000,10000000].map((l, i) => ({ id: i + 1, limit: l, factor: [1.00,1.55,2.05,2.60,4.10][i] }));
  D.cyberRetentions = [10000,25000,50000,100000].map((r, i) => ({ id: i + 1, retention: r, factor: [1.15,1.00,0.88,0.75][i] }));

  /* ---------------- Geography ----------------
     Premium tax and stamping fee are DETERMINISTIC, not generated.

     These reach the premium through assemble(), so a random value here meant
     the same risk could quote differently between page loads and any change
     to unrelated seed data silently shifted every quote. Values below are
     representative published-order surplus-lines rates per state, held in a
     fixed table.

     They are approximations for a sandbox tenant, NOT a compliance source —
     rates vary by admitted vs surplus lines, by line of business, and change
     with filings. Verify against current state filings before production use.
     [rate %, stamping fee %] */
  const TAXRATE = {
    AL:[6.00,0], AK:[2.70,0], AZ:[3.00,0.20], AR:[4.00,0], CA:[3.00,0.18], CO:[3.00,0], CT:[4.00,0],
    DE:[2.00,0], DC:[2.00,0], FL:[4.94,0.06], GA:[4.00,0], ID:[1.50,0.25], IL:[3.50,0.10], IN:[2.50,0],
    IA:[1.00,0], KS:[6.00,0], KY:[3.00,0], LA:[4.85,0], ME:[3.00,0], MD:[3.00,0], MA:[4.00,0],
    MI:[2.00,0.50], MN:[3.00,0.06], MS:[4.00,0.25], MO:[5.00,0], MT:[2.75,0], NE:[3.00,0], NV:[3.50,0.40],
    NH:[3.00,0], NJ:[5.00,0], NM:[3.00,0], NY:[3.60,0.17], NC:[5.00,0], ND:[1.75,0], OH:[5.00,0],
    OK:[6.00,0], OR:[2.00,0.30], PA:[3.00,0.30], RI:[4.00,0], SC:[6.00,0.40], SD:[2.50,0], TN:[5.00,0.40],
    TX:[4.85,0.15], UT:[4.25,0.18], VT:[3.00,0], VA:[2.25,0], WA:[2.00,0.10], WV:[4.55,0], WI:[3.00,0], WY:[3.00,0],
    DEFAULT:[3.00,0],
  };
  /* County local tax, also deterministic. ~45% of counties levy nothing. */
  const CTAX = [0,0,0,0,0,0,0,0,0,0.25,0.35,0.45,0.55,0.65,0.80,0.95,1.10,1.35,1.60,1.85];

  const ST = [["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  /* Canadian provinces/territories — for the Loss Run Dashboard's cross-border
     trucking exposure ONLY. Deliberately NOT merged into D.states: rating,
     taxes, and every product/quote form on this platform assume a US state
     (premium tax tables, county tax, ZIP territory resolution all only cover
     the US), so mixing Canada into D.states would silently break those. This
     stays a separate, small dataset that only the loss-run sample draws from. */
  D.caProvinces = [["AB","Alberta"],["BC","British Columbia"],["MB","Manitoba"],["NB","New Brunswick"],
    ["NL","Newfoundland and Labrador"],["NS","Nova Scotia"],["ON","Ontario"],["PE","Prince Edward Island"],
    ["QC","Quebec"],["SK","Saskatchewan"],["NT","Northwest Territories"],["NU","Nunavut"],["YT","Yukon"]]
    .map(([abv, name], i) => ({ id: i + 1, abv, name, country: "CA" }));

  D.states = ST.map(([abv, name], i) => ({
    id: i + 1, abv, name, stateCode: String(i + 1).padStart(2, "0"),
    included: true, filingStatus: pick(["Approved","Approved","Approved","Pending"]),
    premiumTax: (TAXRATE[abv] || TAXRATE.DEFAULT)[0], surplusTax: (TAXRATE[abv] || TAXRATE.DEFAULT)[0],
    stampingFee: (TAXRATE[abv] || TAXRATE.DEFAULT)[1],
    /* Seeds for how many territories to generate below. These are NOT the
       displayed counts — they used to be, and the numbers they showed were
       random and contradicted the real arrays (a state claiming 160 counties
       while D.counties held four for it). Real counts are recomputed from
       the generated data further down. */
    territorySeed: ri(3, 12), effectiveDate: "2026-01-01",
  }));

  const CNAMES = ["Adams","Allen","Barron","Beaver","Bell","Benton","Berks","Blair","Boone","Bradley","Brown","Butler","Caldwell","Carroll","Chase","Clark","Clay","Cole","Cook","Crawford","Dallas","Dane","Davis","Decatur","Douglas","Duval","Elkhart","Erie","Essex","Fayette","Franklin","Fulton","Garland","Grant","Greene","Hall","Hamilton","Harris","Henry","Hudson","Jackson","Jasper","Jefferson","Johnson","Kent","King","Knox","Lake","Lee","Lincoln","Logan","Macon","Madison","Marion","Marshall","Mason","Mercer","Miami","Monroe","Montgomery","Morgan","Nelson","Noble","Orange","Osage","Perry","Pike","Polk","Pratt","Pulaski","Putnam","Randolph","Reno","Rice","Riley","Rockwall","Ross","Rush","Saline","Scott","Shelby","Stark","Sumner","Tarrant","Taylor","Travis","Union","Vernon","Wabash","Wallace","Warren","Washington","Wayne","Webster","Wells","White","Wilson","Wood","Wyandotte","York"];
  /* Four counties per state, with (state, county) unique.

     The previous generator cycled `i % 50` for the state and `i % 100` for
     the name over 200 rows, so rows i and i+100 landed on the same state AND
     the same name: exactly half the table — 100 of 200 rows — were duplicates.
     Texas showed "Jefferson County" and "Wayne County" twice each in the
     county picker, and a county tax lookup by name had two rows to choose
     from. Indexing the name off the STATE rather than the row makes the pair
     unique by construction.

     The real counties the shipped sample payloads name are seeded explicitly
     for the demo states, so pasting a production payload exercises the local
     tax path instead of silently missing the lookup. */
  const REAL_COUNTIES = {
    TX: ["Dallas", "Denton", "Harris", "Tarrant", "Travis"],
    CA: ["Alameda", "Los Angeles", "Orange", "San Diego"],
    FL: ["Broward", "Duval", "Miami-Dade", "Orange"],
  };
  D.counties = Array.from({ length: 200 }, (_, i) => {
    const si = i % D.states.length, k = Math.floor(i / D.states.length);
    const s = D.states[si];
    const real = REAL_COUNTIES[s.abv];
    const name = (real && real[k] ? real[k] : CNAMES[(si * 4 + k) % CNAMES.length]) + " County";
    return { id: i + 1, fips: String(1000 + i * 7).padStart(5, "0"), name,
      state: s.abv, stateName: s.name, territory: "T" + ri(1, 6), population: ri(9000, 2400000),
      catZone: pick(["None","Wind","Hail","Wind/Hail","Quake","Flood"]),
      // Local tax on top of the state rate — deterministic, since it reaches the premium
      taxRate: CTAX[i % CTAX.length], active: true };
  });

  D.territories = [];
  let tid = 1;
  D.states.forEach(s => {
    const n = Math.min(s.territorySeed, 6);
    for (let i = 1; i <= n; i++) D.territories.push({
      id: tid++, code: `${s.abv}-T${i}`, state: s.abv, name: ["Urban Metro Core","Suburban","Rural / Rest of State","Interstate Corridor","Coastal","Secondary Metro"][i - 1],
      isoTerr: 100 + ri(1, 40), relativity: rf(0.78, 1.62, 3), zips: ri(28, 940), lob: pick(["Commercial Trucking","Commercial Property","General Liability","All"]), active: true });
  });

  /* Real per-state counts, derived once both arrays exist. `lobNames` is the
     set of lines actually configured for that state, taken from its own
     territories — the platform has no other state→LOB link, and a bare
     random number here read like an internal id. */
  D.states.forEach(s => {
    const terrs = D.territories.filter(t => t.state === s.abv);
    s.territories = terrs.length;
    s.counties = D.counties.filter(c => c.state === s.abv).length;
    s.lobNames = [...new Set(terrs.map(t => t.lob))].sort();
    s.lobs = s.lobNames.length;
  });

  D.zipcodes = Array.from({ length: 400 }, (_, i) => {
    const c = D.counties[i % D.counties.length];
    return { id: i + 1, zip: String(10001 + i * 137).slice(0, 5), city: c.name.replace(" County", ""), county: c.name,
      state: c.state, isoTerr: 100 + ri(1, 40), terrUse: c.territory, ppc: ri(1, 10), catZone: c.catZone };
  });

  /* ---------------- Class of Business (100) ---------------- */
  const COBSEED = [
    ["484110","General Freight Trucking, Local","Commercial Trucking",3],["484121","General Freight Trucking, Long-Distance TL","Commercial Trucking",3],
    ["484122","General Freight Trucking, Long-Distance LTL","Commercial Trucking",3],["484220","Specialized Freight Trucking, Local","Commercial Trucking",4],
    ["484230","Specialized Freight Trucking, Long-Distance","Commercial Trucking",4],["492110","Couriers and Express Delivery","Commercial Trucking",2],
    ["238160","Roofing Contractors","General Liability",5],["238210","Electrical Contractors","General Liability",4],
    ["236220","Commercial Building Construction","General Liability",5],["722511","Full-Service Restaurants","General Liability",3],
    ["445110","Supermarkets and Other Grocery Retailers","General Liability",2],["531110","Lessors of Residential Buildings and Dwellings","Commercial Property",2],
    ["531120","Lessors of Nonresidential Buildings","Commercial Property",2],["721110","Hotels and Motels","Commercial Property",3],
    ["339999","All Other Miscellaneous Manufacturing","Commercial Property",3],["812910","Animal/Pet Groomer","Professional Liability (MPL)",2],
    ["541611","Management Consulting Services","Professional Liability (MPL)",3],["541330","Engineering Services","Professional Liability (MPL)",4],
    ["541990","All Other Professional Services","Professional Liability (MPL)",3],["621111","Offices of Physicians","Professional Liability (MPL)",5],
    ["518210","Data Processing and Hosting","Cyber",4],["522110","Commercial Banking","Cyber",5],
    ["611310","Colleges, Universities, and Professional Schools","Cyber",4],["541512","Computer Systems Design Services","Cyber",4],
  ];
  /* Real 2022 NAICS codes + official industry titles */
  const COBEXTRA = [
    ["332710","Machine Shops"],["339950","Sign Manufacturing"],["326199","All Other Plastics Product Manufacturing"],
    ["332322","Sheet Metal Work Manufacturing"],["811111","General Automotive Repair"],["811192","Car Washes"],
    ["812320","Drycleaning and Laundry Services (except Coin-Operated)"],["311811","Retail Bakeries"],
    ["424490","Other Grocery and Related Products Merchant Wholesalers"],["561730","Landscaping Services"],
    ["561720","Janitorial Services"],["561612","Security Guards and Patrol Services"],["561320","Temporary Help Services"],
    ["488510","Freight Transportation Arrangement"],["493110","General Warehousing and Storage"],
    ["531130","Lessors of Miniwarehouses and Self-Storage Units"],["713930","Marinas"],["713950","Bowling Centers"],
    ["713940","Fitness and Recreational Sports Centers"],["624410","Child Care Services"],["812210","Funeral Homes and Funeral Services"],
    ["541921","Photography Studios, Portrait"],["323111","Commercial Printing (except Screen and Books)"],
    ["449110","Furniture Retailers"],["444140","Hardware Retailers"],["456110","Pharmacies and Drug Retailers"],
    ["445131","Convenience Retailers"],["445320","Beer, Wine, and Liquor Retailers"],["459910","Pet and Pet Supplies Retailers"],
    ["459110","Sporting Goods Retailers"],["458110","Clothing and Clothing Accessories Retailers"],["458310","Jewelry Retailers"],
    ["459410","Office Supplies and Stationery Retailers"],["444240","Nursery, Garden Center, and Farm Supply Retailers"],
    ["424910","Farm Supplies Merchant Wholesalers"],["311119","Other Animal Food Manufacturing"],
    ["424510","Grain and Field Bean Merchant Wholesalers"],["311511","Fluid Milk Manufacturing"],
    ["311612","Meat Processed from Carcasses"],["311710","Seafood Product Preparation and Packaging"],
    ["312130","Wineries"],["312120","Breweries"],["312140","Distilleries"],["313210","Broadwoven Fabric Mills"],
    ["322220","Paper Bag and Coated and Treated Paper Manufacturing"],["424690","Other Chemical and Allied Products Merchant Wholesalers"],
    ["325510","Paint and Coating Manufacturing"],["326299","All Other Rubber Product Manufacturing"],
    ["327215","Glass Product Manufacturing Made of Purchased Glass"],["327390","Other Concrete Product Manufacturing"],
    ["423510","Metal Service Centers and Other Metal Merchant Wholesalers"],["331318","Other Aluminum Rolling, Drawing, and Extruding"],
    ["331222","Steel Wire Drawing"],["333515","Cutting Tool and Machine Tool Accessory Manufacturing"],
    ["334418","Printed Circuit Assembly Manufacturing"],["339112","Surgical and Medical Instrument Manufacturing"],
    ["339115","Ophthalmic Goods Manufacturing"],["339930","Doll, Toy, and Game Manufacturing"],
    ["339992","Musical Instrument Manufacturing"],["441222","Boat Dealers"],["441210","Recreational Vehicle Dealers"],
    ["441227","Motorcycle, ATV, and All Other Motor Vehicle Dealers"],["441340","Tire Dealers"],
    ["441330","Automotive Parts and Accessories Retailers"],["532120","Truck, Utility Trailer, and RV Rental and Leasing"],
    ["532412","Construction, Mining, and Forestry Machinery Rental and Leasing"],["532299","All Other Consumer Goods Rental"],
    ["532310","General Rental Centers"],["238990","All Other Specialty Trade Contractors"],["238910","Site Preparation Contractors"],
    ["238110","Poured Concrete Foundation and Structure Contractors"],["238140","Masonry Contractors"],
    ["238310","Drywall and Insulation Contractors"],["238320","Painting and Wall Covering Contractors"],
    ["238330","Flooring Contractors"],["238150","Glass and Glazing Contractors"],["238220","Plumbing, Heating, and Air-Conditioning Contractors"],
  ];
  /* Industry classification (NAICS) — "what does this business do".
     Distinct from the Coverage / Class-of-Business tree below, which is what
     actually carries premium. */
  /* Class Factor and Hazard Group are DETERMINISTIC.

     engine.js's GL calculator looks this factor up when rating, so the random
     rf(0.7, 1.9) that used to sit here put an arbitrary number straight into
     the premium — the same risk could quote differently on every load.

     Factor is now derived from the hazard group on a monotonic curve (higher
     hazard costs more), and hazard group for the unseeded NAICS codes is
     derived from the NAICS sector rather than drawn at random. This is an
     internally consistent approximation, NOT a filed class-factor table —
     replace with filed factors before any GL quote is relied on. */
  const HG_FACTOR = { 1: 0.75, 2: 0.90, 3: 1.00, 4: 1.25, 5: 1.55 };
  const SECTOR_HG = { 23:5, 31:4, 32:4, 33:4, 42:3, 44:2, 45:2, 48:4, 49:4, 51:2, 52:2, 53:2,
    54:3, 56:3, 61:2, 62:4, 71:3, 72:3, 81:3, 11:4, 21:5, 22:4 };
  const SECTOR_LOB = { 23:"General Liability", 31:"Commercial Property", 32:"Commercial Property",
    33:"Commercial Property", 42:"General Liability", 44:"General Liability", 45:"General Liability",
    48:"Commercial Trucking", 49:"Commercial Trucking", 51:"Cyber", 52:"Cyber",
    53:"Commercial Property", 54:"Professional Liability (MPL)", 56:"General Liability",
    61:"Cyber", 62:"Professional Liability (MPL)", 71:"General Liability", 72:"General Liability",
    81:"General Liability", 11:"General Liability", 21:"General Liability", 22:"General Liability" };
  const sectorOf = code => +String(code).slice(0, 2);
  D.industryClasses = [
    ...COBSEED.map(([code, name, lob, hg], i) => ({ id: i + 1, code, name, lob,
      hazardGroup: hg, factor: HG_FACTOR[hg], active: true, quotes: ri(4, 190) })),
    ...COBEXTRA.map(([code, name], i) => {
      const sec = sectorOf(code);
      const hg = SECTOR_HG[sec] || 3;
      return { id: COBSEED.length + i + 1, code, name,
        lob: SECTOR_LOB[sec] || "General Liability",
        hazardGroup: hg, factor: HG_FACTOR[hg], active: true, quotes: ri(0, 140) };
    }),
  ];

  /* ==========================================================================
     Workers' Compensation — manual class rates.

     REAL structure, REPRESENTATIVE values — same disclosure this platform
     already applies to Cargo classification factors and the county tax
     ladder. The class codes below are real, standard NCCI classification
     codes (verified against public NCCI class-code references, not invented
     numbers), and "rate per $100 of payroll -> × payroll/100, summed across
     every class on the schedule, × experience mod × schedule credit" is the
     real, universal WC manual-rating method. What is NOT real: the actual
     filed dollar rate for each class code, which varies by state and by
     policy year and is published by NCCI/state rating bureaus — no such
     manual ships in this repo (same situation as every other "no source
     workbook" table on this platform). One representative national rate is
     used per class rather than per-state rates, matching the level of
     simplification GL/Cyber already use elsewhere (state surplus-lines tax
     is the only state-varying figure modeled platform-wide). */
  D.wcClassRates = [
    ["8810", "Clerical Office Employees", 0.24],
    ["8742", "Outside Sales Personnel", 0.41],
    ["8018", "Wholesale/Retail Store — NOC", 2.85],
    ["9082", "Restaurant — Full Service", 3.71],
    ["5645", "Carpentry — Detached One/Two-Family Dwellings", 8.16],
    ["5551", "Roofing — All Kinds & Drivers", 18.42],
    ["7228", "Trucking — Local Hauling, NOC (drivers)", 5.94],
    ["8835", "Home/Public Health Care — Professional Employees", 1.87],
    ["8833", "Hospital — Professional Employees", 1.42],
    ["9014", "Janitorial Services By Contractor", 3.28],
    ["8006", "Grocery Store — Retail NOC", 2.11],
    ["2790", "Furniture/Fixtures Manufacturing NOC", 4.53],
  ].map(([code, desc, rate], i) => ({ id: i + 1, classCode: code, desc, ratePer100: rate }));

  /* ==========================================================================
     Coverage = Class of Business (parent → child tree)
     Mirrors the real ams model where every premium row carries
     class_of_business_id + parent_cob_id. A PRIMARY (parent) coverage is what
     the agent picks; selecting it reveals its CHILD coverages, and premium
     rolls up per parent group — exactly how cyber-insuring-agreements works.
     Parent lists sourced from gl_coverage_checkbox (add-submission.component.ts
     :8534-8550), getCoveragePrefix (:5127-5142) and the cyber 4-group tree
     (cyber-insuring-agreements.component.ts:94-165).
     ========================================================================== */
  const TREE = [
    // ---- Commercial Trucking (SSIC codes) ----
    ["Commercial Trucking","AL","Auto Liability","SSIC AL",true,
      [["AL-BI","Bodily Injury",true],["AL-PD","Property Damage",true],["AL-UM","Uninsured Motorist",false],
       ["AL-UIM","Underinsured Motorist",false],["AL-MED","Medical Payments",false],["AL-PIP","Personal Injury Protection",false],
       ["AL-HAL","Hired Auto Liability",false],["AL-NOAL","Non-Owned Auto Liability",false]]],
    ["Commercial Trucking","PD","Physical Damage","SSIC PD",false,
      [["PD-COMP","Comprehensive",false],["PD-COLL","Collision",false],["PD-SP","Specified Perils",false],
       ["PD-TI","Trailer Interchange",false],["PD-GKL","Garagekeepers Legal Liability",false]]],
    ["Commercial Trucking","CARGO","Motor Truck Cargo","SSIC CARGO",false,
      [["CG-OWN","Owned Cargo",false],["CG-REF","Refrigeration Breakdown",false],
       ["CG-DEB","Debris Removal",false],["CG-FRT","Earned Freight",false]]],

    // ---- General Liability (real gl_coverage_checkbox parents) ----
    ["General Liability","GL","General Liability","Value 1 · mandatory",true,
      [["GL-PO","Premises / Operations",true],["GL-PCO","Products / Completed Operations",false],
       ["GL-PAI","Personal & Advertising Injury",true],["GL-MED","Medical Expense",false],
       ["GL-EBL","Employee Benefits Liability",false],["GL-SG","Stop Gap Liability",false]]],
    ["General Liability","LIQ","Liquor Liability","Value 4",false,
      [["LQ-CC","Each Common Cause",false],["LQ-AGG","Liquor Aggregate",false]]],
    ["General Liability","BA","Business Auto","Value 2",false,
      [["BA-HAL","Hired Auto Liability",false],["BA-NOAL","Non-Owned Auto Liability",false]]],
    ["General Liability","IM","Inland Marine","inland_marine",false,
      [["IM-CE","Contractors Equipment",false],["IM-INST","Installation Floater",false]]],

    // ---- Commercial Property ----
    ["Commercial Property","PR","Property","pr",true,
      [["PR-BLDG","Building",true],["PR-BPP","Business Personal Property",false],
       ["PR-BI","Business Income",false],["PR-EE","Extra Expense",false],
       ["PR-EQ","Equipment Breakdown",false],["PR-ORD","Ordinance or Law",false]]],

    // ---- Professional Liability (MPL) ----
    ["Professional Liability (MPL)","MPL","Professional Liability","mpl",true,
      [["MPL-MISC","Misc Professional Liability",true],["MPL-DEF","Defense Costs",false]]],

    /* ---- Umbrella / Excess ----
       This line had a product (VeriDex Umbrella Advantage) and an application
       type but no coverage tree at all, so its coverage picker came up empty
       and the product resolved to zero coverages. Excess sits over one or
       more underlying policies, which is what the children enumerate. */
    ["Umbrella / Excess","XS","Excess Liability","app type 495",true,
      [["XS-AL","Excess Auto Liability",false],["XS-GL","Excess General Liability",true],
       ["XS-EL","Excess Employers Liability",false],["XS-PL","Excess Professional Liability",false],
       ["XS-SIR","Self-Insured Retention",false]]],

    // ---- Cyber (real 4-parent / 19-child tree) ----
    ["Cyber","CYB-LIAB","Liability","cyberSections",true,
      [["CY-PS","Privacy and Security",true],["CY-PCC","Payment Card Costs",false],
       ["CY-MED","Media",false],["CY-REG","Regulatory Proceedings",false]]],
    ["Cyber","CYB-BR","Breach Response","breachResponse",false,
      [["CY-PBN","Privacy Breach Notification",false],["CY-CLE","Computer and Legal Experts",false],
       ["CY-BET","Betterment",false],["CY-EXT","Cyber Extortion",false],
       ["CY-DR","Data Restoration",false],["CY-PR","Public Relations",false]]],
    ["Cyber","CYB-CC","Cyber Crime","fraudSections",false,
      [["CY-CF","Computer Fraud",false],["CY-FTF","Funds Transfer Fraud",false],
       ["CY-SEF","Social Engineering Fraud",false],["CY-TF","Telecom Fraud",false]]],
    ["Cyber","CYB-BL","Business Loss","businessLossSections",false,
      [["CY-BI","Business Interruption",false],["CY-DBI","Dependent Business Interruption",false],
       ["CY-RH","Reputation Harm",false],["CY-SF","System Failure",false],
       ["CY-AC","Accounting Costs",false]]],

    /* ---- Workers' Compensation (real app-type 491 wc_defaults fields) ----
       Part A/B is the standard WC policy split: Part One (Workers' Comp) pays
       statutory benefits with no dollar limit; Part Two (Employers Liability)
       is the tort-exposure piece and is the one part that actually carries a
       limit — matching the real wc-defaults component's three limit fields
       (each-accident / policy-limit / each-employee). */
    ["Workers' Compensation","WC","Workers' Compensation","wc_defaults",true,
      [["WC-A","Part One — Statutory Benefits",true],
       ["WC-B","Part Two — Employers Liability",true]]],
  ];

  /* Coverage Configuration: unit / deductible / effective dates / status.
     unit picks a name off D.units (built above) rather than a hardcoded
     string — the same tenant-configurable list a factor's exposure basis
     reads from. status is a lifecycle distinct from the boolean `active`
     (Draft -> Active -> Retired, matching the Draft->Published pattern
     versions.html already uses), so a coverage being drafted doesn't have
     to be prematurely marked active=false/true with no in-between. */
  const UNIT_FOR_LOB = { "Commercial Trucking": "Vehicle", "Commercial Property": "Building",
    "General Liability": "Employee", "Professional Liability (MPL)": "Revenue", "Cyber": "Revenue",
    "Workers' Compensation": "WC Payroll" };
  // Exposed on VX so vxImportProductStudioExport (declared outside this
  // closure, after the file's top-level function hoist) can map an
  // imported LOB to the same real per-line unit this seed data uses,
  // instead of a single hardcoded fallback string.
  D.unitForLob = UNIT_FOR_LOB;
  D.cob = [];
  let cid = 1;
  TREE.forEach(([lob, code, name, src, mand, kids]) => {
    const pid = cid++;
    D.cob.push({ id: pid, cobId: pid, parentCobId: null, level: "Primary", code, name, lob,
      sourceRef: src, mandatory: mand, childCount: kids.length,
      ratingBasis: pick(["Loss Cost × ILF × LCM","Rate × Exposure","Sublimit of Aggregate"]),
      defaultLimit: pick([500000,1000000,2000000]), factor: rf(0.8, 1.6, 3),
      unit: UNIT_FOR_LOB[lob] || "Coverage Limit", deductible: pick([0,1000,2500,5000,10000]),
      status: "Active", effectiveStart: "2026-03-01", effectiveEnd: "",
      version: "v2026.03", active: true, quotes: ri(40, 320) });
    kids.forEach(([ccode, cname, cmand]) => {
      D.cob.push({ id: cid, cobId: cid, parentCobId: pid, level: "Child", code: ccode, name: cname, lob,
        parentName: name, sourceRef: src, mandatory: cmand, childCount: 0,
        ratingBasis: cmand ? "Included in parent" : pick(["Flat Charge","% of Parent Premium","Sublimit of Aggregate","Rate × Exposure"]),
        defaultLimit: pick([0,25000,50000,100000,250000,500000]), factor: rf(0.05, 0.9, 3),
        unit: UNIT_FOR_LOB[lob] || "Coverage Limit", deductible: pick([0,500,1000,2500]),
        status: "Active", effectiveStart: "2026-03-01", effectiveEnd: "",
        version: "v2026.03", active: true, quotes: ri(0, 180) });
      cid++;
    });
  });
  D.cobParents = D.cob.filter(c => !c.parentCobId);
  D.cobChildren = pid => D.cob.filter(c => c.parentCobId === pid);

  /* ---- Reconcile each product's coverage + state selections to real records ----
     Runs here, after D.cob exists, because it resolves against it.

     `cob` was authored as free text and had drifted from the coverage tree
     ("Premises/Operations" vs the real "Premises / Operations", plus
     "Time Element" / "Special Class List", which aren't coverages at all).
     A product's coverage picker is now a real parent/child tree read from
     D.cob, so those strings have to resolve to actual coverage names or the
     selection silently renders as unchecked. Matching is on a normalised
     name (case/space/punctuation-insensitive); anything still unresolved
     falls back to that LOB's primary coverages rather than being dropped —
     a product with no coverages can't be quoted.

     `states` was a COUNT (50), not a selection. It becomes the real list of
     state codes and the count is derived from it for display. The slice is
     deterministic so seeded products don't reshuffle between reloads. */
  {
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const byLob = {};
    D.cob.forEach(c => { (byLob[c.lob] = byLob[c.lob] || []).push(c); });
    D.products.forEach((p, pi) => {
      const pool = byLob[p.lob] || [];
      const resolved = [];
      (Array.isArray(p.cob) ? p.cob : []).forEach(name => {
        const n = norm(name);
        /* Exact match, then containment. Deliberately NOT fuzzier than that:
           an abbreviation-tolerant matcher silently resolved "Products/
           Completed Ops" to the wrong row (and "ops" isn't even a prefix of
           "operations"), which is worse than not matching — a product would
           claim a coverage nobody selected. The seed above is authored
           against real coverage names, so this only has to absorb
           punctuation and spacing drift. */
        const hit = pool.find(c => norm(c.name) === n)
          || pool.find(c => norm(c.name).includes(n) || n.includes(norm(c.name)));
        if (hit && !resolved.includes(hit.name)) resolved.push(hit.name);
      });
      p.cob = resolved.length ? resolved : pool.filter(c => !c.parentCobId).map(c => c.name);

      if (!Array.isArray(p.states)) {
        const n = typeof p.states === "number" ? Math.min(p.states, D.states.length) : D.states.length;
        const off = (pi * 3) % Math.max(1, D.states.length - n + 1);
        p.states = D.states.slice(off, off + n).map(s => s.abv);
      }
    });

    /* Real exclusion, not a slice: ND/OH/WA/WY are monopolistic-fund states —
       Workers' Compensation there is written only through the state fund, and
       no private carrier (admitted or not) can bind it. This is the one
       states-list on the platform that isn't a deterministic slice, because
       "which states" isn't arbitrary for this coverage. */
    const wc = D.products.find(p => p.code === "WCPROG");
    if (wc) wc.states = D.states.filter(s => !["ND", "OH", "WA", "WY"].includes(s.abv)).map(s => s.abv);
  }

  /* ---------------- Unit Configuration ----------------
     What a coverage or factor is rated PER — tenant-configurable, not
     hardcoded, per the platform spec: "The system should not hard-code
     these units. Tenants should be able to configure units according to
     their own business requirements." Coverages/factors reference these by
     name (see D.cob's `unit` field) rather than each spelling out its own
     unit string, so adding a tenant-specific unit here is enough to make it
     selectable everywhere a unit picker is shown. */
  D.units = [
    { id: 1, name: "Vehicle", appliesToLob: "Commercial Trucking", basis: "Per rated power unit", builtIn: true },
    /* Trailers are a genuinely separate rated exposure from the power unit
       they're pulled by, not a property of it: engine.js gives each one its
       own stated value in the APD basis (Vehicles TIV adds trailerValue on
       top of the unit's own value) and its own Trailer Physical Damage
       factor via pdBucket, and the workbook classes them under their own
       Primary Class codes (671/672 semi-trailers, 681/691 service and
       utility). A fleet can also pull more trailers than it owns power
       units. So "per trailer" is a real unit a tenant can rate on. */
    { id: 2, name: "Trailer", appliesToLob: "Commercial Trucking", basis: "Per scheduled trailer", builtIn: true },
    { id: 3, name: "Driver", appliesToLob: "Commercial Trucking", basis: "Per rated driver", builtIn: true },
    { id: 4, name: "Mile", appliesToLob: "Commercial Trucking", basis: "Per mile driven", builtIn: true },
    { id: 5, name: "Location", appliesToLob: "All", basis: "Per insured location", builtIn: true },
    { id: 6, name: "Building", appliesToLob: "Commercial Property", basis: "Per scheduled building", builtIn: true },
    { id: 7, name: "Employee", appliesToLob: "General Liability", basis: "Per full-time-equivalent employee", builtIn: true },
    { id: 8, name: "Revenue", appliesToLob: "All", basis: "Per $1,000 of annual revenue", builtIn: true },
    { id: 9, name: "Payroll", appliesToLob: "General Liability", basis: "Per $1,000 of payroll", builtIn: true },
    { id: 10, name: "Exposure", appliesToLob: "All", basis: "Per $100 of total exposure", builtIn: true },
    { id: 11, name: "Coverage Limit", appliesToLob: "All", basis: "Per $1,000 of limit", builtIn: true },
    /* Genuinely a different unit from GL's "Payroll" (id 9, per $1,000) rather
       than a reuse — WC manual rates are conventionally filed per $100 of
       payroll, and stating GL's per-$1,000 basis on a WC coverage would be a
       real, if quiet, factual error, not a cosmetic one. */
    { id: 12, name: "WC Payroll", appliesToLob: "Workers' Compensation", basis: "Per $100 of payroll", builtIn: true },
  ];

  /* ---------------- Base rates & lookup tables ---------------- */
  D.baseRates = Array.from({ length: 180 }, (_, i) => {
    const s = pick(D.states), l = pick(D.lobs);
    return { id: i + 1, lob: l.name, state: s.abv, territory: "T" + ri(1, 6),
      classCode: pick(["321","011","672","238160","531120","812910","518210"]),
      coverage: pick(["Liability","Physical Damage","Cargo","Building","BPP","Professional","Cyber"]),
      baseRate: rf(180, 5800, 2), unit: pick(["Per Unit","Per $100 TIV","Per $1,000 Revenue","Per Employee"]),
      filingId: `CA-2024-BRLA${ri(1,9)}`, effectiveDate: "2026-03-01", version: "v2026.03", active: true };
  });
  /* Lookup Tables' own inventory rows carry a `keys` string ("State + Class +
     Coverage") describing the real key columns a filed table like this would
     have — that much is known even without the filed workbook. What is NOT
     known is the actual factor values, so every table below that can derive
     columns from its keys gets a small, clearly-flagged SAMPLE dataset (a
     "reference sheet" shape, not filed numbers) rather than sitting empty
     until someone manually defines columns from scratch. `sample:true` is
     what lookup-tables.html reads to keep this honestly labeled — "Sample
     data", never "Loaded" — until a real CSV upload replaces it.
     The 5 LOOKUP_LIVE tables (ids 1-5 — see lookup-tables.html) are excluded:
     their real rows already live in RATE_TABLES and are browsable on Rate
     Tables, so seeding a second, fake dataset here would just be confusing,
     not helpful. "Multiple" (Cyber Helper Tables) isn't a real key list, so
     it is left alone too — there is nothing honest to derive from it. */
  const LOOKUP_SAMPLE_EXCLUDE = new Set([
    "ZIP → Territory (Trucking)", "Increased Limits Factors", "Liability Loss Costs",
    "Garagekeepers Rates", "PhysDam Rates by TIV",
  ]);
  const seedLookupSampleValue = (col, i) => {
    const key = (col.name || "").toLowerCase();
    if (/state/.test(key)) return ["CA", "TX", "NY"][i] || "CA";
    if (/zip|postal/.test(key)) return ["90001", "10001", "77001"][i] || "00000";
    if (/terr/.test(key)) return String(i + 1).padStart(3, "0");
    if (/naics/.test(key)) return ["541511", "236220", "722511"][i] || "000000";
    if (col.type === "Number") {
      if (/(factor|ilf|mod)/.test(key)) return [0.85, 1.00, 1.15][i] ?? 1;
      if (/limit/.test(key)) return [100000, 500000, 1000000][i] ?? 100000;
      if (/ded(uctible)?/.test(key)) return [500, 1000, 2500][i] ?? 500;
      if (/ppc/.test(key)) return i + 1;
      return 100 * (i + 1);
    }
    if (/class/.test(key)) return `CL${String(i + 1).padStart(3, "0")}`;
    return `Sample ${col.name} ${i + 1}`;
  };
  const seedLookupSampleRows = (columns, n) => Array.from({ length: n }, (_, i) => {
    const row = {};
    columns.forEach(c => { row[c.name] = seedLookupSampleValue(c, i); });
    return { ...row, __rowId: i + 1, effectiveStart: "", effectiveEnd: "" };
  });
  D.lookupTables = [
    { id: 1, name: "ZIP → Territory (Trucking)", lob: "Commercial Trucking", keys: "ZIP", rows: 57086, source: "ZIPCodes" },
    { id: 2, name: "Increased Limits Factors", lob: "Commercial Trucking", keys: "State + Table + Limit", rows: 5217, source: "IncreasedLimitsFactors" },
    { id: 3, name: "Liability Loss Costs", lob: "Commercial Trucking", keys: "State + Terr + VehType + Cov", rows: 1955, source: "CA_Liab_LC" },
    { id: 4, name: "Garagekeepers Rates", lob: "Commercial Trucking", keys: "State + Limit + Coverage", rows: 1621, source: "CA_GKL" },
    { id: 5, name: "PhysDam Rates by TIV", lob: "Commercial Trucking", keys: "Stated Value + Deductible", rows: 300, source: "PhysDamRatesByTIV" },
    { id: 6, name: "GL Additional Parameters", lob: "General Liability", keys: "State + Class + Coverage", rows: 236054, source: "AdditionalParameters" },
    { id: 7, name: "GL Prem/Ops Loss Costs", lob: "General Liability", keys: "State + Class Code", rows: 186556, source: "PremOpsLossCosts" },
    { id: 8, name: "GL Products Loss Costs", lob: "General Liability", keys: "State + Class Code", rows: 23247, source: "ProductsLossCosts" },
    { id: 9, name: "GL Increased Limits Factors", lob: "General Liability", keys: "State + Limit", rows: 22465, source: "ILF" },
    { id: 10, name: "GL ZIP Code", lob: "General Liability", keys: "ZIP", rows: 57774, source: "ZipCode" },
    { id: 11, name: "GL ILTA Table", lob: "General Liability", keys: "Class + Table", rows: 1917, source: "ILTA" },
    { id: 12, name: "GL Sectors", lob: "General Liability", keys: "NAICS Sector", rows: 1991, source: "Sectors" },
    { id: 13, name: "Property BG1 Rates", lob: "Commercial Property", keys: "State + Class + Constr + PPC", rows: 61360, source: "CP_BG1" },
    { id: 14, name: "Property SCL ZIP", lob: "Commercial Property", keys: "ZIP", rows: 63089, source: "ZipCode_SCL" },
    { id: 15, name: "Property BG2 ZIP", lob: "Commercial Property", keys: "ZIP", rows: 47145, source: "ZipCode_BG2" },
    { id: 16, name: "Property BG1 ZIP", lob: "Commercial Property", keys: "ZIP", rows: 41548, source: "ZipCode_BG1" },
    { id: 17, name: "Property Deductible Factors", lob: "Commercial Property", keys: "State + Ded + Coverage", rows: 2870, source: "DeductFactors" },
    { id: 18, name: "Property PPC Table", lob: "Commercial Property", keys: "State + County + PPC", rows: 7501, source: "PPC" },
    { id: 19, name: "ISO Class Descriptions", lob: "Commercial Property", keys: "Class Code", rows: 5246, source: "ISO_Class_Descr" },
    { id: 20, name: "MPL Classifications", lob: "Professional Liability (MPL)", keys: "NAICS", rows: 604, source: "Classifications" },
    { id: 21, name: "MPL ZIP Code", lob: "Professional Liability (MPL)", keys: "ZIP", rows: 57774, source: "ZipCode" },
    { id: 22, name: "MPL Incurred Loss Bands", lob: "Professional Liability (MPL)", keys: "Incurred Loss", rows: 155, source: "IncLoss" },
    { id: 23, name: "Cyber Helper Tables", lob: "Cyber", keys: "Multiple", rows: 184, source: "HelperTables" },
  ].map(r => {
    const keyCols = (!LOOKUP_SAMPLE_EXCLUDE.has(r.name) && r.keys && r.keys !== "Multiple")
      ? r.keys.split("+").map(s => s.trim()).filter(Boolean) : [];
    // Every key column plus one generic "Factor" — the real value column's
    // actual name isn't known without the filed workbook, so it is named for
    // what it IS (a factor) rather than guessed at.
    const columns = keyCols.length ? [...keyCols.map(name => ({ name, type: "Text" })), { name: "Factor", type: "Number" }] : [];
    return { ...r, active: true, columns, data: columns.length ? seedLookupSampleRows(columns, 3) : [], sample: columns.length > 0 };
  });
  // Admin-defined tables (new rows, new columns, whole new tables added via
  // the Lookup Tables screen) are real configuration, not demo data — restore
  // them the same way vxCustomFactors etc. survive a refresh (see API.create/
  // update's persistIfTracked in grid.js, which is what keeps this in sync).
  D.lookupTables = loadPersisted("vxLookupTables", D.lookupTables);

  /* Every row needs a stable identity that survives an edit — its position
     in the array does not, once revisions of the same row can coexist (see
     D.lookupRowsAsOf below). Backfilled once here so every row, old or new,
     has one; assignment is per-table so ids stay small and readable. */
  D.lookupTables.forEach(t => {
    let nextRowId = Math.max(0, ...(t.data || []).map(r => +r.__rowId || 0)) + 1;
    (t.data || []).forEach(r => {
      if (r.__rowId == null) r.__rowId = nextRowId++;
      if (r.effectiveStart === undefined) r.effectiveStart = "";
      if (r.effectiveEnd === undefined) r.effectiveEnd = "";
    });
  });
  /* A row change on Lookup Tables goes through the same approve-then-
     effective-date gate as a Rating Factor's Default Value (see
     D.factorChangeRequests above and vxRequestLookupRowChange in core.js) —
     approving an edit does not overwrite the row, it closes the old
     revision's effectiveEnd and opens a new one, so table.data ends up
     holding every revision of a row, not just its current values.
     lookupRowsAsOf resolves that back down to "what a reader sees today":
     one row per __rowId, the revision in force as of the given date —
     built on D.tableAsOf so it uses the exact same effectiveStart/
     effectiveEnd rules the rest of the platform already versions tables by. */
  D.lookupRowsAsOf = (table, asOf) => {
    const rows = (table && table.data || []).filter(r => r.__rowId != null);
    const inForce = D.tableAsOf(rows, asOf || D.referenceDate);
    const byId = new Map();
    inForce.forEach(r => {
      const cur = byId.get(r.__rowId);
      if (!cur || (r.effectiveStart || "") > (cur.effectiveStart || "")) byId.set(r.__rowId, r);
    });
    return [...byId.values()];
  };
  D.lookupChangeRequests = loadPersisted("vxLookupChangeRequests", []);

  /* ---------------- Pricing rules ---------------- */
  /* Which LOB a credit/debit belongs to is derived from what it IS, not drawn
     at random. assemble() filters discounts and surcharges by LOB, so a random
     assignment both moved premiums between loads and produced nonsense — a
     Sprinkler Credit landing on a trucking quote. "All" applies to every line. */
  const CREDIT_LOB = { Account: "All", Payment: "All", Driver: "Commercial Trucking",
    Vehicle: "Commercial Trucking", Property: "Commercial Property", Cyber: "Cyber" };
  /* Some Account-level items are still line-specific — FMCSA and out-of-service
     rates are motor-carrier concepts and must not surface on a Property or
     Cyber quote, so they override the type-based mapping above. */
  const CREDIT_LOB_BY_CODE = { SUR_FMCSA: "Commercial Trucking", SUR_OOSV: "Commercial Trucking",
    SUR_OOSD: "Commercial Trucking", DISC_CF: "All", SUR_CYBINC: "Cyber", SUR_COASTAL: "Commercial Property" };

  D.discounts = [
    ["Renewal Discount","DISC_RENEWAL","Account",-0.05,"Clean renewal, LR < 50%, ≤2 cancellations"],
    ["CDL Experience Discount","DISC_CDL","Driver",-0.10,"10+ years CDL experience (tiered)"],
    ["Dashcam / Telematics","DISC_DASHCAM","Vehicle",-0.05,"Preferred-vendor dashcams fleet-wide"],
    ["Multi-Policy Discount","DISC_MULTI","Account",-0.03,"Bundled with GL or Property"],
    ["Paid-In-Full Discount","DISC_PIF","Payment",-0.02,"Premium paid in full at binding"],
    ["Sprinkler Credit","DISC_SPRINK","Property",-0.12,"Fully sprinklered building"],
    ["Central Station Alarm","DISC_ALARM","Property",-0.06,"UL-listed central station alarm"],
    ["Full MFA Credit","DISC_MFA","Cyber",-0.20,"MFA on all remote access + email"],
    ["Claims-Free Credit","DISC_CF","Account",-0.08,"No claims in prior 3 years"],
    ["Safety Program Credit","DISC_SAFETY","Account",-0.07,"Documented written safety program"],
  ].map(([name, code, type, value, cond], i) => ({ id: i + 1, name, code, type, value, condition: cond, lob: CREDIT_LOB_BY_CODE[code] || CREDIT_LOB[type] || "All", effectiveDate: "2026-03-01", active: true }));

  D.surcharges = [
    ["FMCSA Alert Surcharge","SUR_FMCSA","Account",0.15,"Open FMCSA BASIC alert"],
    ["OOS Vehicle Violations","SUR_OOSV","Account",0.10,"OOS vehicle rate above threshold"],
    ["OOS Driver Violations","SUR_OOSD","Account",0.10,"OOS driver rate above threshold"],
    ["Hazmat Operations","SUR_HAZMAT","Vehicle",0.35,"Hazmat-endorsed cargo"],
    ["High-Risk Driver","SUR_DRV","Driver",0.30,"Violation Class E on any rated driver"],
    ["No Dashcam Surcharge","SUR_NODASH","Vehicle",0.20,"No dashcams installed"],
    ["Unassigned Driver","SUR_UNASSIGN","Vehicle",0.10,"Vehicle with no rated driver assigned"],
    ["Coastal Wind Exposure","SUR_COASTAL","Property",0.90,"Tier 1 coastal wind zone"],
    ["Prior Cyber Incident","SUR_CYBINC","Cyber",0.60,"2+ incidents or loss > $50k"],
    ["New Venture Debit","SUR_NEWVEN","Account",0.20,"Less than 1 year in business"],
  ].map(([name, code, type, value, cond], i) => ({ id: i + 1, name, code, type, value, condition: cond, lob: CREDIT_LOB_BY_CODE[code] || CREDIT_LOB[type] || "All", effectiveDate: "2026-03-01", active: true }));

  /* Fees support BOTH a fixed dollar amount and a percentage of a chosen basis.
     valueType: "Fixed"  → value is dollars, multiplied by qty (charge type)
     valueType: "Percent"→ value is a %, applied to `percentOf` basis
     Min/Max cap a percentage fee so it stays inside a sensible band. */
  D.fees = [
    { id: 1, name: "Policy Fee", code: "FEE_POLICY", valueType: "Fixed", value: 150, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Policy", basis: "Flat per policy", taxable: false, lob: "All", active: true },
    { id: 2, name: "Broker Fee", code: "FEE_BROKER", valueType: "Percent", value: 8.0, percentOf: "Premium Before Fees",
      minFee: 250, maxFee: 2500, chargeType: "Per Policy", basis: "8% of premium, min $250 / max $2,500 — retained by producing broker", taxable: false, lob: "All", active: true },
    { id: 3, name: "Inspection Fee", code: "FEE_INSPECT", valueType: "Fixed", value: 75, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Policy", basis: "Flat per new business submission", taxable: false, lob: "All", active: true },
    { id: 4, name: "Driver Surcharge Fee", code: "FEE_DRVSUR", valueType: "Fixed", value: 85, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Driver", basis: "Per driver with violations in past 36 months", taxable: false, lob: "Commercial Trucking", active: true },
    { id: 5, name: "MVR / CSA Report Fee", code: "FEE_MVR", valueType: "Fixed", value: 12, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Driver", basis: "Per driver ordered", taxable: false, lob: "Commercial Trucking", active: true },
    { id: 6, name: "Vehicle Inspection Fee", code: "FEE_VEHINSP", valueType: "Fixed", value: 45, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Vehicle", basis: "Per power unit scheduled", taxable: false, lob: "Commercial Trucking", active: true },
    { id: 7, name: "Managing General Agent Fee", code: "FEE_MGA", valueType: "Percent", value: 5.0, percentOf: "Premium Before Fees",
      minFee: 100, maxFee: 0, chargeType: "Per Policy", basis: "5% of premium, min $100 — MGA commission override", taxable: false, lob: "All", active: true },
    { id: 8, name: "Installment Fee", code: "FEE_INSTALL", valueType: "Fixed", value: 10, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Installment", basis: "Per installment when financed", taxable: false, lob: "All", active: false },
    { id: 9, name: "Cyber Scan Fee", code: "FEE_CYBSCAN", valueType: "Fixed", value: 250, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Policy", basis: "Per submission (Kynd security scan)", taxable: false, lob: "Cyber", active: true },
    { id: 10, name: "Property Appraisal Fee", code: "FEE_APPRAISE", valueType: "Fixed", value: 400, percentOf: "—",
      minFee: 0, maxFee: 0, chargeType: "Per Location", basis: "Per location over $5M TIV", taxable: false, lob: "Commercial Property", active: true },
    { id: 11, name: "Surplus Lines Filing Fee", code: "FEE_SLFILE", valueType: "Percent", value: 0.35, percentOf: "Premium + Taxes",
      minFee: 25, maxFee: 500, chargeType: "Per Policy", basis: "0.35% of premium plus taxes, min $25 / max $500", taxable: false, lob: "All", active: true },
    { id: 12, name: "Terrorism (TRIA) Charge", code: "FEE_TRIA", valueType: "Percent", value: 1.5, percentOf: "Coverage Premium",
      minFee: 0, maxFee: 0, chargeType: "Per Policy", basis: "1.5% of coverage premium if TRIA accepted", taxable: true, lob: "All", active: true },
  ];

  /* Trailer types (source: Vehicles tab "Trailer Type" column). The real
     TrailerTypes PhysDam factor table (HelperTables!DA3:DB5) only has two
     buckets — Reefer (0.95) and All Other (0.90) — so every descriptive
     option below maps to one of those two for the APD calc via `pdBucket`;
     the richer list is kept for realistic UI choices (matching the Rating
     Class dropdown's operation type), not because each has its own real
     factor. */
  /* valueBucket is a SEPARATE classification from pdBucket, added for the
     stated-value depreciation table below. Confirmed real and genuinely
     3-way in ams-service's udf_iso_new_rater_get_stated_value_by_year_model
     (major_class_code branches: dry van, reefer, "else" -> flatbed) — a
     finer split than pdBucket's 2-way Reefer/AllOther PD-rate grouping, so
     the two fields legitimately disagree for e.g. Flatbed. Types with no
     real-system analog (Tanker, Lowboy, Dump, Car Hauler, Intermodal
     Chassis) fall to trailerFlatbed, matching that function's own ELSE
     branch default. */
  D.trailerTypes = [
    { id: 1, type: "None — Power Unit Only", pdBucket: "None", valueBucket: null },
    { id: 2, type: "Dry Van / Box — Single", pdBucket: "AllOther", valueBucket: "trailerDryVan" },
    { id: 3, type: "Dry Van / Box — Double", pdBucket: "AllOther", valueBucket: "trailerDryVan" },
    { id: 4, type: "Refrigerated (Reefer)", pdBucket: "Reefer", valueBucket: "trailerReefer" },
    { id: 5, type: "Flatbed", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
    { id: 6, type: "Tanker", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
    { id: 7, type: "Lowboy / Heavy Haul", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
    { id: 8, type: "Dump Trailer", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
    { id: 9, type: "Car Hauler", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
    { id: 10, type: "Intermodal Chassis", pdBucket: "AllOther", valueBucket: "trailerFlatbed" },
  ];
  D.truckTrailerPdFactor = { Reefer: 0.95, AllOther: 0.90, None: 1.00 };

  /* ---------------- Stated Value by Model Year (depreciation schedule) ----------------
     Real structure, confirmed against ams-service's actual stored procedure
     udf_iso_new_rater_get_stated_value_by_year_model (liquibase/functions):
     a vehicle's Stated Value is DERIVED from (model year, vehicle class) via
     this kind of lookup — it is not an independently-typed number. That
     derived value then feeds TWO places: the OCN liability surcharge
     (VEH_OCN, inside the Auto Liability formula) AND the entire Physical
     Damage premium formula (a separate formula this drives, not just a
     shared input) — confirmed via udf_iso_new_rater_pd_rater_calculations,
     which computes premium directly off stated value with no reference to
     the Liability side at all. Age is clamped 0-27, matching the real
     function's own LEAST(27, GREATEST(0, year - model_year)).
     The real function branches into 4 real classes (power unit; dry-van,
     reefer and flatbed trailer, the last also the ELSE-branch default) —
     that structure is real. The dollar VALUES below are NOT — no seed data
     or DDL for iso_new_rater_default_stated_value / the class-specific
     trailer tables could be located, so this is a generated, representative
     depreciation curve (starting values + a tapering year-over-year decline
     to a salvage floor), not a filed schedule. Treat every number here as a
     placeholder for the real filed curve, the same disclosure this
     platform already gives every other unsourced table. */
  D.truckStatedValueByAge = (() => {
    const NEW_VALUE = { powerUnit: 165000, trailerDryVan: 42000, trailerReefer: 68000, trailerFlatbed: 38000 };
    const FLOOR = { powerUnit: 12000, trailerDryVan: 4000, trailerReefer: 9000, trailerFlatbed: 4000 };
    const DEPR = [0, .18, .14, .11, .09, .08, .07, .06, .05, .05, .04, .04, .03, .03, .03];
    const cur = { ...NEW_VALUE };
    const rows = [];
    for (let age = 0; age <= 27; age++) {
      if (age > 0) {
        const d = DEPR[Math.min(age, DEPR.length - 1)];
        Object.keys(cur).forEach(k => { cur[k] = cur[k] * (1 - d); });
      }
      const round500 = n => Math.round(n / 500) * 500;
      rows.push({
        age,
        powerUnit: Math.max(FLOOR.powerUnit, round500(cur.powerUnit)),
        trailerDryVan: Math.max(FLOOR.trailerDryVan, round500(cur.trailerDryVan)),
        trailerReefer: Math.max(FLOOR.trailerReefer, round500(cur.trailerReefer)),
        trailerFlatbed: Math.max(FLOOR.trailerFlatbed, round500(cur.trailerFlatbed)),
      });
    }
    return rows;
  })();
  /* modelYear/refYear -> derived stated value for the given bucket
     ("powerUnit"/"trailerDryVan"/"trailerReefer"/"trailerFlatbed"). Exposed
     on VX so quote-portal.html can call it directly when a vehicle or
     trailer's model year changes. refYear defaults to this platform's
     standing "current" reference date (2026) rather than the browser's
     real clock, matching every other date-relative table on this platform. */
  D.truckStatedValueFor = (modelYear, bucket, refYear) => {
    refYear = refYear || 2026;
    const age = Math.max(0, Math.min(27, refYear - (+modelYear || refYear)));
    const row = D.truckStatedValueByAge.find(r => r.age === age) || D.truckStatedValueByAge[0];
    return row[bucket] != null ? row[bucket] : row.powerUnit;
  };

  /* Driver violation classes (source: Drivers tab — Violation Class / Points /
     Indiv. Driver Class Factor).
     NOTE: the real DriverClassFctr table (HelperTables!BU4:BY4390, a full
     Age(14-99) x Points(0-50+) cross-join) returns raw values of ~3.05-8.99 at
     0-10+ points, applied as a direct multiplier alongside a dozen ~1.0-scale
     factors in the same formula — which would swing every policy 3-9x
     regardless of driver quality. That's out of step with every other real
     factor in this workbook and reads more like a keyed intermediate value
     than a literal multiplier; we couldn't confirm the intended scale from
     formulas alone. Rather than apply a suspicious-looking raw number, this
     table keeps the existing 0.85-1.85 scale (a defensible stand-in) — flag
     this specific factor for actuarial sign-off before relying on it. */
  D.driverClasses = [
    { id: 1, cls: "A — Clean", pts: "0", factor: 0.85, desc: "No violations or accidents in past 36 months" },
    { id: 2, cls: "B — Minor", pts: "1–3", factor: 1.00, desc: "1–2 minor moving violations" },
    { id: 3, cls: "C — Moderate", pts: "4–6", factor: 1.20, desc: "Multiple violations or 1 at-fault accident" },
    { id: 4, cls: "D — Elevated", pts: "7–9", factor: 1.45, desc: "Major violation or multiple at-fault accidents" },
    { id: 5, cls: "E — High Risk", pts: "10+", factor: 1.85, desc: "DUI / reckless / suspension in past 36 months" },
  ];
  /* ---------------- Rating factors — the REAL registry ----------------
     This used to be 500 generated records with `defaultValue: rf(0.5, 2.2)`
     — random numbers the engine never read. That made the Rating Factors
     screen actively misleading: it looked like the factor registry while
     showing fiction.

     It is now derived from the factors engine.js genuinely rates on, with
     range/default/row-count computed live off the same rate tables. Nothing
     here is invented; if a factor is an approximation rather than verified
     against a filed workbook, it says so. Custom factors an admin adds are
     appended from localStorage and flagged as not-yet-wired, because the
     engine does not yet execute configured factors. */
  const stat = (rows, key) => {
    const vals = (rows || []).map(r => +(typeof key === "function" ? key(r) : r[key])).filter(v => !isNaN(v));
    return vals.length ? { n: vals.length, min: Math.min(...vals), max: Math.max(...vals) } : { n: 0, min: null, max: null };
  };
  const FACTORS = [
    // --- Commercial Trucking · Auto Liability ---
    ["BASE_LC","Territory Base Loss Cost","Commercial Trucking","Auto Liability","Lookup","Garaging State","CA_Liab_LC","truckBaseLC",()=>stat(Object.entries(VXBASE.truckBaseLC).filter(([k])=>k!=="DEFAULT").map(([,v])=>({v})),"v"),null,true],
    ["COV_ILF","Increased Limits Factor (ILF)","Commercial Trucking","Auto Liability","Lookup","Liability Limit","IncreasedLimitsFactors","truckILF",()=>stat(Object.values(VXBASE.truckILF).flatMap(t=>Object.values(t).map(v=>({v}))),"v"),1.00,true],
    ["COV_LIABDED","Liability Deductible Factor","Commercial Trucking","Auto Liability","Lookup","Liability Deductible","CA_Liab_Deductible","truckLiabDed",()=>stat(VXBASE.truckLiabDed,"factor"),0,true],
    /* Default was null — this factor showed "none" in the registry even
       though the real value has been on file since D.programParams was
       built (ProgramDeviations!B2, cross-checked 2026-08-18 against
       ams-service's udf_iso_new_rater_liab_calculations_0564.sql, which
       hardcodes the same 1.67). Read from that one source rather than
       retyped, so the two can't drift apart. */
    ["GLB_LCM","Loss Cost Multiplier (LCM)","Commercial Trucking","Auto Liability","Constant",null,"ProgramDeviations",null,null,
      D.programParams.find(p => p.param === "Liability LCM").value,true],
    ["VEH_PRIMARY","Primary Class Factor","Commercial Trucking","Auto Liability","Lookup","Vehicle Class","CA_PrimaryFactors","truckPrimary",()=>stat(VXBASE.truckPrimary,"liability"),null,true],
    ["VEH_SECONDARY","Secondary Class Factor","Commercial Trucking","Auto Liability","Lookup","Secondary Class (per unit)","CA_SecondaryFactors",null,null,null,true],
    ["VEH_FLEET","Fleet Size Factor","Commercial Trucking","Auto Liability","Lookup","Rated power units","CA_Fleet_TTT","truckFleetSize",()=>stat(VXBASE.truckFleetSize,"factor"),1.00,true],
    ["VEH_AGE","Vehicle Age Factor","Commercial Trucking","Auto Liability","Lookup","Model Year","CA_Age","truckAge",()=>stat(VXBASE.truckAge,"tttLiability"),1.00,true],
    ["VEH_OCN","OCN Factor","Commercial Trucking","Auto Liability","Lookup","Vehicle stated value","CA_OCN_Liability","truckOCN",()=>stat(VXBASE.truckOCN,"factor"),1.00,true],
    ["VEH_RADIUS","Liability Radius Factor","Commercial Trucking","Auto Liability","Lookup","Radius of Operation","RadiusFctrs","truckRadius",()=>stat(VXBASE.truckRadius,"liabilityFactor"),1.00,true],
    ["VEH_NAICS","NAICS Industry Factor","Commercial Trucking","Auto Liability","Lookup","Industry (NAICS)","CA_NAICS_TTT","truckNAICS",()=>stat(VXBASE.truckNAICS,"factor"),1.00,true],
    ["COV_TORT","Tort Limitation Factor","Commercial Trucking","Auto Liability","Constant","Garaging State","Helper_CovTypesOptions_Liab",null,null,1.00,true],
    ["VEH_MILES","Miles Driven Factor","Commercial Trucking","Auto Liability + APD","Lookup","Annual Miles + Radius","Table58","truckMiles",()=>stat(VXBASE.truckMiles,"factor"),1.00,true],
    ["VEH_RATECLASS","Rating Class Factor","Commercial Trucking","Auto Liability + APD","Lookup","Cargo / Hauling Type","Table50","truckRatingClass",()=>stat(VXBASE.truckRatingClass,"factor"),1.00,true],
    ["VEH_DASHCAM","Dashcam Factor","Commercial Trucking","Auto Liability + APD","Lookup","Dashcams Installed","Dashcams_Tbl","truckDashcam",()=>stat(VXBASE.truckDashcam,"factor"),1.00,true],
    // --- Commercial Trucking · Physical Damage ---
    ["APD_RATE","APD Rate by Stated Value","Commercial Trucking","Physical Damage","Lookup","Vehicle stated value","PhysDamRatesByTIV","truckPhysDamRate",()=>stat(VXBASE.truckPhysDamRate.map(([,f])=>({f})),"f"),null,true],
    ["APD_DED","APD Deductible Factor","Commercial Trucking","Physical Damage","Lookup","Physical Damage Deductible","DeductFctr_ALT","truckApdDed",()=>stat(VXBASE.truckApdDed,"factor"),1.00,true],
    ["APD_RADIUS","APD Radius Factor","Commercial Trucking","Physical Damage","Lookup","Radius of Operation","RadiusFctrs","truckRadius",()=>stat(VXBASE.truckRadius,"apdFactor"),1.00,true],
    ["APD_TRAILER","Trailer PhysDam Factor","Commercial Trucking","Physical Damage","Lookup","Trailer Type","TrailerTypes","truckTrailer",()=>stat(Object.values(VXBASE.truckTrailerPdFactor).map(v=>({v})),"v"),1.00,true],
    ["APD_STATE","APD State Factor","Commercial Trucking","Physical Damage","Lookup","Garaging State","Table9","truckApdState",null,1.00,true],
    ["APD_PACKAGE","APD Package Factor","Commercial Trucking","Physical Damage","Lookup","Coverages written","Table11","truckApdPackage",null,1.00,true],
    // --- Commercial Trucking · Account level ---
    ["ACCT_FACTOR","Account-Level Factor","Commercial Trucking","Account Level","Computed","8 underwriting questions","Insured!Z15","truckAcctBizExp",null,1.00,true],
    ["DRV_CLASS","Driver Class Factor","Commercial Trucking","Account Level","Computed","Driver age & violations","Drivers!AF20","driverClasses",()=>stat(VXBASE.driverClasses,"factor"),1.00,false],
    ["DRV_CDL","CDL Experience Discount","Commercial Trucking","Account Level","Computed","Driver CDL experience","Drivers!AF19",null,null,1.00,true],
    ["EXP_MOD","Experience Mod","Commercial Trucking","Account Level","Computed","3yr loss history","Loss History",null,null,1.00,true],
    // --- Commercial Property ---
    ["PR_CONSTR","Construction Type Factor","Commercial Property","Building & BPP","Lookup","Construction Type","CP_BG1","propConstruction",()=>stat(VXBASE.propConstruction,"factor"),1.00,false],
    ["PR_PPC","Protection Class Factor","Commercial Property","Building & BPP","Lookup","Protection Class","PPC","propPPC",()=>stat(VXBASE.propPPC,"factor"),1.00,false],
    ["PR_OCC","Occupancy Factor","Commercial Property","Building & BPP","Lookup","Occupancy","ISO_Class_Descr","propOccupancy",()=>stat(VXBASE.propOccupancy,"factor"),1.00,false],
    ["PR_WIND","Wind / Hail Zone Factor","Commercial Property","Building & BPP","Lookup","Wind / Hail Zone","CP_BG2_WindHailExclFctrs","propWindHail",()=>stat(VXBASE.propWindHail,"factor"),1.00,false],
    ["PR_DED","Property Deductible Factor","Commercial Property","Building & BPP","Lookup","Deductible","DeductFactors","propDed",()=>stat(VXBASE.propDed,"factor"),1.00,false],
    ["PR_IRPM","IRPM (Schedule Rating)","Commercial Property","Building & BPP","Judgment","Underwriter","IRPM",null,null,1.00,false],
    // --- General Liability ---
    ["GL_ILF","Increased Limits Factor","General Liability","Premises / Operations","Lookup","Each Occurrence Limit","ILF","glELP",()=>stat(VXBASE.glELP,"elp"),1.00,false],
    ["GL_CLASS","Class Factor","General Liability","Premises / Operations","Lookup","Class of Business","PremOpsLossCosts",null,null,1.00,false],
    ["GL_SCHED","Schedule Rating Mod","General Liability","Premises / Operations","Judgment","Underwriter","ScheduleRatingMod",null,null,1.00,false],
    ["GL_EXP","Experience Mod","General Liability","Premises / Operations","Computed","Loss history","ExperienceRatingMod",null,null,1.00,false],
    // --- MPL ---
    ["MPL_HG","Hazard Group Factor","Professional Liability (MPL)","Professional Liability","Lookup","Hazard Group","HG_Factors","mplHazardGroups",()=>stat(VXBASE.mplHazardGroups||[],"factor"),null,false],
    ["MPL_ILF","MPL Increased Limits Factor","Professional Liability (MPL)","Professional Liability","Lookup","Per-Claim Limit","ILFs","mplILF",()=>stat(VXBASE.mplILF||[],"ilf"),null,false],
    ["MPL_RET","Retention Factor","Professional Liability (MPL)","Professional Liability","Lookup","Retention","Retention_Factors","mplRetention",()=>stat(VXBASE.mplRetention||[],"factor"),null,false],
    ["MPL_ALAE","ALAE Treatment Factor","Professional Liability (MPL)","Professional Liability","Lookup","Defense Cost Treatment","ALAE_Treatment",null,null,1.00,false],
    ["MPL_YIP","Claims-Made / Year in Program","Professional Liability (MPL)","Professional Liability","Lookup","Year in Program","YIP",null,null,1.00,false],
    // --- Cyber ---
    ["CY_IND","Industry Class Factor","Cyber","All Agreements","Lookup","Industry Classification","HelperTables","cyberIndustry",()=>stat(VXBASE.cyberIndustry||[],"factor"),1.00,false],
    ["CY_MFA","MFA Controls Factor","Cyber","All Agreements","Lookup","MFA Controls","HelperTables","cyberMFA",()=>stat(VXBASE.cyberMFA||[],"factor"),1.00,false],
    ["CY_LIMIT","Aggregate Limit Factor","Cyber","All Agreements","Lookup","Aggregate Limit","Rater","cyberLimits",()=>stat(VXBASE.cyberLimits||[],"factor"),1.00,false],
    ["CY_RET","Retention Factor","Cyber","All Agreements","Lookup","Retention","Rater","cyberRetentions",()=>stat(VXBASE.cyberRetentions||[],"factor"),1.00,false],
    ["CY_REV","Revenue Band Factor","Cyber","All Agreements","Lookup","Annual Revenue","HelperTables",null,null,1.00,false],
    ["CY_SCHED","Schedule Rating Factor","Cyber","All Agreements","Judgment","Underwriter","Program_Deviations",null,null,1.00,false],
    // --- Workers' Compensation ---
    ["WC_CLASS","Class Code Manual Rate","Workers' Compensation","Workers' Compensation","Lookup","Class Code / Payroll Schedule","NCCI class codes","wcClassRates",()=>stat(VXBASE.wcClassRates||[],"ratePer100"),null,false],
    ["WC_EXPMOD","Experience Mod","Workers' Compensation","Workers' Compensation","Computed","Bureau-computed experience rating","NCCI/state bureau",null,null,1.00,false],
    ["WC_SCHED","Schedule Rating Credit/Debit","Workers' Compensation","Workers' Compensation","Judgment","Underwriter","Program_Deviations",null,null,1.00,false],
  ];
  const VXBASE = D; // FACTORS' stat closures read the tables defined above
  /* Factor Assignment — Factor -> Assigned To -> Scope -> Product/LOB ->
     Effective Version. "scope" extends the same vocabulary D.savedFormulas
     already uses ("Class of Business") and D.programParams already uses
     ("Account Factor", "Policy Premium", ...) — this is additive, not a new
     concept. Inferred per factor from its own driver/coverage text rather
     than hand-typed per row, so it can't silently drift from the factor
     list above. */
  const FACTOR_SCOPES = ["Account", "Insured", "Risk", "Vehicle", "Coverage", "Policy", "Location", "State", "Class of Business"];
  function inferFactorScope(code, driver, cov) {
    const d = (driver || "").toLowerCase();
    if (code.startsWith("VEH_") || (code.startsWith("APD_") && d.includes("vehicle"))) return "Vehicle";
    if (d === "garaging state" || d.includes("garaging state")) return "State";
    if (d.includes("driver")) return "Risk";
    if (d.includes("underwriting question")) return "Account";
    if (/class of business|industry|naics/.test(d)) return "Class of Business";
    if (/building|wind|protection class|construction|occupancy/i.test(cov || "")) return "Location";
    if (/limit|deductible|retention/.test(d)) return "Coverage";
    if (!driver || driver === "—" || d.includes("underwriter")) return "Policy";
    return "Coverage";
  }
  D.ratingFactors = FACTORS.map(([code, name, lob, cov, kind, driver, sheet, tableId, statFn, def, verified], i) => {
    let s = { n: null, min: null, max: null };
    try { if (statFn) s = statFn(); } catch (e) { /* table absent — leave blank rather than invent */ }
    const attachments = D.products.filter(p => p.lob === lob)
      .map(p => ({ product: p.name, ratingVersion: p.version }));
    return { id: i + 1, code, name, lob, coverage: cov, kind, driver: driver || "—",
      sourceSheet: sheet, tableId, rowCount: s.n, minValue: s.min, maxValue: s.max,
      defaultValue: def, verified, wired: true, custom: false,
      scope: inferFactorScope(code, driver, cov), assignedTo: cov, attachments,
      range: s.n && s.min !== s.max ? `${s.min} – ${s.max}` : (def != null ? String(def) : "—"),
      effectiveDate: "2026-03-01", version: "v2026.03", active: true };
  });
  /* Custom factors added through the UI. Flagged wired:false because the
     engine does not yet execute configured factors — see the open
     configure→rate loop. Better to say so than to imply they rate. */
  D.customFactors = loadPersisted("vxCustomFactors", []);
  D.customFactors.forEach((c, i) => D.ratingFactors.push({
    ...c, id: 1000 + i, verified: false, wired: false, custom: true,
    rowCount: (c.valueRows || []).length || null,
    range: c.defaultValue != null ? String(c.defaultValue) : "—" }));

  /* A tenant's own imported rate tables (Product Studio JSON import, via
     vxImportProductStudioExport below) — genuinely isolated per tenant, not
     the shared platform tables rate-tables-registry.js reads for known
     engine-rated lines. No seed data: this only ever gets rows through an
     import. See rate-tables.html's "This Tenant's Imported Tables" section. */
  D.tenantRateTables = loadPersisted("vxTenantRateTables", []);

  /* ---------------- Source rating sheets (97 across 5 workbooks) ----------------
     Real tab names read out of the source .xlsb workbooks. `wired` marks the
     sheets a rate table in this platform is actually built from — the rest are
     migrated but not yet consumed, which is worth being able to see. */
  const SHEETS = {
    "DIGITAL TRUCKING Rater_2026-03.xlsb": ["Insured","Drivers","Vehicles","Additional Coverages","Loss History","Alternate Loss Rating (unused)","FinalPremium","ProgramDeviations","HelperTables","CA_Age","CA_SecondaryFactors","CA_Fleet_TTT","CA_Fleet_PPT","CA_OCN_Liability","CA_Liab_Deductible","CA_PD_Deductible","CA_PrimaryFactors","CA_Liab_LC","CA_GKL","IncreasedLimitsFactors","CA_NAICS_TTT","CA_NAICS_PPT","StateCodes","ZIPCodes","PhysDamRatesByTIV","AUTO_LIAB_LDF_Industry","AUTO_LIAB_LDF_Competitors","Trend","DeductibleFactors","Sheet1",">>>"],
    "STD_PLAN_General_Liability_Rater_2025-10-28.xlsb": ["ISO_Rating_GL","ScheduleRatingMod","ExperienceRatingMod","Final_Premium","Ranges_TerrLim","DropDowns","DeductibleFactor","ILTA","ILF","PremOpsLossCosts","ProductsLossCosts","ELPs","AdditionalParameters","ZipCode","Sectors"],
    "Commercial_Property_Rater_2026-01-14.xlsb": ["CP_Rater","IRPM","FinalPremium","Dropdowns","LayerPricingCurves","DeductFactors","ProgramParameters","ISO_Class_Descr","EqBrdwn","CP_BG1","TerritoryMultipliers_BG1","CP_BG1_LOI","StateCodes_BG1","PPC","Vandalism","CP_BG1_TimeElementBaseRateAdj","CP_BG1_TimeElementBIFactors","CP_BG1_TimeElementExtraExpenseF","ZipCode_BG1","CP_BG2","CP_BG2_WindHailExclFctrs","CP_BG2_LOI","CP_BG2_Regions","CP_BG2_TimeElementBaseRateAdjF","CP_BG2_TimeElementBIFactors","CP_BG2_TimeElementExtraExpense","TerritoryDefinitions_BG2","ZipCode_BG2","CP_SCL","CP_SCL_LOI","SCL_OccupancyMapping","CP_SCL_TerrMultiplier","SCL_TheftExclFctrs","CP_SCL_TimeElementNoTheftExclus","CP_SCL_TimeElementTheftExclusio","TerritoryDefinitions_SCL","ZipCode_SCL"],
    "MPL_Rater_2024_12-13_4.xlsb": ["Rater","Classifications","MPL_LossCosts","ALAE_Treatment","HG_Factors","ILFs","Retention_Factors","YIP","IncLoss","RatingMod","ZipCode"],
    "cyber_template.xlsb": ["HelperTables","Program_Deviations","Rater"],
  };
  const WIRED_SHEETS = new Set(D.ratingFactors.map(f => f.sourceSheet).filter(Boolean));
  D.workbookSheets = [];
  { let sid = 1; Object.entries(SHEETS).forEach(([wb, sheets]) => {
      const w = D.workbooks.find(x => x.name === wb) || {};
      sheets.forEach(sheet => D.workbookSheets.push({
        id: sid++, workbook: wb, lob: w.lob || "—", sheet,
        wired: WIRED_SHEETS.has(sheet),
        usedBy: D.ratingFactors.filter(f => f.sourceSheet === sheet).map(f => f.name),
      }));
    }); }


  /* ---------------- Source workbook table inventory ----------------
     Every named rate table in the Digital Trucking workbook, with whether
     this platform actually implements it. Extracted from the .xlsb ListObjects,
     not hand-listed.

     Updated 2026-08-19: the ZIP-to-territory lookup, the full loss-cost and
     ILF tables, the real Driver Class grid and Garagekeepers are all now
     implemented (see rate-data-full.js). Medical Payments and PIP were
     investigated and found NOT ratable from this workbook at all —
     CommonCoverages reads "Rate Same As NTA" with no formula anywhere on the
     tab, pointing to an external reference rate this file doesn't contain.
     That is a confirmed finding, not a gap to close later. */
  D.workbookTables = [
    ["Helper_Liab_VehicleType","HelperTables",6,"none","Vehicle type helper",""],
    ["Helper_Liab_VehicleType_NoDup","HelperTables",3,"none","Vehicle type helper",""],
    ["Helper_CovTypesLimits_Liab","HelperTables",111,"none","Liability coverage/limit options",""],
    ["Helper_Liab_CovTypesNoDup","HelperTables",235,"none","Liability coverage types",""],
    ["PrimaryClasses","HelperTables",64,"none","",""],
    ["SecondaryClasses","HelperTables",12,"none","",""],
    ["MainCov","HelperTables",3,"none","Main coverage dropdown",""],
    ["YesNo_Tbl","HelperTables",3,"none","Yes/No dropdown",""],
    ["VehValueBasis_Tbl","HelperTables",3,"none","Vehicle value basis dropdown",""],
    ["Helper_Liab_DeductTypes","HelperTables",24,"none","Liability deductible types",""],
    ["Helper_CovTypesLimits_MedPay","HelperTables",129,"data","Medical Payments limits","Confirmed 2026-08-19: NOT ratable from this workbook. CommonCoverages!C13 reads literally 'Rate Same As NTA' with no formula anywhere on the tab - a filing note pointing to an external reference rate this file doesn't contain. The 203-row table extracted is a limit MENU, not a rate table."],
    ["Helper_CovTypesLimits_PIP","HelperTables",74,"data","Personal Injury Protection limits","Confirmed 2026-08-19: same finding as Medical Payments - CommonCoverages!C17 = 'Rate Same As NTA', no formula. Cannot be rated from this workbook."],
    ["Helper_CovTypesOptions_Liab","HelperTables",211,"partial","Tort Limitation Factor","Collapsed to a constant 1.00 — NJ tort election not exposed"],
    ["Violations","HelperTables",324,"full","Violation code -> points","All 323 SVC codes extracted; points now come from VIO FIRST + additional rather than a bare count."],
    ["DriverClassFctr","HelperTables",4387,"full","Driver Class Factor","Full 4,386-row age x points grid wired. The earlier 0.85-1.85 stand-in under-penalised poor records - a 19-year-old with 2 violations rates 6.28x, not 1.2x."],
    ["CDL_MaxPolDisc","HelperTables",2,"full","CDL max policy discount",""],
    ["CDL_Exp","HelperTables",5,"none","CDL experience bands","Qualification simplified to a 3+ years boolean"],
    ["DrvClassDeviations","HelperTables",13,"none","Driver class deviations",""],
    ["RadiusFctrs","HelperTables",11,"full","Radius Factor (Liability + APD)",""],
    ["TerrRemap","HelperTables",909,"none","Territory remapping",""],
    ["TrailerTypes","HelperTables",3,"full","Trailer PhysDam Factor",""],
    ["PolicyType","HelperTables",3,"none","Policy type dropdown",""],
    ["Table52","HelperTables",21,"full","Carrier Safety / FMCSA credit",""],
    ["Table50","HelperTables",30,"full","Rating Class Factor",""],
    ["Table56","HelperTables",17,"full","OOS Violation credit",""],
    ["Table57","HelperTables",53,"none","Unclassified helper table",""],
    ["Table58","HelperTables",15,"full","Miles Driven Factor",""],
    ["Table59","HelperTables",42,"full","Loss Frequency credit",""],
    ["Table60","HelperTables",9,"full","Business Experience credit",""],
    ["Table61","HelperTables",3,"full","ICC Filing credit",""],
    ["Table9","HelperTables",51,"full","APD State Factor",""],
    ["Table11","HelperTables",3,"full","APD Package Factor",""],
    ["Table15","HelperTables",3,"full","Renewal Discount",""],
    ["Table26","HelperTables",2,"full","APD Minimum Rate",""],
    ["LiabLC_StateAdj_Tbl","HelperTables",51,"data","Liability loss-cost state adjustment","Extracted, deliberately not applied - it does not appear in the Vehicles!BV10 chain."],
    ["Dashcams_Tbl","HelperTables",4,"full","Dashcam Factor",""],
    ["CA_Age","CA_Age",29,"full","Vehicle Age Factor",""],
    ["CA_SecondaryFactors","CA_SecondaryFactors",44,"full","SecondaryClassFactor","Corrected 2026-08-19 — full 43-row table wired, ranging 0.49x-2.35x. Earlier note wrongly called this a flat constant based on only the first 11 rows."],
    ["CA_Fleet_TTT","CA_Fleet_TTT",181,"full","Fleet Size Factor",""],
    ["CA_Fleet_PPT","CA_Fleet_PPT",21,"full","Fleet Size - Private Passenger Types","Wired 2026-08-26. The 12 PPT primary classes (738x/739x) carry no fleetType, so the truck-curve lookup could never match one and every PPT unit fell through to factor 1.00 - no fleet adjustment at all. The filed PPT curve runs 1.10 (1 unit) to 0.80 (290+); a large PPT fleet was being overcharged by up to 25%."],
    ["CA_OCN_Liability","CA_OCN_Liability",42,"full","OCN Factor",""],
    ["CA_Liab_Deductible","CA_Liab_Deductible",21,"full","Liability Deductible Factor",""],
    ["CA_PD_Deductible","CA_PD_Deductible",53,"none","APD deductible by vehicle type & coverage","NOT a gap after all - Vehicles!BK10 uses DeductFctr_ALT, which is implemented. This table belongs to a different rating path."],
    ["CA_PrimaryFactors","CA_PrimaryFactors",51,"full","Primary Class Factor",""],
    ["CA_Liab_LC","CA_Liab_LC",1954,"full","Territory Base Loss Cost","Full 1,953-row table wired. Previously sampled to one territory per state - the cheapest in TX (234 of 234-1050)."],
    ["GKL_LossCosts","CA_GKL",1621,"full","GaragekeepersFactor","Full calculator built 2026-08-19 — Legal Liability, Direct Primary/Excess and the On-Hook/Sound-Receiving-Equipment endorsements, all five coverage options wired."],
    ["GKL_CovOptions","CA_GKL",6,"full","Garagekeepers coverage options","Garagekeepers coverage not modelled at all"],
    ["GKL_Collision","CA_GKL",5,"full","Garagekeepers collision","Wired — Collision_100/250/500 columns."],
    ["GKL_Comp","CA_GKL",9,"full","Garagekeepers comprehensive","Wired — all 8 deductible-factor rows."],
    ["DirectExcess_Fctr","CA_GKL",2,"full","Garagekeepers direct excess",""],
    ["OnHook_Fctr_COLL","CA_GKL",2,"full","Garagekeepers on-hook collision",""],
    ["OnHook_Fctr_COMP","CA_GKL",2,"full","Garagekeepers on-hook comprehensive",""],
    ["Table73","CA_GKL",3,"none","Garagekeepers helper",""],
    ["SoundEq_Fctr_COLL","CA_GKL",2,"full","Sound equipment collision","Status corrected 2026-08-26: already implemented. engine.js reads FULL.gklSoundEquip.collision on the Garagekeepers sound-equipment path; the row was never updated when that calculator was built."],
    ["SoundEq_Fctr_COMP","CA_GKL",2,"full","Sound equipment comprehensive","Status corrected 2026-08-26: already implemented, same path as SoundEq_Fctr_COLL."],
    ["ILFs","IncreasedLimitsFactors",5217,"full","Increased Limits Factor","Full 5,215-row table wired."],
    ["Table65","IncreasedLimitsFactors",6,"none","ILF helper",""],
    ["CA_NAICS_TTT","CA_NAICS_TTT",6,"full","NAICS Industry Factor",""],
    ["CA_NAICS_PPT","CA_NAICS_PPT",6,"full","NAICS - Private Passenger Types","Wired 2026-08-26 alongside CA_Fleet_PPT. Every filed PPT factor is 1.000, so no premium moved - but the trace now names the table actually read instead of implying the TTT table applied to a private-passenger unit."],
    ["StateCodes","StateCodes",52,"full","State code lookup","Extracted."],
    ["ZIPCodes","ZIPCodes",57085,"full","ZIP -> Territory assignment","Full 57,084-row table extracted and range-compressed; territory now resolves from the garaging ZIP."],
    ["DeductFctr_ALT","PhysDamRatesByTIV",8,"full","APD Deductible Factor",""],
  ].map(([name, sheet, rows, status, drives, note], i) => ({
    id: i + 1, workbook: "DIGITAL TRUCKING Rater_2026-03.xlsb", lob: "Commercial Trucking",
    name, sheet, rows, status, drives: drives || "—", note: note || "" }));


  /* ---------------- Quote-form input coverage vs the source rater ----------------
     Audited field-by-field against the Insured, Vehicles, Drivers,
     CommonCoverages, ExperienceRatingMod_ALT1 and LossRating_ALT2 tabs.
     "account" means we capture the answer once for the policy where the
     rater captures it per vehicle (or per claim) — the value is used, but a
     mixed fleet cannot be expressed. */
  D.inputGaps = [
    ["Insured","Insured Name / DBA","have",""],
    ["Insured","Mailing Address / City / Zip","have",""],
    ["Insured","Policy Effective Date","have",""],
    ["Insured","Policy Type","have",""],
    ["Insured","Eligible for Renewal Discount","have",""],
    ["Insured","Prior Carrier","have",""],
    ["Insured","Years in Business","have",""],
    ["Insured","Carrier Safety Rating","have",""],
    ["Insured","FMCSA Alerts","have",""],
    ["Insured","Requires ICC Filing","have",""],
    ["Insured","Dashcams","have",""],
    ["Insured","OOS Violations - Vehicles / Drivers","have",""],
    ["Insured","Loss Frequency","have",""],
    ["Vehicles","Vehicle # / Description","have",""],
    ["Vehicles","Garaging State","have",""],
    ["Vehicles","Model Year","have",""],
    ["Vehicles","Vehicle Value","have",""],
    ["Vehicles","Primary Class","have",""],
    ["Vehicles","Trailer Type","have",""],
    ["Vehicles","Annual Miles Driven","have",""],
    ["Vehicles","Vehicle Type / Classification","missing","Trucks-Tractors-Trailers vs Private Passenger Types. Engine assumes TTT for every unit, so the PPT factor columns (CA_Fleet_PPT, CA_NAICS_PPT) can never be reached."],
    ["Vehicles","Garaging Zip Code","missing","Real rater resolves territory from ZIP via the 57,085-row ZIPCodes table; we approximate territory by state."],
    ["Vehicles","Garaging City","missing","Used with ZIP for territory validation."],
    ["Vehicles","Valuation Basis","missing","Original Cost New vs Stated Amount."],
    ["Vehicles","NAICS Code","account","Captured once for the account; the rater sets it per vehicle."],
    ["Vehicles","Radius","account","Captured once for the account; the rater sets it per vehicle."],
    ["Vehicles","Rating Class","account","Captured once for the account; the rater sets it per vehicle."],
    ["Vehicles","Secondary Class","have","Full 43-code CA_SecondaryFactors table wired 2026-08-19, selectable per vehicle."],
    ["Vehicles","Coverage Selection - Liability / APD","account","Selected once for the whole policy; the rater selects per vehicle, so a fleet cannot mix covered and uncovered units."],
    ["Vehicles","Liability Occurrence Limit","account","One limit for the whole fleet; the rater sets it per vehicle."],
    ["Vehicles","Deductible Type - Liability","missing","Combined Single Limit vs Property Damage Per Accident vs None - each has its own factor column."],
    ["Vehicles","Deductible Type - APD","missing","Not captured."],
    ["Vehicles","Deductible Amount - Liability / APD","account","One amount for the fleet; the rater sets it per vehicle."],
    ["Vehicles","Number of Units","missing","Each schedule row can represent several identical units; we force one row per unit."],
    ["Drivers","Driver # / Name / Age","have",""],
    ["Drivers","Driver License State","have",""],
    ["Drivers","CDL Experience (Years)","have","Rater uses a 0 / 1 / 2 / 3+ banded list; we take a free number."],
    ["Drivers","Violations in Past 36 Months (count)","have",""],
    ["Drivers","Violation Type","missing","The rater picks from 324 SVC violation codes, each carrying its own first/additional point values. We take a bare count and infer a class, so a DUI and a paperwork violation score identically."],
    ["Additional Coverages","Uninsured Motorist","absent","Whole tab unimplemented."],
    ["Additional Coverages","Medical Payments","absent","Confirmed not ratable from this workbook - priced off an external NTA reference rate this file doesn't contain, not a formula. The limit menu is browsable in Rate Tables regardless."],
    ["Additional Coverages","Personal Injury Protection","absent","Same finding as Medical Payments - CommonCoverages!C17 = 'Rate Same As NTA', no in-workbook formula."],
    ["Additional Coverages","Hired Auto Liability","absent","Whole tab unimplemented."],
    ["Additional Coverages","Non-Owned Auto Liability","absent","Whole tab unimplemented."],
    ["Additional Coverages","Trailer Interchange","absent","Whole tab unimplemented."],
    ["Additional Coverages","Garagekeepers' Insurance","have","Built 2026-08-19 — location schedule in the Quote Portal, full engine calculator, verified against the CommonCoverages!U38:AB38 formula chain."],
    ["Loss History","Individual claim listing (14 cols)","account","We take 3 aggregate numbers instead of a claim-by-claim listing, so earned car years and the experience period are approximated from current fleet size."],
    ["Alternate Loss Rating (unused)","Actuarial loss rating (24 cols)","absent","CORRECTED 2026-08-19: an earlier note here claimed FinalPremium takes MAX(ExperienceMod, LossRating_ALT2) and could override the experience mod. That was checked against source and is false - FinalPremium contains zero references to LossRating_ALT2 or ExperienceRatingMod at all, and no other sheet in the workbook references LossRating_ALT2 either. It is an orphaned tab, structurally disconnected from the rated premium. Its own formulas also depend on AUTO_LIAB_LDF_Industry and AUTO_LIAB_LDF_Competitors, both of which are blank in this file - so even taken on its own terms the tab cannot currently produce a number. Building it would mean inventing both the connection to FinalPremium and the LDF tables it needs, for a feature the source workbook does not use. Not recommended without the carrier supplying real factors and confirming intended use."],
    ["Alternate Loss Rating (unused)","DOT # / MC #","absent","Carrier identifiers not captured anywhere."],
  ].map(([tab, field, status, note], i) => ({ id: i + 1, tab, field, status, note }));

  D.taxes = D.states.map((s, i) => ({ id: i + 1, state: s.abv, stateName: s.name, premiumTax: s.premiumTax,
    surplusTax: s.surplusTax, stampingFee: s.stampingFee, basis: "Net Written Premium", active: true,
    countyCount: D.counties.filter(c => c.state === s.abv && c.taxRate > 0).length }));

  /* ---- County-level taxes ----
     A single state can have MANY counties each charging their own local tax on
     top of the state premium tax. Total tax = state premium tax + county tax
     (+ surplus lines + stamping fee where applicable). */
  const TAXTYPES = ["County Premium Tax", "Local Fire Marshal Tax", "Municipal Surcharge", "County Assessment"];
  D.countyTaxes = D.counties.filter(c => c.taxRate > 0).map((c, i) => {
    const st = D.states.find(s => s.abv === c.state);
    return { id: i + 1, county: c.name, fips: c.fips, state: c.state, stateName: c.stateName,
      stateTax: st ? st.surplusTax : 0, countyTax: c.taxRate,
      totalTax: +((st ? st.surplusTax : 0) + c.taxRate).toFixed(2),
      taxType: pick(TAXTYPES), basis: "Net Written Premium",
      appliesTo: pick(["All LOBs", "All LOBs", "Property only", "Auto only", "Liability only"]),
      effectiveDate: "2026-01-01", active: true };
  });

  D.premiumRules = [
    { id: 1, name: "Account Factor Minimum", code: "R_ACCT_MIN", type: "Minimum", scope: "Account Factor", value: 0.85, lob: "Commercial Trucking", active: true },
    { id: 2, name: "Account Factor Maximum", code: "R_ACCT_MAX", type: "Maximum", scope: "Account Factor", value: 1.50, lob: "Commercial Trucking", active: true },
    { id: 3, name: "Minimum Policy Premium (Trucking)", code: "R_MIN_TRUCK", type: "Minimum", scope: "Policy Premium", value: 2500, lob: "Commercial Trucking", active: true },
    { id: 4, name: "Minimum Policy Premium (MPL)", code: "R_MIN_MPL", type: "Minimum", scope: "Policy Premium", value: 750, lob: "Professional Liability (MPL)", active: true },
    { id: 5, name: "Max Experience Credit", code: "R_MAX_CRED", type: "Maximum", scope: "Experience Rating", value: 0.10, lob: "Commercial Trucking", active: true },
    { id: 6, name: "GL Experience Mod Floor", code: "R_GL_EXPFLOOR", type: "Minimum", scope: "Experience Rating", value: 0.90, lob: "General Liability", active: true },
    { id: 7, name: "MPL Max UW Credit", code: "R_MPL_UWCR", type: "Maximum", scope: "Underwriter Mod", value: 0.25, lob: "Professional Liability (MPL)", active: true },
    { id: 8, name: "Large Loss Threshold", code: "R_LARGELOSS", type: "Threshold", scope: "Loss Rating", value: 100000, lob: "Commercial Trucking", active: true },
  ];

  /* ---------------- Rules ---------------- */
  D.eligibilityRules = [
    // name, code, desc, lob, evaluable, severity
    ["Eligible States","EL_STATES","Risk must be in a state marked Included in Rater","All",true,"decline"],
    ["Eligible NAICS Codes","EL_NAICS","Class of Business must map to an approved NAICS code","All",false,"decline"],
    ["Hazmat Restriction","EL_HAZMAT","Hazmat requires umbrella referral above $1M CSL","Commercial Trucking",false,"refer"],
    ["Fleet Size Minimum","EL_FLEETMIN","Minimum 3 power units for fleet rating","Commercial Trucking",true,"refer"],
    ["Radius of Operation","EL_RADIUS","Beyond 500mi radius requires DOT compliance review","Commercial Trucking",true,"refer"],
    ["Building Age Limit","EL_BLDGAGE","Buildings over 75 years require inspection","Commercial Property",false,"refer"],
    ["Vacancy Restriction","EL_VACANCY","Vacancy over 30% is ineligible","Commercial Property",false,"decline"],
    ["Revenue Ceiling","EL_REVENUE","Annual revenue over $250M is ineligible for MPL","Professional Liability (MPL)",true,"decline"],
    ["Prior Coverage Requirement","EL_PRIORCOV","Continuous prior coverage required for claims-made","Professional Liability (MPL)",false,"refer"],
    ["Security Control Baseline","EL_SECBASE","Minimum partial MFA required for cyber eligibility","Cyber",true,"refer"],
    /* Cargo-specific — real questions from the production Eligibility Questions
       screen (Commodities/Vehicles/Drivers/... left nav). Now evaluable
       because the Commodities Hauled schedule (quote-portal.html) added real
       fields for these instead of leaving them with no matching input. */
    ["Pulls Doubles","EL_DOUBLES","Pulling double trailers requires underwriter review","Commercial Trucking",true,"refer"],
    ["Pulls Triples","EL_TRIPLES","Pulling triple trailers requires underwriter review","Commercial Trucking",true,"refer"],
    ["Unsecured Loads","EL_UNSECURED","Hauling unsecured loads requires underwriter review","Commercial Trucking",true,"refer"],
    ["Oversize / Overweight Loads","EL_OVERSIZE","Oversize or overweight loads require underwriter review","Commercial Trucking",true,"refer"],
    ["Waste / Refuse Materials","EL_WASTE","Hauling waste or refuse materials requires underwriter review","Commercial Trucking",true,"refer"],
    /* Real production Eligibility Questions for standalone WC — see
       wc-eligibility-ques.component.html. Evaluable because the WC quote
       form (quote-portal.html) carries real fields for each of these. */
    ["OSHA Violations","EL_OSHA","3+ OSHA violations in the prior 3 years requires underwriter review","Workers' Compensation",true,"refer"],
    ["Workplace Fatality","EL_WCFATAL","A workplace fatality in the prior 3 years is a hard decline","Workers' Compensation",true,"decline"],
    ["Uninsured Subcontractors","EL_WCSUBCON","Subcontractors hired without their own WC coverage require underwriter review","Workers' Compensation",true,"refer"],
    ["Prior WC Coverage Declined","EL_WCDECLINED","A prior carrier declining or non-renewing WC coverage requires underwriter review","Workers' Compensation",true,"refer"],
  ].map(([name, code, desc, lob, evaluable, severity], i) => ({ id: i + 1, name, code, desc, lob, evaluable, severity, active: rnd() > .05 }));

  /* ---------------- Rating versions ---------------- */
  const CHG_ADD = [
    ["Tort Limitation Factor","Vehicle","New state-level tort factor split out of the base loss cost"],
    ["APD Package Factor","Vehicle","Credit when APD is bundled with Liability on one submission"],
    ["Dashcam Factor","Vehicle","No-dashcam surcharge introduced at 1.20×"],
    ["Unassigned Driver Factor","Driver","1.10× surcharge for vehicles with no rated driver"],
    ["County Tax Layer","Tax","Local county premium tax applied on top of state tax"],
    ["Driver Surcharge Fee","Fee","Per-driver fee for drivers with violations in past 36 months"],
    ["Broker Fee","Fee","Flat per-policy fee retained by the producing broker"],
    ["MFA Controls Factor","Cyber","Multi-factor authentication posture factor"],
    ["Wind/Hail Zone Factor","Property","Tier 1 coastal wind loading"],
    ["Hazard Group Factor","Professional","5-band hazard group replaces flat class factor"],
  ];
  const CHG_MOD = [
    ["Primary Class 321","1.58","1.62","Heavy Truck-Tractor Long-Distance A — per Q3 filing"],
    ["Primary Class 351","2.05","2.13","Extra-Heavy TT Long-Distance A"],
    ["Liability LCM","1.62","1.67","Loss cost multiplier increase"],
    ["Selected Loss Trend","0.055","0.070","Guy Carpenter 2022 / ISO 2023 blend"],
    ["OOS Vehicle Surcharge","8%","10%","Adverse OOS development"],
    ["CA Territory T2 Base Loss Cost","4,750","4,890","ISO loss cost adoption"],
    ["Fleet Size Factor 5–9 units","1.045","1.061","Fleet curve recalibration"],
    ["APD Deductible $5,000","0.462","0.497","ISO deductible table refresh"],
    ["Minimum Policy Premium","2,250","2,500","Program minimum raised"],
    ["Account Factor Max","1.35","1.50","Widened underwriter authority band"],
  ];
  const CHG_REM = [
    ["Trailer Class 682 (legacy)","Deprecated — remapped to class 672"],
    ["Flat Territory Load","Superseded by territory-specific loss costs"],
    ["Legacy Experience Table","Replaced by credibility-weighted experience mod"],
  ];

  D.versions = [];
  let vid = 1;
  D.products.forEach(p => {
    /* Version lifecycle, in the order a version actually moves through it:
         Draft      — being edited, not yet live
         Scheduled  — approved, with a future effective date
         Published  — the version currently rating new business
         Expired    — superseded by a newer Published version
         Archived   — deliberately retired, kept only for audit
       Every active product carries a Draft next-version so there is always
       something real to publish; older history alternates Expired/Archived. */
    const hist = [
      ...(p.status === "Draft" ? [] : [{ v: "v2026.06", status: "Draft", start: "", end: "" }]),
      { v: p.version, status: p.status === "Draft" ? "Draft" : "Published", start: "2026-03-01", end: "" },
      { v: "v2025.11", status: "Expired", start: "2025-11-01", end: "2026-02-28" },
      { v: "v2025.06", status: "Archived", start: "2025-06-01", end: "2025-10-31" },
    ];
    hist.forEach((h, hi) => {
      const nAdd = hi === 0 ? ri(2, 4) : ri(1, 3);
      const nMod = hi === 0 ? ri(3, 6) : ri(2, 4);
      const nRem = rnd() > 0.55 ? 1 : 0;
      const changes = [
        ...CHG_ADD.slice(ri(0, 5)).slice(0, nAdd).map(([f, cat, d]) =>
          ({ type: "Added", factor: f, category: cat, from: "—", to: "new", detail: d })),
        ...CHG_MOD.slice(ri(0, 4)).slice(0, nMod).map(([f, a, b, d]) =>
          ({ type: "Changed", factor: f, category: "Rating Factor", from: a, to: b, detail: d })),
        ...CHG_REM.slice(ri(0, 2)).slice(0, nRem).map(([f, d]) =>
          ({ type: "Removed", factor: f, category: "Rating Factor", from: "active", to: "—", detail: d })),
      ];
      // Rate lock: premiums quoted before this date are honoured at the prior
      // version's rates. A Draft has no effective date yet, so it has no rate
      // lock date either — left blank rather than invented.
      let lockStr = "";
      if (h.start) { const lock = new Date(h.start); lock.setDate(lock.getDate() - ri(14, 45)); lockStr = lock.toISOString().slice(0, 10); }
      D.versions.push({ id: vid++, product: p.name, lob: p.lob, version: h.v, status: h.status,
        effectiveStart: h.start, effectiveEnd: h.end,
        rateLockDate: lockStr,
        rateLockDays: ri(30, 90),
        createdBy: p.owner, createdOn: dt(30, 400),
        factorCount: ri(40, 320), quotesRated: h.status === "Published" ? ri(80, 520) : (h.status === "Draft" ? 0 : ri(0, 300)),
        added: changes.filter(c => c.type === "Added").length,
        changed: changes.filter(c => c.type === "Changed").length,
        removed: changes.filter(c => c.type === "Removed").length,
        changes,
        rateImpact: rf(-4.5, 9.5, 1),
        notes: pick(["Annual rate revision","ISO loss cost update adopted","Territory realignment","Factor table refresh from filing","Initial program launch","Deductible curve update"]) });
    });
  });
  D.versions = loadPersisted("vxVersionsState", D.versions);

  /* ---------------- Quotes / policies ---------------- */
  const AGENTS = ["Dominguez Insurance Group","Pinnacle Risk Partners","Cornerstone Brokerage","Summit Commercial","Blue Harbor Agency","Redwood Risk","Lakeside Underwriters","Vantage Point Insurance"];
  /* Surplus-lines distribution chain: a retail BROKER places business through
     a wholesale MGA, which binds on a CARRIER's paper. All three are real,
     separate parties an underwriter slices loss experience by — the data
     previously carried only the retail agency, so "which MGA is running hot"
     could not be asked.
     broker -> MGA is a stable appointment (a retail agency works through one
     wholesaler here), so the Broker filter can narrow to the MGA selected. */
  const MGAS = ["Anchor Underwriting Managers","Crestline Specialty MGA","Tideline Program Managers","VeriDex Wholesale Partners"];
  const CARRIERS = ["VeriDex Casualty Co.","Summit Mutual Insurance Co.","Cascade Specialty E&S","Meridian Indemnity","Atlas Surplus Lines Co."];
  const INSUREDS = ["Lonestar Freight LLC","Redline Logistics Inc","Cascade Property Holdings","Summit Manufacturing Co","Harbor Point Restaurants","Precision Engineering PC","Northgate Medical Group","Vertex Data Systems","Ironclad Transport","Blue Ridge Distributors","Everest Contracting","Riverside Apartments LP","Copper Creek Retail","Sterling Financial Advisors","Meridian Health Partners","Apex Warehousing","Golden Gate Couriers","Cardinal Logistics Group","Silverline Trucking","Beacon Professional Svcs"];
  /* Per-state loss bias so the loss-run picture is coherent rather than pure
     noise — a handful of states run genuinely hot, most sit near target, a
     few run clean. Deterministic (seeded off the state itself), not random
     per load. This is a portfolio SAMPLE — no real claims data exists in
     this platform or the source workbook — but it has to be internally
     consistent to be useful for the Loss Run Dashboard below. */
  const STATE_LOSS_BIAS = { TX: 1.35, FL: 1.30, CA: 1.15, LA: 1.40, OK: 1.25, NV: 1.20,
    NY: 1.10, NJ: 1.15, IL: 1.05, PA: 0.95, OH: 0.90, GA: 1.10, NC: 0.95, MI: 1.00,
    WA: 0.85, OR: 0.85, CO: 0.90, AZ: 1.05, MO: 1.00, TN: 0.95, IN: 0.90, WI: 0.80,
    MN: 0.80, VA: 0.85, MD: 0.90,
    // Canadian provinces — cross-border trucking exposure, Loss Run Dashboard only
    ON: 1.20, QC: 1.15, BC: 1.05, AB: 1.10, MB: 0.90, SK: 0.85, NS: 0.90, NB: 0.85,
    NL: 0.90, PE: 0.85, NT: 0.95, NU: 0.95, YT: 0.90,
    DEFAULT: 1.00 };
  /* ~12% of the loss-run sample is cross-border Canadian trucking exposure —
     illustrative only (see the note on STATE_LOSS_BIAS above): the rating
     engine, taxes and every quote form on this platform still only handle US
     states. Canadian rows carry country:"CA" and no county (D.counties is
     US-only) so the dashboard can label and group them correctly. */
  D.quotes = Array.from({ length: 260 }, (_, i) => {
    const p = pick(D.products);
    const isCanada = rnd() < 0.12;
    const s = isCanada ? pick(D.caProvinces) : pick(D.states);
    const prem = ri(1800, 96000);
    const cList = isCanada ? [] : D.counties.filter(c => c.state === s.abv);
    const county = cList.length ? pick(cList).name : null;
    // Claim frequency & severity biased by state, so states with a heavier
    // bias produce more claims and higher incurred losses per premium dollar.
    const bias = STATE_LOSS_BIAS[s.abv] || STATE_LOSS_BIAS.DEFAULT;
    const claims = rnd() < 0.55 * bias ? ri(0, Math.round(2 * bias)) : 0;
    // Diminishing severity per additional claim rather than multiplying
    // flatly by claim count (which produced implausible 150-200%+
    // single-quote loss ratios); calibrated so the portfolio-wide loss
    // ratio centers near the program targets (~55-60%) with real spread.
    const incurredLosses = claims ? Math.round(prem * bias * rf(0.75, 1.55, 2) * (0.35 + 0.5 * claims)) : 0;
    const agent = pick(AGENTS);
    return { id: i + 1, quoteNo: "Q-2026-" + String(10240 + i), insured: pick(INSUREDS), product: p.name, lob: p.lob,
      state: s.abv, county, country: isCanada ? "CA" : "US", agent, premium: prem,
      // deterministic, so the distribution chain doesn't reshuffle per reload
      mga: MGAS[AGENTS.indexOf(agent) % MGAS.length],
      broker: agent,                       // the retail broker IS the producing agency
      carrier: CARRIERS[i % CARRIERS.length],
      status: pick(["Quoted","Quoted","Bound","Bound","Declined","Referred","Expired"]),
      effectiveDate: dt(0, 200), createdOn: dt(1, 210), version: p.version, underwriter: pick(["J. Romero","M. Alvarez","S. Patel","K. Nguyen"]),
      claims, incurredLosses };
  });
  /* ---------------- Users / roles ---------------- */
  /* Roles carry a real RBAC matrix (resource -> actions) and ABAC constraints
     that narrow it by attribute. See assets/js/permissions.js for the model
     and how a decision is reached. `perms` remains as the plain-language
     summary shown in lists — it describes the matrix, it no longer IS it. */
  D.roles = [
    { id: 1, name: "Rating Administrator", users: 2, level: "Admin",
      perms: "Full access: products, versions, all factor tables, publish to production",
      permissions: {
        lobs: ["view","create","edit","delete"], coverages: ["view","create","edit","delete"],
        products: ["view","create","edit","delete","publish"], units: ["view","create","edit","delete"],
        versions: ["view","create","edit","delete","publish","approve"],
        factors: ["view","create","edit","delete","export"], formulas: ["view","create","edit","delete","publish"],
        rateTables: ["view","edit","export"], industry: ["view","create","edit","delete"],
        baseRates: ["view","create","edit","delete","export"], discounts: ["view","create","edit","delete"],
        surcharges: ["view","create","edit","delete"], fees: ["view","create","edit","delete"], taxes: ["view","edit"],
        states: ["view","edit"], counties: ["view","edit"], territories: ["view","create","edit","delete"],
        quotes: ["view","create","export"], lossRuns: ["view","export"],
        users: ["view","create","edit","delete"], roles: ["view","create","edit","delete"],
        audit: ["view","export"], settings: ["view","edit"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        /* Publishing changes what customers are charged, so it is the one
           action gated on the admin having MFA on. */
        { attr: "mfa", op: "isTrue", resources: ["versions","products","formulas"] } ] },

    { id: 2, name: "Actuarial Analyst", users: 3, level: "Write",
      perms: "Edit factor tables and rate versions; cannot publish to production",
      permissions: {
        lobs: ["view"], coverages: ["view"], products: ["view"], units: ["view"],
        versions: ["view","create","edit"],
        factors: ["view","create","edit","export"], formulas: ["view","create","edit"],
        rateTables: ["view","edit","export"], industry: ["view","edit"],
        baseRates: ["view","create","edit","export"], discounts: ["view","edit"],
        surcharges: ["view","edit"], fees: ["view"], taxes: ["view"],
        states: ["view"], counties: ["view"], territories: ["view","edit"],
        quotes: ["view","create","export"], lossRuns: ["view","export"], audit: ["view"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        { attr: "lob", op: "inUser", resources: ["versions","factors","formulas","baseRates","rateTables"] },
        /* The real control behind "cannot publish": a Published version is
           filed rates, so it is not editable by this role at all. */
        { attr: "status", op: "notIn", value: ["Published"], resources: ["versions","formulas","baseRates"] } ] },

    { id: 3, name: "Product Manager", users: 2, level: "Write",
      perms: "Manage products, versions, coverages; read-only on rate tables",
      permissions: {
        lobs: ["view"], coverages: ["view","create","edit"], products: ["view","create","edit"],
        units: ["view","create","edit"], versions: ["view","create","edit"],
        factors: ["view"], formulas: ["view"], rateTables: ["view"], industry: ["view"],
        baseRates: ["view"], discounts: ["view","edit"], surcharges: ["view","edit"], fees: ["view","edit"],
        taxes: ["view"], states: ["view"], quotes: ["view","create"], lossRuns: ["view"], audit: ["view"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        { attr: "lob", op: "inUser", resources: ["products","coverages","versions"] } ] },

    { id: 4, name: "Underwriter", users: 6, level: "Operate",
      perms: "Quote calculation, UW rules (read), eligibility overrides within authority",
      permissions: {
        lobs: ["view"], coverages: ["view"], products: ["view"], versions: ["view"],
        factors: ["view"], rateTables: ["view"], industry: ["view"], baseRates: ["view"],
        discounts: ["view"], surcharges: ["view"], fees: ["view"], taxes: ["view"], states: ["view"],
        quotes: ["view","create","export"], lossRuns: ["view"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        /* The classic ABAC case: authority is a number on the user, not a role.
           Without it you would need a role per limit. */
        { attr: "premium", op: "lte", value: "@authorityLimit", resources: ["quotes"] },
        { attr: "state", op: "inUser", resources: ["quotes"] } ] },

    { id: 5, name: "Compliance Officer", users: 1, level: "Read",
      perms: "Read-only across all modules; manage state filing status",
      permissions: {
        lobs: ["view"], coverages: ["view"], products: ["view"], units: ["view"], versions: ["view","approve"],
        factors: ["view","export"], formulas: ["view"], rateTables: ["view","export"], industry: ["view"],
        baseRates: ["view","export"], discounts: ["view"], surcharges: ["view"], fees: ["view"], taxes: ["view"],
        states: ["view","edit"], counties: ["view"], territories: ["view"],
        quotes: ["view"], lossRuns: ["view","export"], audit: ["view","export"] },
      constraints: [ { attr: "tenantId", op: "eqUser", resources: [] } ] },

    { id: 6, name: "Agent / Broker", users: 12, level: "External",
      perms: "Quote Portal only; own submissions",
      permissions: { products: ["view"], coverages: ["view"], quotes: ["view","create"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        /* An external party sees only what they wrote, in states they are
           appointed for. */
        { attr: "owner", op: "eqUser", resources: ["quotes"] },
        { attr: "state", op: "inUser", resources: ["quotes"] } ] },

    { id: 7, name: "Service Account", users: 2, level: "System",
      perms: "API access for rating calls; no UI access",
      permissions: { quotes: ["view","create"], products: ["view"], factors: ["view"], rateTables: ["view"] },
      constraints: [ { attr: "tenantId", op: "eqUser", resources: [] } ] },

    /* Sits above Underwriter, not beside it — same day-to-day permission
       set (quote calculation, UW rules read-only, eligibility overrides),
       plus the one real capability an Underwriter doesn't have: approving
       or rejecting a quote a severity:"refer" eligibility rule has kicked
       to review (evaluateEligibility() in eligibility.js), and a much
       higher binding authority for when a referred quote clears review.
       Mirrors ams_service's real referral workflow — send_quote_to_uwreview
       / update_all_approvals / ignore_rejected_approvals in requireparams.py
       — which this platform's own eligibility system already produces
       "refer" outcomes for but had no role modeling who actually clears them. */
    { id: 8, name: "Underwriter Manager", users: 1, level: "Operate",
      perms: "Everything an Underwriter has, plus approve/reject quotes referred by eligibility rules",
      permissions: {
        lobs: ["view"], coverages: ["view"], products: ["view"], versions: ["view"],
        factors: ["view"], rateTables: ["view"], industry: ["view"], baseRates: ["view"],
        discounts: ["view"], surcharges: ["view"], fees: ["view"], taxes: ["view"], states: ["view"],
        quotes: ["view","create","export","approve"], lossRuns: ["view","export"], audit: ["view"] },
      constraints: [
        { attr: "tenantId", op: "eqUser", resources: [] },
        { attr: "premium", op: "lte", value: "@authorityLimit", resources: ["quotes"] },
        { attr: "state", op: "inUser", resources: ["quotes"] } ] },
  ];
  const UNAMES = [["Vikas Kumar","Rating Administrator"],["Jorge Romero","Actuarial Analyst"],["Maria Alvarez","Product Manager"],["Sanjay Patel","Compliance Officer"],["Kim Nguyen","Underwriter"],["Dana Whitfield","Underwriter"],["Tom Brennan","Actuarial Analyst"],["Priya Raman","Rating Administrator"],["Alex Chen","Product Manager"],["Rosa Delgado","Underwriter"],["Marcus Webb","Agent / Broker"],["Elena Popov","Agent / Broker"],["AI Rating Copilot","Service Account"],["Rating API Client","Service Account"],["Grace Ellsworth","Underwriter Manager"]];
  /* ABAC needs something on the user's side to compare against, so every user
     carries the attributes the role constraints reference. "*" means
     unrestricted on that axis — an administrator is not licensed state by
     state. Authority limit is the underwriter's binding authority in premium. */
  const ROLE_ATTRS = {
    "Rating Administrator": { lob: ["*"], state: ["*"], authorityLimit: 10000000 },
    "Actuarial Analyst":    { lob: ["Commercial Trucking", "General Liability"], state: ["*"], authorityLimit: 0 },
    "Product Manager":      { lob: ["Commercial Property", "Cyber"], state: ["*"], authorityLimit: 0 },
    "Underwriter":          { lob: ["*"], state: ["TX", "OK", "NM", "LA", "AR"], authorityLimit: 250000 },
    "Underwriter Manager":  { lob: ["*"], state: ["*"], authorityLimit: 1000000 },
    "Compliance Officer":   { lob: ["*"], state: ["*"], authorityLimit: 0 },
    "Agent / Broker":       { lob: ["Commercial Trucking"], state: ["TX", "OK"], authorityLimit: 100000 },
    "Service Account":      { lob: ["*"], state: ["*"], authorityLimit: 1000000 },
  };
  D.users = UNAMES.map(([name, role], i) => ({ id: i + 1, name,
    email: role === "Service Account" ? name.toLowerCase().replace(/\s+/g, ".") + "@system.veridex.io" : name.toLowerCase().replace(/\s+/g, ".") + "@veridex.io",
    role, status: rnd() > .1 ? "Active" : "Suspended", mfa: rnd() > .2 ? "Enabled" : "Disabled",
    attrs: { tenantId: 1, owner: i + 1, ...(ROLE_ATTRS[role] || { lob: ["*"], state: ["*"], authorityLimit: 0 }) },
    lastLogin: dt(0, 40) + " " + String(ri(7, 19)).padStart(2, "0") + ":" + String(ri(0, 59)).padStart(2, "0") }));

  /* ---------------- Audit log ---------------- */
  const AREAS = ["Rating Factors","Base Rates","Products","Rating Versions","State Configuration","Coverages","Discounts","Surcharges","Taxes","Eligibility Rules","Lookup Tables","Users & Roles","System Settings","Formula Builder","Form Builder"];
  const ACTS = ["Updated factor value","Created new record","Deleted record","Cloned configuration","Published version","Imported workbook","Exported configuration","Applied AI recommendation","Changed effective date","Bulk updated rows","Rolled back version","Modified formula"];
  D.audit = Array.from({ length: 220 }, (_, i) => {
    const u = pick(D.users);
    return { id: i + 1, timestamp: dt(0, 120) + " " + String(ri(7, 19)).padStart(2, "0") + ":" + String(ri(0, 59)).padStart(2, "0"),
      user: u.email, area: pick(AREAS), action: pick(ACTS),
      detail: pick(["Primary Class 321: 1.58 → 1.62","OOS Vehicle Surcharge: 8% → 10%","CA T2 Base Loss Cost: $4,750 → $4,890","Dashcam Factor corrected: 1.00 → 1.20","LCM updated per filing","Added 3 new NAICS classes","Retired expired version","Effective date shifted +30 days"]),
      version: pick(["v2026.03","v2026.01","v2025.10","v2024.12"]), ip: `10.${ri(0,40)}.${ri(0,255)}.${ri(1,254)}` };
  });
  /* Persisted, so a change a user actually makes still appears on the Audit
     History screen after navigating to it. Without this the audit log reset
     to seed data on every page load and could only ever show fabricated
     history — never the edit the user had just made. */
  D.audit = loadPersisted("vxAuditState", D.audit);

  /* ---------------- Rating factor change log ----------------
     "Who changed a rating factor value, and to what" — the generic audit log
     above cycles through 8 decorative detail strings regardless of area or
     user, so it can't actually answer that question. This is a SEPARATE,
     purpose-built log that names a real factor from the 46-entry
     D.ratingFactors registry on every row, with a real before/after value
     and a reason. Entries are weighted toward the states/LOBs the loss-run
     sample above runs hot in, so the Loss Run Dashboard can show which
     adverse states have already had a rate action taken and which haven't —
     illustrative correlation, not a claim that this platform executes
     factor changes (it doesn't; see the open configure-to-rate loop noted
     throughout Rating Factors / Formula Builder). */
  const CHANGE_REASONS = ["Adverse loss ratio — quarterly review", "Filed rate revision", "Actuarial indication update",
    "Competitive repositioning", "Data correction", "Annual trend update"];
  D.factorChangeLog = (() => {
    // US only — rating factors in this platform are scoped to US states
    // everywhere else, so a "factor changed for Ontario" wouldn't make sense.
    const usAbvs = new Set(D.states.map(s => s.abv));
    const hotStates = Object.entries(STATE_LOSS_BIAS).filter(([k, v]) => usAbvs.has(k) && v >= 1.15).map(([k]) => k);
    const pool = D.ratingFactors.filter(f => !f.custom && f.kind !== "Constant");
    return Array.from({ length: 60 }, (_, i) => {
      const f = pick(pool);
      const state = rnd() < 0.6 && hotStates.length ? pick(hotStates) : pick(D.states).abv;
      // A few factors (e.g. the Liability Deductible Factor, which is
      // subtracted rather than multiplied) have a real neutral value of
      // exactly 0 — using that as the change log's anchor would log every
      // change as a meaningless "0 -> 0", so fall through to the table's
      // min/max midpoint instead whenever the default is 0 or absent.
      const mid = (f.minValue != null && f.maxValue != null) ? (f.minValue + f.maxValue) / 2 : null;
      const base = (f.defaultValue != null && f.defaultValue !== 0) ? f.defaultValue : (mid || 1);
      const from = +(base * rf(0.85, 1.05, 3)).toFixed(3);
      const delta = rf(0.03, 0.18, 3) * (rnd() < 0.7 ? 1 : -1);
      const to = +(from * (1 + delta)).toFixed(3);
      return { id: i + 1, timestamp: dt(0, 150) + " " + String(ri(7, 19)).padStart(2, "0") + ":" + String(ri(0, 59)).padStart(2, "0"),
        user: pick(D.users.filter(u => u.role === "Actuarial Analyst" || u.role === "Rating Administrator")).email,
        factorCode: f.code, factorName: f.name, lob: f.lob, state, from, to,
        pctChange: from ? +((to / from - 1) * 100).toFixed(1) : 0, reason: pick(CHANGE_REASONS),
        version: pick(["v2026.03","v2026.01","v2025.10"]) };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  })();
  D.factorChangeLog = loadPersisted("vxFactorChangeLog", D.factorChangeLog);

  /* ---------------- Factor change requests (approval + effective dating) ---
     A rating factor is not a setting: changing one changes what an insured
     is charged. Two rules follow, and neither was modelled.

     1. APPROVAL. A change is REQUESTED, then approved or rejected by someone
        else. Until it is approved it does not take effect, so the registry
        always shows what is actually in force rather than the last thing
        anyone typed.
     2. EFFECTIVE DATING. An approved change takes effect FROM A DATE. A
        quote whose rate lock predates that date must still be priced on the
        old value — that is the whole point of a rate lock. So a change adds
        a new value with its own effective window and closes the previous
        one, instead of overwriting it. `valueHistory` below is that record.

     HONEST SCOPE: engine.js rates off its own filed tables, not off this
     registry (see the "Not wired" disclosure on the Rating Factors screen).
     So an approved change here governs the registry, the audit trail and
     what this platform reports was in force on a date — it does not by
     itself move a premium. Said plainly rather than implied otherwise. */
  D.factorChangeRequests = loadPersisted("vxFactorChangeRequests", []);

  /* Seed each factor with the value it currently carries as the first entry
     in its history, so "what was in force on <date>" is answerable from day
     one rather than only after the first edit. */
  D.ratingFactors.forEach(f => {
    if (!f.valueHistory) {
      f.valueHistory = f.defaultValue != null
        ? [{ value: f.defaultValue, effectiveStart: f.effectiveDate || "2026-03-01", effectiveEnd: "",
             approvedBy: null, note: "Initial value on file" }]
        : [];
    }
  });

  /* The value in force on a date — the same shape as D.tableAsOf, so a rate
     lock resolves a factor the same way it resolves a rate table. Returns
     null when the factor had no value yet on that date, rather than
     falling back to today's and pretending it applied. */
  D.factorValueAsOf = (factor, asOf) => {
    const h = (factor && factor.valueHistory) || [];
    if (!h.length) return null;
    if (!asOf) return factor.defaultValue;
    const row = h.find(v => (!v.effectiveStart || v.effectiveStart <= asOf)
                         && (!v.effectiveEnd || v.effectiveEnd >= asOf));
    return row ? row.value : null;
  };

  /* ---------------- System settings ---------------- */
  D.settings = [
    { id: 1, key: "default_currency", label: "Default Currency", value: "USD", category: "Localization" },
    { id: 2, key: "rounding_rule", label: "Premium Rounding Rule", value: "Round to nearest $1", category: "Calculation" },
    { id: 3, key: "calc_precision", label: "Intermediate Factor Precision", value: "3 decimals", category: "Calculation" },
    { id: 4, key: "eff_date_grace", label: "Effective Date Grace Period (days)", value: "3", category: "Versioning" },
    { id: 5, key: "version_strategy", label: "Version Selection Strategy", value: "Transaction date within effective window", category: "Versioning" },
    { id: 6, key: "ai_explanations", label: "AI Premium Explanations", value: "Enabled", category: "AI" },
    { id: 7, key: "ai_impact", label: "AI Pre-Publish Impact Analysis", value: "Enabled", category: "AI" },
    { id: 8, key: "ai_assistant", label: "AI Configuration Assistant", value: "Enabled", category: "AI" },
    { id: 9, key: "audit_retention", label: "Audit Log Retention (months)", value: "84", category: "Compliance" },
    { id: 10, key: "session_timeout", label: "Session Timeout (minutes)", value: "30", category: "Security" },
    { id: 11, key: "mfa_required", label: "Require MFA for Admin Roles", value: "Yes", category: "Security" },
    { id: 12, key: "api_rate_limit", label: "API Rate Limit (req/min)", value: "1200", category: "API" },
    { id: 13, key: "api_version", label: "Active API Version", value: "v1", category: "API" },
    { id: 14, key: "autosave", label: "Configuration Auto-Save", value: "Every 30s", category: "General" },
  ];

  /* ---------------- Notifications ---------------- */
  D.notifications = [
    { id: 1, icon: "fa-triangle-exclamation", color: "var(--cat-5)", title: "3 factors expiring in 14 days", desc: "Digital Trucking Program v2026.03", time: "12m ago" },
    { id: 2, icon: "fa-robot", color: "var(--cat-4)", title: "AI flagged NAICS 484230", desc: "Loss ratio trending +8% — review rate adequacy", time: "1h ago" },
    { id: 3, icon: "fa-file-import", color: "var(--cat-1)", title: "Workbook import completed", desc: "Commercial_Property_Rater_2026-01-14.xlsb — 37 sheets", time: "3h ago" },
    { id: 4, icon: "fa-circle-check", color: "var(--cat-3)", title: "Version published", desc: "VeriDex CyberShield v2026.05 is now Active", time: "1d ago" },
    { id: 5, icon: "fa-user-plus", color: "var(--cat-2)", title: "New user provisioned", desc: "rosa.delgado@veridex.io — Underwriter", time: "2d ago" },
  ];

  /* ---------------- Dashboard aggregates ---------------- */
  D.dashboard = {
    ratingRequests: 18420, quotesGenerated: D.quotes.length, activeVersions: D.versions.filter(v => v.status === "Published").length,
    pendingChanges: 7, productCount: D.products.length, factorCount: D.ratingFactors.length,
    gwp: D.products.reduce((a, p) => a + p.gwp, 0), avgPremium: Math.round(D.quotes.reduce((a, q) => a + q.premium, 0) / D.quotes.length),
    bindRate: 0.38, configChanges30d: 142,
    premiumTrend: [612,648,701,689,742,798,764,831,879,845,912,968],
    requestTrend: [980,1120,1044,1290,1376,1418,1522,1610,1584,1702,1795,1868],
    months: ["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"],
    aiRecs: [
      { sev: "warning", text: "NAICS 484230 (Specialized Freight, Long-Distance) shows an 8% adverse loss-ratio trend over trailing 12 months — consider a +5% factor adjustment." },
      { sev: "danger", text: "3 vehicle records in draft v2026.06 reference deprecated trailer class code 682 — recommend remap to 672." },
      { sev: "info", text: "Renewal Discount utilization is 22% below expected — eligibility criteria may be more restrictive than intended." },
      { sev: "info", text: "Commercial Property BG1 rates have not been refreshed since the 2026-01 filing — ISO published an update in June." },
    ],
    warnings: [
      { sev: "warning", text: "Puerto Rico is configured but excluded from the active rater build (pending HIB membership)." },
      { sev: "info", text: "12 rating factors in v2026.03 have no expiration date set." },
      { sev: "warning", text: "Medical Payments and PIP are configured coverages with no filed rate in the active workbook — priced off an external reference this tenant hasn't sourced." },
    ],
  };

  /* ---------------- Tenants (multi-tenant SaaS) ----------------
     VeriDex is sold as a service — each subscribing carrier is a tenant
     with its own branding, plan tier and enabled lines of business. The
     switcher in the top bar changes which tenant the admin is working in.
     Rating CONFIGURATION (products, rating factors, versions, units,
     discounts/surcharges/fees, saved formulas) is genuinely tenant-
     partitioned — COSMOS.query() enforces a strict tenantId match for every
     collection in COSMOS_TENANT_SCOPED, and Ironclad's Workers' Compensation
     product/factors/formula below are real, isolated rows, not VeriDex's own
     data relabeled. What is still shared, deliberately, across every tenant:
     the underlying filed rate tables (loss costs, ILFs, class factors),
     geography and the coverage tree — every tenant rates against the same
     reference data, only their OWN configuration on top of it differs. */
  /* VeriDex is the platform owner: a single built-in tenant plus, below, ONE
     real onboarded customer (Ironclad Specialty Insurance) — exercised
     through the exact real onboarding shape (Add Tenant -> provisionTenant
     in tenants.html), not a second copy of VeriDex's own data. See the
     "Ironclad onboarding" block after the tenant-partitioning pass below for
     why it is seeded with lobs:[] here and filled in AFTER that pass runs. */
  D.tenants = [
    { id: 1, code: "VERIDEX", nonAdmitted: true, licence: "Surplus Lines", name: "VeriDex Rating Platform", carrier: "VeriDex Casualty Co.", plan: "Enterprise",
      seats: 48, lobs: ["Commercial Trucking","General Liability","Commercial Property","Professional Liability (MPL)","Cyber","Workers' Compensation"],
      status: "Active", since: "2024-03-01", accent: "#f2660d" },
    /* lobs starts EMPTY on purpose. If it named "Workers' Compensation" here,
       the "coverage guarantee" pass a few dozen lines down would mechanically
       clone VeriDex's own "VeriDex Workers' Comp Program" into this tenant
       under VeriDex's own product name — the opposite of a distinct customer
       onboarding their own product. lobs is set for real, and the product
       actually built, in the post-partitioning block below instead. */
    { id: 2, code: "IRONCLAD", nonAdmitted: false, licence: "Admitted", name: "Ironclad Specialty Insurance", carrier: "Ironclad Casualty Co.", plan: "Growth",
      seats: 12, lobs: [], status: "Active", since: "2026-08-28", accent: "#0369a1" },
  ];
  /* Persisted, matching the same pattern products/versions/savedFormulas
     already use — a tenant created (or deleted) through tenants.html's real
     Add Tenant UI has to survive a reload, not reset back to this hardcoded
     pair every time. tenants.html writes this key back on every create,
     edit, delete and clone (grid.js/ag-grid-adapter.js's generic CRUD has no
     built-in persistence — vxAutoSave() is a visual "Saving..." toast only,
     not a real write, on every grid on this platform). */
  D.tenants = loadPersisted("vxTenantsState", D.tenants);
  /* Licensed states + the coverage classes each tenant actually writes.
     Derived from the lines the tenant bought rather than hand-typed per
     tenant, so it cannot drift out of step with D.cob when the coverage
     tree changes. States are a deterministic slice (surplus-lines licences
     are per-state, and no tenant here is licensed in all 50). */
  D.tenants.forEach((t, ti) => {
    const parents = D.cobParents.filter(c => t.lobs.includes(c.lob));
    t.coverageClasses = parents.map(c => c.name);
    t.childClasses = D.cob.filter(c => c.parentCobId && t.lobs.includes(c.lob)).map(c => c.name);
    // 34, 26, 18 or 10 states depending on plan tier — deterministic, not random.
    const n = [34, 26, 18, 10][ti % 4];
    t.states = D.states.slice(0, n).map(s => s.abv);
  });

  D.activeTenantId = +(loadPersisted("vxActiveTenant", null) || 1);
  const activeTenant = D.tenants.find(t => t.id === D.activeTenantId) || D.tenants[0];

  D.meta = { tenant: activeTenant.name, carrier: activeTenant.carrier, env: "Sandbox", build: "2026.08.05", engine: "Veridex Rating Engine v1.0" };

  /* ---------------- Saved rating formulas (Formula Builder) ----------------
     A formula is scoped either to the Account level (applies once across the
     whole policy) or to a specific Class of Business (a coverage in D.cob).
     `attachments` is a list of { product, ratingVersion } pairs — one
     formula can rate on several products' engines at once (e.g. the same
     real Auto Liability math applies to every 483-style trucking product,
     not just one), not a single product/version pair. New/edited/attached
     formulas always land in Draft; an admin promotes each *version* to
     Active from versions.html, which carries every formula attached to it
     live at the same time. */
  /* Corrected 2026-08-19: every token chain below now matches formula-builder's
     own DEFAULT_TOKENS (its "load this coverage, get its real factor chain"
     template) variable-for-variable, in the same order. Before this they used
     a different, older variable vocabulary that didn't match ANY coverage's
     real vocabulary at all (e.g. GL's saved formula referenced "BaseLossCost"
     and "ILF", but GL's real variables are "BasicLimitLossCost" and
     "IncreasedLimitsFactor") and Trucking's Auto Liability formula was missing
     11 of its 17 real factors while referencing a "TrendFactor" the engine
     never even computes for that coverage. Activating a formula now touches
     real rating (see engine.js's applySavedFormula) — leaving the old,
     mismatched tokens in place would have meant a formula marked Active in
     Formula Builder silently replaced the source-workbook-verified Auto
     Liability calculation with an invented 6-factor toy version the moment
     wiring turned on. Making the seed tokens equal the real chain first means
     turning that wiring on changes nothing on day one; it only changes
     anything once someone actually edits a formula in Formula Builder. */
  const SEED_FORMULAS = [
    /* The account factor is the one chain on this platform that is ADDITIVE and
       clamped rather than a product: 1 + the credit/debit answers, held
       inside the filed program band. Seeding it as a formula rather than
       leaving it in code means the composition and the band are configurable,
       an underwriter can see and change which answers move the account factor.
       It reproduces the previous hardcoded expression exactly, so publishing it
       changes no premium.

       CORRECTED 2026-09-01 against ams-service's real stored procedure
       (public.udf_get_factor_for_iso_new_rater): Liability and Physical
       Damage each compute their OWN account-level factor there
       (_liab_acc_level_factor / _pd_acc_level_factor, both real, distinct
       output fields on the same insert) -- not one shared value applied to
       both, which is what this platform modelled until now. This formula is
       now explicitly LIABILITY's; see id 9 below for Physical Damage's,
       which shares most of these terms but not all of them -- Liability
       alone carries BroadenedPollution and DefenseCostAddback, both real,
       Liability-only terms in the source. DriverCriteria is a new term both
       formulas share. */
    { id: 8, name: "Trucking — Account-Level Factor (Auto Liability)", lob: "Commercial Trucking",
      scope: "Account", cob: "__ACCOUNT__",
      attachments: [{ product: "Digital Trucking Program", ratingVersion: "v2026.03" }],
      status: "Active", createdBy: "V. Kumar", updated: "2026-09-01", tested: true,
      lastTestedAt: "2026-09-01",
      tokens: ["MIN","(","AccountFactorMax",",","MAX","(","AccountFactorMin",",",
        "1","+","RenewalDiscount","+","BusinessExperience","+","CarrierSafetyFMCSA","+",
        "OOSVehicles","+","OOSDrivers","+","ICCFiling","+","LossFrequency","+",
        "DriverLicenseStates","+","DriverCriteria","+","BroadenedPollution","+","DefenseCostAddback",")",")"]
        .map(v => ({ t: ["(",")",",","+","MIN","MAX"].includes(v) ? "op" : (isNaN(+v) ? "var" : "num"), v })) },
    /* Physical Damage's own, separately-computed account-level factor -- real
       and distinct in the source, not a stand-in for id 8. Shares Renewal,
       Business Experience, Carrier Safety/FMCSA, both OOS lines, ICC Filing,
       Loss Frequency, Driver Licence States and (new) Driver Criteria with
       Liability's; does NOT carry BroadenedPollution or DefenseCostAddback --
       both are Liability-only in the real system. LossFrequency reuses the
       same banded input Liability's does: the source computes these off two
       DIFFERENT loss ratios (liability_ratio vs pd_ratio), and this platform
       captures only one -- sharing it here is the disclosed simplification,
       not a claim that the two ratios are the same. */
    { id: 9, name: "Trucking — Account-Level Factor (Physical Damage)", lob: "Commercial Trucking",
      scope: "Account", cob: "__ACCOUNT_PD__",
      attachments: [{ product: "Digital Trucking Program", ratingVersion: "v2026.03" }],
      status: "Active", createdBy: "V. Kumar", updated: "2026-09-01", tested: true,
      lastTestedAt: "2026-09-01",
      tokens: ["MIN","(","AccountFactorMax",",","MAX","(","AccountFactorMin",",",
        "1","+","RenewalDiscount","+","BusinessExperience","+","CarrierSafetyFMCSA","+",
        "OOSVehicles","+","OOSDrivers","+","ICCFiling","+","LossFrequency","+",
        "DriverLicenseStates","+","DriverCriteria",")",")"]
        .map(v => ({ t: ["(",")",",","+","MIN","MAX"].includes(v) ? "op" : (isNaN(+v) ? "var" : "num"), v })) },

    { id: 1, name: "Trucking — Auto Liability", lob: "Commercial Trucking", scope: "Class of Business", cob: "Auto Liability",
      attachments: [{ product: "Digital Trucking Program", ratingVersion: "v2026.03" }],
      status: "Active", createdBy: "J. Romero", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      tokens: ["BaseLossCost","×","(","ILF","−","LiabDeductibleFactor",")","×","LCM","×","PrimaryClassFactor","×",
        "SecondaryClassFactor","×","FleetSizeFactor","×","VehicleAgeFactor","×","OCNFactor","×","RadiusFactor","×",
        "NAICSFactor","×","TortLimitationFactor","×","MilesDrivenFactor","×","RatingClassFactor","×","DashcamFactor","×",
        "CDLExpDiscFactor","×","DriverClassFactor","×","VehicleOwnedFactor","×",
        "LossExperienceFactor","×","PaymentPlanFactor","×","UwCreditDebitFactor","×",
        "HeavyFarmFactor","×","HeavyDumpingFactor","×","AccountFactor","×","RemainingFactors"].map(v => ({ t: v === "(" || v === ")" ? "op" : (["×","−"].includes(v) ? "op" : "var"), v })) },
    { id: 2, name: "Trucking — Physical Damage", lob: "Commercial Trucking", scope: "Class of Business", cob: "Physical Damage",
      attachments: [{ product: "Digital Trucking Program", ratingVersion: "v2026.03" }],
      status: "Active", createdBy: "J. Romero", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      tokens: ["VehicleValue","×","APDRate","×","APDDeductibleFactor","×","APDRadiusFactor","×","TrailerPhysDamFactor","×",
        "MilesDrivenFactor","×","RatingClassFactor","×","DashcamFactor","×","APDStateFactor","×","APDPackageFactor","×",
        "CDLExpDiscFactor","×","DriverClassFactor","×","AccountFactor"].map(v => ({ t: v === "×" ? "op" : "var", v })) },
    { id: 3, name: "MPL — Professional Liability", lob: "Professional Liability (MPL)", scope: "Class of Business", cob: "Professional Liability",
      attachments: [{ product: "VeriDex MPL Select", ratingVersion: "v2024.12" }],
      status: "Active", createdBy: "M. Alvarez", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      tokens: ["BasicLimitLossCost","×","LCM","×","AdjILF","×","HazardGroupFactor","×","ALAEFactor","×",
        "ClaimsMadeFactor","×","LossExperienceFactor","×","StateModFactor","×","UWModFactor"].map(v => ({ t: v === "×" ? "op" : "var", v })) },
    { id: 4, name: "Property — Building & BPP", lob: "Commercial Property", scope: "Class of Business", cob: "Property",
      attachments: [{ product: "Commercial Property — Building Group", ratingVersion: "v2026.01" }],
      status: "Active", createdBy: "S. Patel", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      tokens: ["(","TotalInsuredValue","÷","100",")","×","BaseRatePer100","×","ConstructionFactor","×","ProtectionClassFactor","×",
        "OccupancyFactor","×","WindHailFactor","×","DeductibleFactor","×","LCM","×","IRPM"]
        .map(v => ({ t: v === "(" || v === ")" || v === "×" || v === "÷" ? "op" : (v === "100" ? "num" : "var"), v })) },
    { id: 5, name: "GL — Premises/Operations", lob: "General Liability", scope: "Class of Business", cob: "General Liability",
      attachments: [{ product: "Standard GL Program", ratingVersion: "v2025.10" }],
      status: "Active", createdBy: "S. Patel", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      tokens: ["BasicLimitLossCost","×","IncreasedLimitsFactor","×","LCM","×","ClassFactor","×","ScheduleRatingMod","×","ExperienceMod"]
        .map(v => ({ t: v === "×" ? "op" : "var", v })) },
    { id: 6, name: "Cyber — All Agreements", lob: "Cyber", scope: "Class of Business", cob: "Liability",
      attachments: [], status: "Draft", createdBy: "M. Alvarez", updated: "2026-08-19", tested: false, lastTestedAt: null,
      tokens: ["BaseRate","×","BaseRateDeviation","×","RevenueBandFactor","×","IndustryClassFactor","×","MFAControlsFactor","×",
        "AggregateLimitFactor","×","RetentionFactor","×","ScheduleRatingFactor"].map(v => ({ t: v === "×" ? "op" : "var", v })) },
    // Cargo has no filed rate in this program (see engine.js's trucking() Cargo
    // block) — this formula reproduces that same invented placeholder chain
    // term-for-term, not a "real" methodology. Attaching/activating it here
    // does not make the underlying 0.65 rate any more sourced; it only moves
    // where that placeholder is computed from a hardcoded line into a
    // formula an admin can see and edit through Formula Builder.
    { id: 7, name: "Trucking — Cargo", lob: "Commercial Trucking", scope: "Class of Business", cob: "Motor Truck Cargo",
      attachments: [{ product: "Digital Trucking Program", ratingVersion: "v2026.03" }],
      status: "Active", createdBy: "J. Romero", updated: "2026-08-19", tested: true, lastTestedAt: "2026-08-19",
      /* CargoRatePer100 until the Cargo rebuild: that flat placeholder rate
         was replaced by a real classification chain, and the engine now
         supplies CargoLossCostFactor instead. This formula still named the
         retired variable, so it threw "missing value for CargoRatePer100" on
         every quote and the engine silently fell back to its default chain —
         an Active formula that had never actually rated anything. Matches
         engine.js's cargoDefault exactly, so activating it changes nothing. */
      tokens: ["(","CargoLimit","÷","100",")","×","CargoLossCostFactor","×","CargoRadiusFactor"]
        .map(v => ({ t: v === "(" || v === ")" || v === "×" || v === "÷" ? "op" : (v === "100" ? "num" : "var"), v })) },
  ];
  D.savedFormulas = loadPersisted("vxSavedFormulas", SEED_FORMULAS);
  /* One-time repair: a browser that had this page open while Commercial
     Trucking's real formulas were briefly removed (and restored — see
     truckingReal() in engine.js) persisted that gap into vxSavedFormulas,
     and loadPersisted() always prefers a browser's own snapshot over the
     current seed above — so the fresh SEED_FORMULAS restoration alone never
     reached an already-visited browser. Reconcile by adding back whatever
     real Trucking rows the current seed has that the persisted copy is
     missing, id by id, without touching anything else a user saved/edited. */
  (() => {
    const beforeCount = D.savedFormulas.length;
    const missing = SEED_FORMULAS.filter(sf => sf.lob === "Commercial Trucking"
      && !D.savedFormulas.some(f => f.id === sf.id));
    D._formulaRepair = { beforeCount, addedCount: missing.length, addedIds: missing.map(m => m.id) };
    if (!missing.length) return;
    D.savedFormulas = D.savedFormulas.concat(missing);
    try { localStorage.setItem("vxSavedFormulas", JSON.stringify(D.savedFormulas)); } catch (e) {}
  })();

  /* Cross-reference a Computed rating factor to the real formula (built on
     Formula Builder) that documents its calculation — factors.html's
     "Attached formula" field. Matched by (lob, cob) rather than a hardcoded
     id, so it stays correct even if SEED_FORMULAS is reordered. This one is
     not a placeholder: __ACCOUNT__ is the exact (lob, cob) pair engine.js's
     assemble() calls applySavedFormula() with for Commercial Trucking's own
     account-level factor (see truckingReal()), so Account-Level Factor is
     the rare Computed row where the attached formula genuinely IS what the
     engine runs — most factors added later will only have this as a
     documentation cross-reference, since the engine does not read a
     factor's formulaId at rating time. */
  (() => {
    const acct = D.ratingFactors.find(f => f.code === "ACCT_FACTOR");
    const acctFormula = D.savedFormulas.find(f => f.lob === "Commercial Trucking" && f.cob === "__ACCOUNT__");
    if (acct && acctFormula) acct.formulaId = acctFormula.id;

    /* A second, deliberately different kind of pairing — same honesty rule,
       different relationship. ACCT_FACTOR above equals a formula's entire
       OUTPUT (Account-Level Factor *is* what __ACCOUNT__ computes). Driver
       Class Factor is not a formula's output — it is one of many terms
       "Trucking — Auto Liability" (id 1) multiplies together (its tokens
       include DriverClassFactor alongside PrimaryClassFactor, FleetSizeFactor
       and the rest). Attaching it here documents "this factor is ONE INPUT
       consumed by this formula", the more common case a Computed factor will
       actually be in once more than the account-level one carry a link. */
    const drvClass = D.ratingFactors.find(f => f.code === "DRV_CLASS");
    const alFormula = D.savedFormulas.find(f => f.lob === "Commercial Trucking" && f.cob === "Auto Liability");
    if (drvClass && alFormula) drvClass.formulaId = alFormula.id;
  })();

  /* ---------------- Rating factor value rows ----------------
     Keyed by ratingFactors id. Populated via "Configure Values" on the
     Rating Factors grid. Persisted in localStorage since this prototype
     has no backend — otherwise a factor's rows would vanish on navigation. */
  D.factorValues = (() => {
    try { return JSON.parse(localStorage.getItem("vxFactorValues") || "{}"); }
    catch (e) { return {}; }
  })();

  /* ==========================================================================
     Tenant partitioning (Cosmos /tenantId)
     --------------------------------------------------------------------------
     Every tenant-owned collection gets a tenantId so COSMOS.query() can scope
     reads to one partition. Rows are distributed by each tenant's declared
     lobs[]: a tenant only owns configuration for the lines it has bought.
     VeriDex (tenant 1, Enterprise, all 5 LOBs) keeps the bulk of the data,
     which is why it remains the demo default.

     Rate tables, geography, coverage tree and industry classes are NOT
     partitioned — they are shared reference data in this prototype (see
     cosmos-model.js and the note on tenants.html).
     ========================================================================== */
  (() => {
    const PRIMARY = 1;   // tenant 1 — the platform's own enterprise tenant
    /* The two pre-baked demo tenants (VeriDex itself, and Ironclad — whose
       own Workers' Comp product/factors/formula are real, deliberately-built
       rows, not a clone of VeriDex's) get the full "coverage guarantee" below
       so their deliberately-crafted demo data still shows. Any tenant added
       later through the real Add Tenant UI (provisionTenant() in
       tenants.html) is NOT in this set, so it gets none of that cloning —
       its LOB rows come out blank ("Draft, not yet built") below, and its
       products/factors/units/pricing stay empty until a real Product Studio
       JSON is uploaded or someone builds them by hand. This is the fix for
       a new tenant showing what was effectively a copy of VeriDex's own
       platform data on day one. */
    const SEEDED_TENANT_IDS = new Set([1, 2]);
    /* Only the seeded tenants are eligible "owners" of unassigned base seed
       rows (D.products/D.ratingFactors have no persistence layer, so every
       row is un-owned again on every boot — see the ownerFor() guard note
       below). Without this restriction, a newly onboarded tenant declaring
       an Enabled LOB that overlaps a seeded tenant's (e.g. "Commercial
       Trucking") becomes an eligible round-robin target and can actually
       steal real VeriDex rows — not clone them, reassign them away from
       VeriDex entirely. Confirmed with a Node simulation: without this
       guard, adding a 3rd tenant with lobs:["Commercial Trucking"] dropped
       VeriDex's own rating-factor count from 49 to 38.

       Built from each seeded tenant's ORIGINAL, hardcoded lobs (mirrored
       from the D.tenants seed literal above), not from the live D.tenants
       array — because Ironclad's own lobs mutates in place later in this
       file (the "Ironclad onboarding" block below pushes "Workers'
       Compensation" into it, deliberately, AFTER this pass runs) and that
       mutation can itself get written back to localStorage the moment
       tenants.html saves anything. On the next reload, loadPersisted would
       hand back Ironclad's already-mutated lobs, making Ironclad an
       eligible round-robin owner of "Workers' Compensation" here too — and
       split VeriDex's own seeded WC factor rows onto Ironclad by chance,
       shrinking VeriDex's count. Anchoring to the fixed, original seed
       values instead makes this pass's outcome the same on every boot,
       regardless of what tenants.html has since persisted. */
    const SEEDED_TENANT_ORIGINAL_LOBS = {
      1: ["Commercial Trucking","General Liability","Commercial Property","Professional Liability (MPL)","Cyber","Workers' Compensation"],
      2: [],
    };
    const tenantsByLob = {};
    SEEDED_TENANT_IDS.forEach(tid => (SEEDED_TENANT_ORIGINAL_LOBS[tid] || [])
      .forEach(l => (tenantsByLob[l] = tenantsByLob[l] || []).push(tid)));
    // Deterministic pick so a reload doesn't reshuffle which tenant owns a row.
    const ownerFor = (lob, seed) => {
      const owners = tenantsByLob[lob] || [PRIMARY];
      if (owners.length === 1) return owners[0];
      // VeriDex keeps ~60% of shared-LOB rows; the rest round-robin the others.
      const others = owners.filter(id => id !== PRIMARY);
      if (!others.length) return PRIMARY;
      return (seed % 5 < 3) ? PRIMARY : others[seed % others.length];
    };

    // LOBs: one document per (tenant, line the tenant actually bought).
    const baseLobs = D.lobs;
    D.lobs = [];
    let lid = 1;
    D.tenants.forEach(t => t.lobs.forEach(name => {
      const src = baseLobs.find(l => l.name === name);
      if (!src) return;
      if (SEEDED_TENANT_IDS.has(t.id)) {
        D.lobs.push({ ...src, id: lid++, tenantId: t.id });
      } else {
        D.lobs.push({
          id: lid++, code: src.code, name: src.name, desc: src.desc,
          sourceSheets: 0, engine: "No calculation engine — not yet built", status: "Draft", products: 0,
          tenantId: t.id,
        });
      }
    }));
    // Draft/unbought lines stay available to VeriDex so nothing disappears.
    baseLobs.filter(l => !D.tenants[0].lobs.includes(l.name))
      .forEach(l => D.lobs.push({ ...l, id: lid++, tenantId: PRIMARY }));

    /* Guarded to never reassign a tenantId a product/factor ALREADY carries.
       The raw seed arrays never set one, so on a fresh load this behaves
       exactly as before. But D.products persists (loadPersisted above), so
       on a later load this array can already be the persisted one — one
       whose ownership was deliberately and specifically assigned (Ironclad's
       own "Ironclad WC Shield", tenantId 2, not round-robin math). Without
       this guard, THIS pass ran again on every load and reassigned tenantId
       by index/round-robin regardless, which could silently move a real
       tenant's product to a different tenant, or (via the coverage-guarantee
       pass right below, finding no product left owned by tenant 2) clone a
       SECOND, wrongly-named copy to replace the one it just orphaned. */
    D.products.forEach((p, i) => { if (p.tenantId == null) p.tenantId = ownerFor(p.lob, i); });
    D.ratingFactors.forEach((f, i) => { if (f.tenantId == null) f.tenantId = ownerFor(f.lob, i); });

    /* Coverage guarantee: a tenant that bought a line must actually have a
       product configured for it, otherwise switching to that tenant shows an
       empty screen that looks broken rather than intentional. Where the split
       above left a gap, clone a product (and its versions) into that tenant —
       each tenant owning its own copy is what the Cosmos model expects
       anyway, since products are per-tenant configuration. */
    let maxPid = Math.max(...D.products.map(p => p.id));
    let maxVid = Math.max(...D.versions.map(v => v.id));
    // Snapshot the originals first — cloning straight out of the live arrays
    // would let one tenant's clones become the source for the next tenant's,
    // multiplying versions on every pass.
    const seedProducts = D.products.slice();
    const seedVersions = D.versions.slice();
    /* Iterates each seeded tenant's ORIGINAL lobs (same fixed list
       tenantsByLob above uses), not the live t.lobs — Ironclad's own
       onboarding block below adds "Workers' Compensation" to its live lobs
       and handles that line's product/factors/version/formula completely
       itself. If this pass used live lobs, a reload after tenants.html has
       ever persisted that mutation would make this generic pass ALSO try to
       cover "Workers' Compensation" for Ironclad — cloning a second,
       redundant set on top of the onboarding block's own real one. */
    D.tenants.filter(t => SEEDED_TENANT_IDS.has(t.id)).forEach(t => (SEEDED_TENANT_ORIGINAL_LOBS[t.id] || []).forEach(lobName => {
      if (D.products.some(p => p.tenantId === t.id && p.lob === lobName)) return;
      const src = seedProducts.find(p => p.lob === lobName);
      if (!src) return;
      D.products.push({ ...src, id: ++maxPid, tenantId: t.id });
      seedVersions.filter(v => v.product === src.name).forEach(v => {
        D.versions.push({ ...v, id: ++maxVid, tenantId: t.id });
      });
    }));
    // Same guarantee, same original-lobs scoping, for the rating-factor registry.
    const seedFactors = D.ratingFactors.slice();
    let maxFid = Math.max(...D.ratingFactors.map(f => f.id));
    D.tenants.filter(t => SEEDED_TENANT_IDS.has(t.id)).forEach(t => (SEEDED_TENANT_ORIGINAL_LOBS[t.id] || []).forEach(lobName => {
      if (D.ratingFactors.some(f => f.tenantId === t.id && f.lob === lobName)) return;
      seedFactors.filter(f => f.lob === lobName)
        .forEach(f => D.ratingFactors.push({ ...f, id: ++maxFid, tenantId: t.id }));
    }));

    /* Product names are not unique across tenants once cloned above, so a
       name→owner map would collapse them. Resolve ownership per LOB instead,
       and never overwrite a tenantId already assigned by the clone pass. */
    /* Resolve against the PRE-CLONE product list: after the coverage pass a
       product name can exist in several tenants, so the live list is
       ambiguous. The seed list still maps each name to exactly one owner,
       which is the right home for the original (uncloned) documents. */
    const seedOwner = {};
    seedProducts.forEach(p => (seedOwner[p.name] = p.tenantId));
    const ownerOfProduct = (name, lob, seed) =>
      seedOwner[name] != null ? seedOwner[name] : ownerFor(lob, seed);
    D.versions.forEach((v, i) => {
      if (v.tenantId == null) v.tenantId = ownerOfProduct(v.product, v.lob, i);
    });
    D.quotes.forEach((q, i) => { q.tenantId = ownerOfProduct(q.product, q.lob, i); });
    (D.savedFormulas || []).forEach((f, i) => {
      const att = (f.attachments || [])[0];
      f.tenantId = att ? ownerOfProduct(att.product, f.lob, i) : ownerFor(f.lob, i);
    });

    // Pricing rules: "All"-LOB rows are duplicated per tenant so every tenant
    // has its own editable copy rather than sharing one row across tenants.
    // Only the pre-baked demo tenants get this — a newly onboarded tenant's
    // discounts/surcharges/fees stay empty until it builds or uploads its own.
    ["discounts", "surcharges", "fees"].forEach(key => {
      const base = D[key];
      const out = [];
      let nid = 1;
      D.tenants.filter(t => SEEDED_TENANT_IDS.has(t.id)).forEach(t => base.forEach(row => {
        if (row.lob === "All" || t.lobs.includes(row.lob)) out.push({ ...row, id: nid++, tenantId: t.id });
      }));
      D[key] = out;
    });

    // Units aren't LOB-gated (a tenant configures its own unit list once,
    // used across every line) — only the pre-baked demo tenants get a
    // starter copy; a newly onboarded tenant defines its own from scratch.
    {
      const baseUnits = D.units;
      const out = [];
      let uid = 1;
      D.tenants.filter(t => SEEDED_TENANT_IDS.has(t.id)).forEach(t => baseUnits.forEach(row => out.push({ ...row, id: uid++, tenantId: t.id })));
      D.units = out;
    }
  })();

  /* ==========================================================================
     Ironclad onboarding — VeriDex (the platform owner) onboards a real second
     tenant, uploads a product-configuration JSON, and that tenant builds and
     activates its own rating engine on it. Runs here, AFTER the generic
     tenant-partitioning pass above, so it lands as a deliberate addition on
     top of that pass rather than fighting it (see the note on D.tenants[1]).

     This mirrors the real, already-built UI flow step for step rather than
     inventing a separate one:
       1. tenants.html "Add Tenant" -> provisionTenant() creates the tenant's
          own LOB document. (Ironclad's product line is bespoke, so its
          product/factors are NOT cloned from VeriDex's — see step 3.)
       2. products.html "Upload Configuration" reads a JSON's
          product_lob/product_name/product_code (vxMapUploadedConfig in
          core.js) and creates a Draft product scoped to the active tenant.
       3. factors.html: the tenant registers its own rating-factor rows for
          the line (provisionTenant's factor-clone, run here for a bespoke
          product instead of a cloned one).
       4. versions.html: the Draft version is reviewed and Published.
       5. formula-builder.html: ONE formula is authored and marked Active,
          reproducing the same real chain engine.js's workersComp() already
          computes by default — so activating it is genuine (it executes,
          see engine.js's FORMULA_HOOKS) and changes no premium on day one. */
  (() => {
    const T = 2; // Ironclad Specialty Insurance
    const ironclad = D.tenants.find(t => t.id === T);
    /* D.tenants now persists (see loadPersisted("vxTenantsState", ...) below
       the seed array) — a user can delete Ironclad via tenants.html, and that
       deletion has to actually stick on reload, not just remove the tenant
       row while this block goes on rebuilding its product/factors/formula
       every load regardless. If the tenant is gone, so is everything below. */
    if (!ironclad) return;

    // Step 1: the tenant's own LOB document, cloned from the base shape.
    const lobTemplate = D.lobs.find(l => l.name === "Workers' Compensation");
    const lobId = Math.max(0, ...D.lobs.map(l => l.id)) + 1;
    D.lobs.push({ ...lobTemplate, id: lobId, tenantId: T });

    // Step 2: the bespoke product a real JSON upload would create — same
    // shape products.html's upload handler builds, walked forward from
    // Draft to Active/Published the way an admin would after configuring it.
    //
    // D.products persists across reloads (loadPersisted("vxProductsState",
    // ...) above) — by the time this block runs, D.products may already BE
    // the persisted array from a prior session, which may already contain
    // this exact row (or a user's edited copy of it). Guarded so this block
    // is idempotent: it creates Ironclad's product once, the first time
    // there's no persisted copy, and leaves an existing one — edited or not
    // — alone on every load after that, instead of appending a duplicate
    // every time this file runs.
    let ironcladProduct = D.products.find(p => p.tenantId === T && p.code === "IWCS");
    if (!ironcladProduct) {
      const wcTemplate = D.products.find(p => p.lob === "Workers' Compensation" && p.tenantId === 1);
      const productId = Math.max(0, ...D.products.map(p => p.id)) + 1;
      ironcladProduct = {
        id: productId, code: "IWCS", name: "Ironclad WC Shield", lob: "Workers' Compensation",
        cob: ["Workers' Compensation"], states: ironclad.states || [], version: "v2026.09", status: "Active",
        owner: "Uploaded Configuration", updated: "2026-08-29", quotes: 0, gwp: 0,
        appTypeId: wcTemplate ? wcTemplate.appTypeId : 491, raterType: "Custom",
        configClass: "5645", // Carpentry — a contractor-focused book, matching the "Specialty" branding
        tenantId: T,
      };
      D.products.push(ironcladProduct);
    }

    // Step 3: the tenant's own rating-factor registry rows for the line —
    // the same three WC factors VeriDex's own copy carries. D.ratingFactors
    // has no persistence layer of its own — the whole array is rebuilt from
    // scratch every load by the tenant-partitioning pass above. That pass is
    // scoped to each seeded tenant's ORIGINAL lobs (Ironclad's is [] there),
    // so it never covers "Workers' Compensation" for Ironclad — this guard
    // is still kept, defensively, in case that scoping ever changes.
    if (!D.ratingFactors.some(f => f.tenantId === T && f.lob === "Workers' Compensation")) {
      const seedFactors = D.ratingFactors.filter(f => f.lob === "Workers' Compensation" && f.tenantId === 1);
      let maxFid = Math.max(0, ...D.ratingFactors.map(f => f.id));
      seedFactors.forEach(f => D.ratingFactors.push({
        ...f, id: ++maxFid, tenantId: T,
        attachments: [{ product: ironcladProduct.name, ratingVersion: ironcladProduct.version }],
      }));
    }

    // Step 4: a Published rating version for the product. Same persistence
    // caveat as Step 2 (vxVersionsState) — guarded the same way.
    if (!D.versions.some(v => v.tenantId === T && v.product === ironcladProduct.name)) {
      const versionId = Math.max(0, ...D.versions.map(v => v.id)) + 1;
      D.versions.push({
        id: versionId, product: ironcladProduct.name, lob: "Workers' Compensation",
        version: ironcladProduct.version, status: "Published", publishedDate: "2026-08-29",
        publishedBy: "V. Kumar", changeCount: 3, tenantId: T,
      });
    }

    // Step 5: ONE real, Active saved formula. Reproduces engine.js's
    // workersComp() default expression exactly (TotalManualPremium ×
    // ExperienceMod × ScheduleCreditDebit) — same discipline as every other
    // seeded formula on this platform: activating it changes no premium,
    // because it names the same chain the code already computes. Same
    // persistence caveat as Step 2 (vxSavedFormulas) — guarded the same way,
    // so an underwriter's later edit to this formula in Formula Builder
    // survives reloads instead of being overwritten back to the original.
    if (!D.savedFormulas.some(f => f.tenantId === T && f.lob === "Workers' Compensation")) {
      const formulaId = Math.max(0, ...D.savedFormulas.map(f => f.id)) + 1;
      D.savedFormulas.push({
        id: formulaId, name: "Ironclad WC Shield — Workers' Compensation",
        lob: "Workers' Compensation", scope: "Class of Business", cob: "Workers' Compensation",
        attachments: [{ product: ironcladProduct.name, ratingVersion: ironcladProduct.version }],
        status: "Active", createdBy: "Ironclad Onboarding", updated: "2026-08-29",
        tested: true, lastTestedAt: "2026-08-29", tenantId: T,
        tokens: ["TotalManualPremium", "×", "ExperienceMod", "×", "ScheduleCreditDebit"]
          .map(v => ({ t: v === "×" ? "op" : "var", v })),
      });
    }

    // Now that the product is real, the tenant record can honestly say so —
    // set AFTER the generic partitioning pass, so it never triggered that
    // pass's mechanical clone (see the note on D.tenants[1] above). Additive,
    // not a reset: a persisted, later-edited Ironclad record (an underwriter
    // added a second LOB via the edit form) must keep that addition, not have
    // it silently reverted to just Workers' Compensation on every load.
    if (!ironclad.lobs.includes("Workers' Compensation")) ironclad.lobs.push("Workers' Compensation");
    const existingCov = new Set(ironclad.coverageClasses || []);
    D.cobParents.filter(c => c.lob === "Workers' Compensation").forEach(c => existingCov.add(c.name));
    ironclad.coverageClasses = [...existingCov];
    const existingChild = new Set(ironclad.childClasses || []);
    D.cob.filter(c => c.parentCobId && c.lob === "Workers' Compensation").forEach(c => existingChild.add(c.name));
    ironclad.childClasses = [...existingChild];
  })();

  // Replay any Product Studio imports from a previous session — see
  // vxImportProductStudioExport, declared below (function declarations in
  // this file hoist across the whole script, including into this IIFE, the
  // same mechanism ENGINE/S/RATE_TABLES already rely on across script tags
  // elsewhere on this platform).
  g.VX = D;
  (() => {
    let list = [];
    try { list = JSON.parse(localStorage.getItem("vxImportedProductStudioExports") || "[]"); } catch (e) {}
    list.forEach(rec => { try { vxImportProductStudioExport(rec.raw, rec.tenantId); } catch (e) {} });
  })();
})(window);

/* ==========================================================================
   Product Studio import — a real, external "insurance-product-studio-
   product-v1" export (covers / questionnaire / risk / eligibility / rating
   / underwriting / distribution / documents "studios") mapped onto this
   platform's own product / coverage / factor / eligibility model, scoped to
   one tenant.

   Deliberately a SEPARATE path from vxMapUploadedConfig (core.js) — that one
   expects this platform's own {product_lob, coverage_class} shape. This is
   a real, different external schema with real structure of its own, so it
   gets its own mapper rather than being forced through one built for a
   different source.

   What lands as real, and what is disclosed rather than invented:
     - Product, coverages, jurisdictions, base premium: real, taken directly
       from the export.
     - Rating components: the export's own "rating" studio only ever
       declares FACTOR NAMES ("Driver age choices", type:"factor",
       value:"table") — it carries no actual factor VALUES, no rate table
       rows to rate from. Imported as real, named rows in the rating-factor
       registry, flagged wired:false/custom:true — the exact disclosure this
       platform already uses for every factor added through factors.html's
       own UI that the engine doesn't yet execute (see D.customFactors
       above). The one real number the export does carry — the base
       premium — is imported as a real program parameter, not a guess.
     - Line of business: if the export's own family/lineOfBusiness doesn't
       match a line this platform's engine already has a calculator for, it
       lands as a genuinely NEW line with none — flagged lobIsNew (below) and
       given an honest engine value ("No calculation engine — imported, not
       built") rather than this import pretending otherwise.
     - Eligibility rules: imported as real rows, but landed evaluable:false —
       a brand-new line has no quote form on this platform capturing any of
       its condition fields (driver_age, etc.), so evaluateEligibility()
       would have nothing to test them against; saying so plainly is more
       honest than a rule that silently never fires. */
function vxImportProductStudioExport(raw, tenantId) {
  if (!raw || typeof raw !== "object" || !raw.product || !raw.product.name) {
    return { ok: false, reason: "Not a recognized product export — missing product.name." };
  }
  const V = window.VX;
  if (!V) return { ok: false, reason: "Platform data not loaded yet." };
  const tid = tenantId != null ? tenantId : V.activeTenantId;
  const nextId = arr => Math.max(0, ...arr.map(x => +x.id || 0)) + 1;

  const P = raw.product;
  const collKey = raw.collectionsByVersion && Object.keys(raw.collectionsByVersion)[0];
  const coll = collKey ? raw.collectionsByVersion[collKey] : {};
  const covers = (raw.studios && raw.studios.coverage) || coll.covers || [];
  const ratingGroups = (raw.studios && raw.studios.rating) || coll.ratingComponents || [];
  const eligRules = (raw.studios && raw.studios.eligibility) || coll.eligibilityRules || [];

  // ---- 1. Line of business: reuse a real one if the export names a line
  // this platform's engine already rates; otherwise a genuinely new one. ----
  const KNOWN_LOBS = ["Commercial Trucking", "General Liability", "Commercial Property",
    "Professional Liability (MPL)", "Cyber", "Workers' Compensation"];
  const wantLob = P.family || P.lineOfBusiness || "Imported Line";
  let lobName = KNOWN_LOBS.find(n => n.toLowerCase() === String(wantLob).toLowerCase())
    || KNOWN_LOBS.find(n => n.toLowerCase() === String(P.lineOfBusiness || "").toLowerCase());
  const lobIsNew = !lobName;
  if (!lobName) lobName = wantLob;

  if (!V.lobs.some(l => l.name === lobName && l.tenantId === tid)) {
    V.lobs.push({
      id: nextId(V.lobs), code: (lobName.replace(/[^A-Za-z]/g, "").slice(0, 6) || "IMP").toUpperCase(),
      name: lobName, sourceSheets: 0,
      engine: lobIsNew ? "No calculation engine — imported, not built" : "(existing engine)",
      status: "Draft", products: 0,
      desc: "Imported from " + (raw.schema || "an external product export") + ".",
      tenantId: tid,
    });
  }

  // ---- 1b. Unit Configuration: what these coverages are rated per.
  // Defaults to the same real per-LOB mapping the seed coverage tree uses
  // (Commercial Trucking -> Vehicle, etc.) instead of a single hardcoded
  // "Coverage Limit" string with no VX.units row behind it — units.html
  // is a tenant-configurable list, and a coverage's unit is supposed to
  // reference a real entry in it (see units.html's own description).
  // A blank-onboarded tenant starts with zero units on purpose, so make
  // sure whichever unit(s) this import actually needs exist for it —
  // a coverage can name its own unit (products.html's Export JSON now
  // carries it), which wins over the LOB default when present. ----
  const defaultUnitName = (V.unitForLob && V.unitForLob[lobName]) || "Coverage Limit";
  const ensureUnit = name => {
    if (!V.units.some(u => u.name === name && u.tenantId === tid)) {
      V.units.push({
        id: nextId(V.units), name, appliesToLob: lobName,
        basis: "Imported from " + (raw.schema || "an external product export"),
        builtIn: false, tenantId: tid,
      });
    }
    return name;
  };
  ensureUnit(defaultUnitName);

  // ---- 2. Coverages: parent/child inferred from conditionalOn (a cover
  // naming another cover from the same export becomes that cover's child). ----
  const byName = {}; covers.forEach(c => { if (c.name) byName[c.name] = c; });
  const nameToRow = {};
  covers.filter(c => c.name && !(c.conditionalOn && byName[c.conditionalOn])).forEach(c => {
    if (V.cob.some(r => r.name === c.name && r.lob === lobName && r.tenantId === tid)) { nameToRow[c.name] = V.cob.find(r => r.name === c.name && r.lob === lobName && r.tenantId === tid); return; }
    const row = {
      id: nextId(V.cob), cobId: 0, parentCobId: null, level: "Primary", code: c.code || c.id,
      name: c.name, lob: lobName, sourceRef: "Uploaded Configuration",
      mandatory: c.availability === "mandatory", childCount: 0,
      ratingBasis: "Not yet rated (imported)", defaultLimit: null, factor: 1,
      unit: ensureUnit(c.unit || defaultUnitName), deductible: null, status: "Draft",
      effectiveStart: P.effectiveFrom || "", effectiveEnd: P.effectiveTo || "",
      version: P.version || "v1", active: true, quotes: 0, tenantId: tid,
    };
    row.cobId = row.id;
    V.cob.push(row); nameToRow[c.name] = row;
  });
  covers.filter(c => c.name && c.conditionalOn && byName[c.conditionalOn] && nameToRow[c.conditionalOn]).forEach(c => {
    if (V.cob.some(r => r.name === c.name && r.lob === lobName && r.tenantId === tid)) return;
    const parent = nameToRow[c.conditionalOn];
    V.cob.push({
      id: nextId(V.cob), cobId: 0, parentCobId: parent.id, level: "Child", code: c.code || c.id,
      name: c.name, lob: lobName, parentName: parent.name, sourceRef: "Uploaded Configuration",
      mandatory: c.availability === "mandatory", childCount: 0,
      ratingBasis: "Not yet rated (imported)", defaultLimit: null, factor: 1,
      unit: ensureUnit(c.unit || defaultUnitName), deductible: null, status: "Draft",
      effectiveStart: P.effectiveFrom || "", effectiveEnd: P.effectiveTo || "",
      version: P.version || "v1", active: true, quotes: 0, tenantId: tid,
    });
    parent.childCount++;
  });

  // ---- 3. Product ----
  let product = V.products.find(p => p.code === P.code && p.tenantId === tid);
  if (!product) {
    product = {
      id: nextId(V.products), code: P.code || ("IMP" + Date.now()), name: P.name, lob: lobName,
      cob: Object.keys(nameToRow), states: P.jurisdictions || [],
      version: P.version || "v1", status: P.status === "draft" ? "Draft" : "Active",
      // lastModified is already a short display string ("01-Sept-2026"), not
      // ISO — slicing it like a timestamp mangled it ("01-Sept-20"). Prefer
      // the real ISO timestamp when the export carries one.
      owner: "Uploaded Configuration",
      updated: (P.lastModifiedAt ? P.lastModifiedAt.slice(0, 10) : P.lastModified) || null,
      quotes: 0, gwp: 0, appTypeId: null, raterType: "Custom", tenantId: tid,
    };
    V.products.push(product);
  }

  // ---- 4. Rating components -> the custom-factor registry (wired:false) —
  // real names, no invented values beyond what the export itself states. ----
  let factorCount = 0;
  let tableCount = 0;
  ratingGroups.forEach(g => {
    (g.items || []).forEach(item => {
      const code = item.id || (g.group + "-" + item.name);
      if (V.customFactors.some(f => f.code === code && f.tenantId === tid)) return;
      const kind = item.type === "base" ? "Constant" : item.type === "factor" ? "Lookup" : "Judgment";
      const hasTable = item.table && item.table.data != null;
      const row = {
        code, name: item.name, lob: lobName, coverage: g.group, kind,
        driver: g.group, sourceSheet: "Uploaded Configuration",
        tableId: hasTable ? (item.table.id || code) : null,
        defaultValue: item.amount != null ? +item.amount : null, tenantId: tid,
      };
      V.customFactors.push(row);
      const n = hasTable ? (Array.isArray(item.table.data) ? item.table.data.length : Object.keys(item.table.data).length) : null;
      V.ratingFactors.push({
        ...row, id: nextId(V.ratingFactors), verified: false, wired: false, custom: true,
        scope: "Coverage", assignedTo: g.group,
        attachments: [{ product: product.name, ratingVersion: product.version }],
        rowCount: n, range: n != null ? n + " rows (uploaded)" : (row.defaultValue != null ? String(row.defaultValue) : "—"),
        effectiveDate: P.effectiveFrom || "", version: product.version, active: true,
      });
      factorCount++;
      // The actual table data behind this Lookup factor, if the export
      // carried one (see products.html's Export JSON — it attaches the
      // real VX[tableId] object) — stored as THIS tenant's own, isolated
      // copy, not merged into or overwriting the shared platform tables.
      if (hasTable && !V.tenantRateTables.some(t => t.factorCode === code && t.tenantId === tid)) {
        V.tenantRateTables.push({
          id: nextId(V.tenantRateTables), tenantId: tid, lob: lobName,
          factorCode: code, factorName: item.name, tableId: row.tableId,
          sourceSheet: item.table.sourceSheet || "Uploaded Configuration",
          rowCount: n, data: item.table.data, importedAt: new Date().toISOString(),
        });
        tableCount++;
      }
    });
  });
  try { localStorage.setItem("vxCustomFactors", JSON.stringify(V.customFactors)); } catch (e) {}
  try { localStorage.setItem("vxProductsState", JSON.stringify(V.products)); } catch (e) {}
  try { localStorage.setItem("vxTenantRateTables", JSON.stringify(V.tenantRateTables)); } catch (e) {}

  // ---- 5. Eligibility rules ----
  let eligCount = 0;
  eligRules.forEach(r => {
    if (!r.name) return;
    const code = r.code || r.id;
    if (V.eligibilityRules.some(x => x.code === code && x.lob === lobName)) return;
    V.eligibilityRules.push({
      id: nextId(V.eligibilityRules), name: r.name, code,
      desc: r.description || r.desc || "", lob: lobName,
      evaluable: false, // no quote form on this platform captures this line's inputs yet
      severity: r.outcomeType === "hard" ? "decline" : "refer",
      active: r.status === "active",
    });
    eligCount++;
  });

  const baseGroup = ratingGroups.find(g => /base premium/i.test(g.group || ""));
  const baseItem = baseGroup && (baseGroup.items || [])[0];
  if (baseItem && baseItem.amount != null && !V.programParams.some(pp => pp.lob === lobName && pp.param === "Base Premium (Uploaded)")) {
    V.programParams.push({ id: nextId(V.programParams), lob: lobName, param: "Base Premium (Uploaded)",
      value: +baseItem.amount, src: "Uploaded Configuration" });
  }

  return {
    ok: true, product, lobName, lobIsNew,
    coverCount: Object.keys(nameToRow).length, factorCount, eligCount, tableCount,
    basePremium: baseItem ? +baseItem.amount : null,
  };
}

/* Persisted so an import survives a reload — replayed (idempotently, via
   the code-based existence checks above) after every normal load, the same
   pattern the Ironclad onboarding block above uses. */
function vxSaveProductStudioImport(raw, tenantId) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem("vxImportedProductStudioExports") || "[]"); } catch (e) {}
  list.push({ raw, tenantId, importedAt: new Date().toISOString() });
  try { localStorage.setItem("vxImportedProductStudioExports", JSON.stringify(list)); } catch (e) {}
}
