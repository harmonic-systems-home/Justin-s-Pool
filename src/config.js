// SINGLE SOURCE OF TRUTH.
//
// Every tab renders from this one object. Commissioning writes measured values
// back INTO it — a clocked BTU populates the gas model, a measured Watts@RPM
// overrides the affinity-law estimate, a measured split-fraction updates the
// turnover math — and each write flips a provenance badge from EST/PENDING to
// MEASURED. Persisted to localStorage and exportable/importable as JSON so a
// commissioning session on the iPad survives to Justin's phone and can be
// committed to the repo as the canonical record.

// provenance stamp. status ∈ 'measured' | 'est' | 'pending'.
export const prov = (status, date = null, note = null) => ({ status, date, note });

export const DEFAULT_CONFIG = {
  schemaVersion: 1,

  // Volumes are DERIVED from editable inputs (Commissioning test 12) so a revised
  // measurement recomputes turnover, heat-rise and split targets everywhere.
  volumes: {
    pool: { length: 35, width: 15, depth: 5, factor: 0.80,
            prov: prov("est", "2026-07-25", "±15%; freeform plan-area factor 0.78–0.85, chose 0.80") },
    spa: { gal: 800, prov: prov("est", "2026-07-25", "diameter + seat depth TBD — measure") },
  },

  rates: {
    // PG&E E-TOU-C assumption: peak 4–9 PM every day, off-peak all other hours.
    electric: { plan: "E-TOU-C", peakStart: "16:00", peakEnd: "21:00", peak: 0.61, offPeak: 0.44,
                prov: prov("est", null, "E-TOU-C summer-ish placeholder — edit to the actual bill") },
    gas: { perTherm: 2.20, prov: prov("est", null, "PG&E ~$/therm — editable") },
  },

  pump: {
    // A measured Watts@RPM here (Commissioning test 3) overrides the affinity-law
    // estimate used everywhere else.
    anchorRpm: 1350, anchorWatts: 136, wattsProv: prov("measured", "2026-07-20", "clamp meter at 1350 RPM"),
    gpmPerRpm: 0.02, gpmProv: prov("est", null, "back-solved from the handoff's ~62k gal/day"),
  },

  heater: { model: null, btu: null,
            prov: prov("pending", null, "rating plate illegible — clock the gas meter, see Commissioning") },

  valves: {
    deck: "split", pad: "pool",
    splitFraction: { val: 0.12, prov: prov("est", null, "target 10–15% to spa; calibrate via drain-rate test") },
  },

  // Per-window RPM is first-class (CHANGES-REQUESTED #2): Speed 1 and Speed 2 stay
  // SEPARATE, matching the captured data including the 3:00–3:05 overlap.
  schedules: {
    active: [
      { id: "s1", label: "Speed 1", rpm: 3250, start: "07:00", end: "15:05", hours: 8.08, prov: prov("measured", "2026-07-20") },
      { id: "s2", label: "Speed 2", rpm: 3000, start: "15:05", end: "18:02", hours: 2.95, prov: prov("measured", "2026-07-20", "3:00–3:05 overlap charged to Speed 1") },
      { id: "s5", label: "Speed 5", rpm: 1350, start: "18:50", end: "06:55", hours: 12.08, prov: prov("measured", "2026-07-20") },
    ],
    proposed: [
      { id: "p1", label: "Turnover", rpm: 2600, start: "06:55", end: "12:00", hours: 5.08, prov: prov("est", "2026-07-20", "§6.5 draft") },
      { id: "p2", label: "Overnight", rpm: 1350, start: "20:00", end: "06:55", hours: 10.92, prov: prov("est", "2026-07-20", "§6.5 draft") },
    ],
  },

  eggTimers: [
    { btn: 1, label: "Heat pool", rpm: 3450, hours: 3.17 },
    { btn: 2, label: "Heat spa", rpm: 2800, hours: 1.0 },
    { btn: 3, label: "Waterfall show", rpm: 2800, hours: 2.0 },
    { btn: 4, label: "Manual utility", rpm: 3030, hours: null },
  ],

  booster: { start: "09:30", end: "11:30", dogsIn: false, lever: "off" },
  leftTimer: { lever: "on" },

  maintenance: {
    robotSkimmer: "", robotScrubber: "", filterLastCleaned: "", filterCleanPSI: "", poolGuy: "",
    chlorine: "Trichlor floating dispenser + pool-guy weekly dosing. No inline chlorinator / salt cell at the pad. CYA accumulates over years → occasional partial drain/refill (pool guy's domain).",
  },

  notes: "",

  // Commissioning results: testId -> { value, date, who }. These flip badges.
  commissioning: {},

  history: [
    { date: "2002", what: "Waterfall CL115 12 V submersible lights installed (dated fixture).", who: "builder" },
    { date: "orig", what: "Rooftop solar heat loop + SunTouch control. Schedule sized for solar flow → ~4 turnovers/day.", who: "builder" },
    { date: "TBD", what: "Solar removed; air-temp sensor cut (→ SunTouch AIR Error); controller abandoned in place; left Intermatic became a tripper-less power bus.", who: "—" },
    { date: "2026-07", what: "Lamp cord removed; this documentation project started (survey, app, commissioning plan).", who: "Rick" },
  ],
};

// ── derived volume ──────────────────────────────────────────────
// gal = plan-area(L×W×factor) × avg-depth × 7.48 gal/ft³
export const poolGal = (c) => {
  const p = c.volumes.pool;
  return Math.round(p.length * p.width * p.factor * p.depth * 7.48);
};
export const spaGal = (c) => Math.round(c.volumes.spa.gal || 0);
export const totalGal = (c) => poolGal(c) + spaGal(c);

// ── persistence: deep-merge saved over defaults so new keys appear on upgrade ──
function merge(def, saved) {
  if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
  if (def && typeof def === "object") {
    if (!saved || typeof saved !== "object") return def;
    const out = { ...def };
    for (const k of Object.keys(def)) out[k] = merge(def[k], saved[k]);
    for (const k of Object.keys(saved)) if (!(k in out)) out[k] = saved[k]; // keep saved-only (e.g. commissioning)
    return out;
  }
  return saved === undefined ? def : saved;
}
export const loadConfig = (saved) => merge(DEFAULT_CONFIG, saved || {});
