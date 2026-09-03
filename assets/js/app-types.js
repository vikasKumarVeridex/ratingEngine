/* ==========================================================================
   Application-type registry — mirrors ams_service.ins_application_type and
   the submission shape each type actually requires.

   Source of truth, read directly rather than assumed:
     - ams-service/quotes/requireparams.py — the SSIC/USIC/new_rater required-
       param lists for Commercial Trucking. The "new_rater" function (the
       DIGITAL rater this platform's workbook models) has filingInfo,
       commoditiesInfo, uwReviewInfo, addlInfo/aiInfo/pwInfo/wsInfo/lpInfo and
       specialEndorsementsInfo explicitly commented out — those sections
       belong to the older SSIC/USIC submission shape, not the digital rater.
       So Commercial Trucking's quote flow here intentionally stays lean
       (Insured, Coverage, Radius/Vehicles/Drivers) rather than growing those
       sections, which would misrepresent what the digital rater submits.
     - ams-service/cyber_rater/rest_apis/initial_steps.py — the per-app-type
       branches for GL (499/496), Property (492), MPL (497) and Cyber (1102),
       which is where gl_locations / gl_class_codes / property_building_info /
       mpl_locations (itself just data["gl_locations"] reused) actually come
       from.
     - ams-service liquibase SQL — rater_type_id: 1=generic, 2=custom. Every
       product on this platform is Custom (raterType field on D.products).

   sections[] is informational (drives the quote context bar and documents
   what a real submission for that type carries) — it is NOT a rendering
   instruction list; quote-portal.html's tabs already cover "sections",
   the schedules described below are the genuinely-missing structured pieces. */
(function (g) {
  const APP_TYPES = {
    483: { name: "Digital Trucking Program (ISO per-vehicle)", lob: "Commercial Trucking", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "radiusOfOperationsInfo", "vehicles", "drivers"],
      note: "Digital rater — the older filingInfo / UW review / AI-PW-WS-LP / special-endorsements sections are for the legacy SSIC/USIC submission and are explicitly not required here." },
    492: { name: "Commercial Property", lob: "Commercial Property", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "property_building_info"],
      note: "property_building_info is per-location in the real submission — this prototype schedules locations but rates off the primary location only." },
    495: { name: "Excess / Umbrella", lob: "Umbrella / Excess", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo"] },
    496: { name: "GL Package (incl. Liquor Liability)", lob: "General Liability", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "gl_locations", "gl_class_codes", "gl_coverage_checkbox", "liquore_coverage"],
      note: "Liquor Liability is captured (liquore_coverage) but this prototype does not carry filed liquor rates, so it is not wired into the premium — same disclosure pattern as Cargo." },
    497: { name: "MPL Select", lob: "Professional Liability (MPL)", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "mpl_locations", "mpl_class_codes"],
      note: "mpl_locations reuses the same gl_locations structure in the real backend — this prototype does the same." },
    499: { name: "General Liability", lob: "General Liability", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "gl_locations", "gl_class_codes"] },
    1102: { name: "Cyber", lob: "Cyber", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "coveragesInfo", "cyber_info"] },
    /* Source: ams-ui add-submission.component.html — wc_defaults, wc_exposures_data_capture,
       wc_eligibility_ques (three real, dedicated child components), gated by lobIds=[167].
       Confirmed server-side as a real 13-state/company variant family
       (application_type_id 1107-1119 share get_wc_subjective_questions_for_pdf), unlike
       the GL Package's workComp_cov_checkbox, which is a decorative, disabled add-on
       checkbox with no exposure schedule behind it — that is a different, secondary
       mechanism and not modeled here. */
    491: { name: "Workers' Compensation Program", lob: "Workers' Compensation", raterType: "Custom",
      sections: ["genInfo", "insuredInfo", "wc_exposures", "wc_eligibility_ques"],
      note: "Admitted paper, not surplus lines like every other line here — see D.lobs' licenceBasis. Real exposure-schedule structure and real NCCI class codes; representative (not filed) manual rates, same disclosure as every other unsourced rate table on this platform." },
  };
  g.VX_APP_TYPES = APP_TYPES;
  g.vxAppType = id => APP_TYPES[id] || null;
})(window);
