/* ==========================================================================
   Rating engine flowchart — drawn as SVG.

   This began as a vertical stack of styled <div>s with arrow glyphs between
   them, which read as a list wearing a diagram's clothes: no shape
   vocabulary, so a decision looked exactly like a step, and both outcomes of
   a branch sat inside the same box as the question that produced them.

   It now uses the shapes a flowchart is actually made of — pill terminators,
   rounded process boxes, diamonds for decisions — with each outcome on its
   own labelled connector, and a stage rail down the left so the spine every
   line shares is visually separable from the one stage each line implements
   for itself.

   Geometry is computed from the step list rather than hardcoded, so editing
   the flow cannot leave the layout behind.

   Loaded after engine-pipelines.js.
   ========================================================================== */
function ratingFlowchart(rec, pipeline) {
  const lob = (rec && rec.lob) || "this line";
  const steps = (pipeline && pipeline.steps) || [];

  const STAGE = {
    1: { name: "Submission", color: "var(--cat-2)" },
    2: { name: "Which rates", color: "var(--cat-3)" },
    3: { name: "Price coverage", color: "var(--cat-1)" },
    4: { name: "Adjustments", color: "var(--cat-5)" },
    5: { name: "Charges", color: "var(--cat-4)" },
    6: { name: "Result", color: "var(--good)" },
  };

  const FLOW = [
    { t: "start", s: 1, label: "Submission", sub: "Vehicles, drivers, limits, state, coverages selected" },
    { t: "proc", s: 1, label: "Evaluate eligibility rules", sub: "Run before anything is priced" },
    { t: "dec", s: 1, label: "Any decline?",
      out: "Flag decline; any premium is indicative",
      down: "no — referrals are flagged, rating continues" },
    { t: "proc", s: 2, label: "Resolve the rating date",
      sub: "Effective date · rate lock if struck earlier · endorsement uses the original inception" },
    { t: "dec", s: 2, label: "Does the product pin this transaction type?",
      out: "Use that version, reported as pinned",
      down: "no — resolve by date" },
    { t: "proc", s: 2, label: "Read configured rate tables",
      sub: "Partial effective dating; shared tables are not filing snapshots" },
    { t: "dec", s: 3, label: "One active formula matches scope?",
      out: "Evaluate matched formula; errors are reported",
      down: "no — use the built-in chain" },
    { t: "proc", s: 3, label: lob + " factor chain",
      sub: steps.length ? steps.length + " step" + (steps.length === 1 ? "" : "s") + " — listed below the diagram"
                        : "No calculation flow documented for this line yet" },
    { t: "proc", s: 3, label: "Sum every coverage",
      sub: "Per-unit lines are rated unit by unit, then summed" },
    { t: "proc", s: 4, label: "Account-level factor",
      sub: "One policy-wide multiplier, clamped to the filed band" },
    { t: "proc", s: 4, label: "Discounts and surcharges",
      sub: "Only where the risk earns them; undetermined credits are reported with a reason" },
    { t: "dec", s: 5, label: "Is this admitted paper?",
      out: "No surplus-lines tax, no SL filing fee",
      down: "no — SL tax at the state rate, plus the filing fee" },
    { t: "proc", s: 5, label: "Fees, then tax, then county tax" },
    { t: "dec", s: 6, label: "Below the program minimum?",
      out: "The minimum premium applies",
      down: "no — the calculated premium stands" },
    { t: "end", s: 6, label: "Final premium",
      sub: "Returned with the factor trace and the arithmetic performed" },
  ];

  /* SVG does not wrap text, so every label is measured and split here. */
  const wrap = (text, max) => {
    const words = String(text).split(/\s+/);
    const out = [];
    let line = "";
    words.forEach(w => {
      if ((line + " " + w).trim().length > max) { if (line) out.push(line); line = w; }
      else line = (line ? line + " " : "") + w;
    });
    if (line) out.push(line);
    return out;
  };
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tspans = (lines, x, y0, gap) =>
    lines.map((l, i) => '<tspan x="' + x + '" y="' + (y0 + i * gap) + '">' + esc(l) + "</tspan>").join("");

  const RAIL = 108, SX = 168, SW = 372, OX = 606, OW = 300, GAP = 34;
  const CX = SX + SW / 2;

  let y = 18;
  const parts = [];
  const railMarks = [];
  let lastStage = null;

  FLOW.forEach((n, idx) => {
    if (n.s !== lastStage) { railMarks.push({ y: y, s: n.s }); lastStage = n.s; }
    const st = STAGE[n.s];
    const titleLines = wrap(n.label, n.t === "dec" ? 40 : 38);
    const subLines = n.sub ? wrap(n.sub, 50) : [];

    if (n.t === "dec") {
      const h = Math.max(88, 30 + titleLines.length * 17);
      const midY = y + h / 2;
      parts.push(
        '<polygon points="' + CX + ',' + y + ' ' + (SX + SW) + ',' + midY + ' ' + CX + ',' + (y + h) + ' ' + SX + ',' + midY + '"' +
        ' fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="1.2"></polygon>' +
        '<text font-size="12.4" font-weight="650" fill="var(--text)" text-anchor="middle">' +
        tspans(titleLines, CX, midY - (titleLines.length - 1) * 8 + 4, 16) + "</text>");

      const oLines = wrap(n.out, 32);
      const oh = 20 + oLines.length * 15;
      const oy = midY - oh / 2;
      const stroke = n.stop ? "var(--bad)" : "var(--border)";
      const dash = n.stop ? "" : ' stroke-dasharray="4 3"';
      parts.push(
        '<path d="M ' + (SX + SW) + " " + midY + " L " + OX + " " + midY + '" fill="none" stroke="' + stroke +
        '" stroke-width="1.4"' + dash + ' marker-end="url(#fcArrow)"></path>' +
        '<text x="' + ((SX + SW + OX) / 2) + '" y="' + (midY - 7) + '" font-size="9.5" font-weight="700" text-anchor="middle" fill="var(--good)">YES</text>' +
        '<rect x="' + OX + '" y="' + oy + '" width="' + OW + '" height="' + oh + '" rx="' + (n.stop ? oh / 2 : 8) +
        '" fill="var(--surface)" stroke="' + stroke + '" stroke-width="1"' + dash + "></rect>" +
        '<text font-size="11" fill="' + (n.stop ? "var(--bad)" : "var(--text-dim)") + '" text-anchor="middle">' +
        tspans(oLines, OX + OW / 2, oy + 18, 15) + "</text>");
      y += h;
    } else {
      const pill = n.t === "start" || n.t === "end";
      const h = Math.max(54, 22 + titleLines.length * 17 + (subLines.length ? 4 + subLines.length * 14 : 0));
      const accent = n.t === "end" ? "var(--good)" : st.color;
      parts.push(
        '<rect x="' + SX + '" y="' + y + '" width="' + SW + '" height="' + h + '" rx="' + (pill ? h / 2 : 10) +
        '" fill="var(--surface)" stroke="' + (pill ? accent : "var(--border)") + '" stroke-width="' + (pill ? 1.6 : 1) + '"></rect>' +
        (pill ? "" : '<rect x="' + SX + '" y="' + y + '" width="4" height="' + h + '" rx="2" fill="' + accent + '"></rect>') +
        '<text font-size="12.6" font-weight="' + (pill ? 750 : 650) + '" fill="var(--text)" text-anchor="middle">' +
        tspans(titleLines, CX, y + 23, 17) + "</text>" +
        (subLines.length
          ? '<text font-size="10.6" fill="var(--text-mute)" text-anchor="middle">' +
            tspans(subLines, CX, y + 23 + titleLines.length * 17 + 1, 14) + "</text>"
          : ""));
      y += h;
    }

    if (idx < FLOW.length - 1) {
      parts.push(
        '<path d="M ' + CX + " " + y + " L " + CX + " " + (y + GAP) + '" fill="none" stroke="var(--border)" stroke-width="1.5" marker-end="url(#fcArrow)"></path>' +
        (n.down ? '<text x="' + (CX + 11) + '" y="' + (y + 21) + '" font-size="9.5" fill="var(--text-mute)">' + esc(n.down) + "</text>" : ""));
      y += GAP;
    }
  });

  const H = y + 18;
  const rail = railMarks.map((m, i) => {
    const next = railMarks[i + 1] ? railMarks[i + 1].y - 12 : H - 10;
    const st = STAGE[m.s];
    return '<rect x="' + (RAIL - 30) + '" y="' + m.y + '" width="3" height="' + Math.max(26, next - m.y) +
      '" rx="1.5" fill="' + st.color + '" opacity=".45"></rect>' +
      '<text x="' + (RAIL - 40) + '" y="' + (m.y + 13) + '" font-size="10.5" font-weight="800" text-anchor="end" fill="' + st.color + '">' + m.s + "</text>" +
      '<text x="' + (RAIL - 40) + '" y="' + (m.y + 27) + '" font-size="9.6" text-anchor="end" fill="var(--text-mute)">' + esc(st.name) + "</text>";
  }).join("");

  return '<div style="border:1px solid var(--border);border-radius:12px;background:var(--surface-2);padding:16px 14px">' +
    '<div style="overflow-x:auto">' +
    '<svg viewBox="0 0 940 ' + H + '" style="width:100%;min-width:780px;height:auto;display:block" role="img"' +
    ' aria-label="Flowchart of the rating engine for ' + esc(lob) + '">' +
    '<defs><marker id="fcArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">' +
    '<path d="M 0 1 L 7 4 L 0 7" fill="none" stroke="var(--text-mute)" stroke-width="1.3"></path></marker></defs>' +
    rail + parts.join("") + "</svg></div>" +
    (steps.length
      ? '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:6px">' +
        "Stage 3 in full — " + esc(lob) + "</div>" +
        '<ol style="padding-left:20px;margin:0;font-size:12.2px;line-height:1.75;color:var(--text-dim)">' +
        steps.map(s => "<li>" + s + "</li>").join("") + "</ol></div>"
      : "") +
    '<div style="font-size:10.8px;color:var(--text-mute);margin-top:12px;line-height:1.55">' +
    "Eligibility and result assembly are shared. Coverage calculations vary by line. Rate-table dating remains partial." +
    "</div></div>";
}
