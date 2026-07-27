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
    // SMUD Time-of-Day (5–8 PM peak). Fair Oaks is SMUD electric — PG&E supplies
    // only the gas. Seasonal, weekday-based, with a midnight–6 AM EV discount band
    // (the cheapest energy on the calendar, and a target window).
    // SUMMER rates + EV credit are MEASURED off Justin's bill (7/20/26, period
    // 6/17–7/16); WINTER rates are still the web schedule (capture from an Oct–May
    // bill). Fixed weekday periods: peak 5–8 PM; summer mid-peak noon–5 PM +
    // 8 PM–mid; off-peak everything else + all weekend hours; EV band midnight–6 AM
    // = off-peak − discount. (SMUD's ~$27/mo fixed service charge is deliberately
    // NOT modeled — Justin pays it whether or not the pool exists, so it's not a
    // pool cost.)
    electric: {
      plan: "SMUD TOD (5–8 PM)", season: "auto",
      summer: { peak: 0.3765, midPeak: 0.2139, offPeak: 0.1550 },
      winter: { peak: 0.1776, offPeak: 0.1285 },
      ev: { enabled: true, discount: 0.015 },
      prov: prov("measured", "2026-07-20", "summer + EV MEASURED from SMUD bill 7/20/26 (EV credit confirmed active, 444 kWh credited); winter still web"),
    },
    // PG&E gas, Rate G1 S (residential, tiered). The Tier-1 allowance (~0.39
    // therms/day) is spent by the house baseline, so ALL pool-heating gas burns at
    // the MARGINAL price: Tier 2 $2.98 + PPP $0.121 + 2.5% county tax ≈ $3.15/therm.
    gas: { perTherm: 3.15, prov: prov("measured", "2026-07-16", "PG&E bill 7/16/26, G1 S: marginal Tier 2 $2.98 + PPP $0.121 + 2.5% tax ≈ $3.15/therm") },
  },

  pump: {
    anchorRpm: 1350, anchorWatts: 136,
    // Measured Watts@RPM override the affinity-law (P∝RPM³) estimate everywhere
    // (Commissioning test 3). 1350 = clamp meter 7/20; 3450 = pump display during
    // a 1/26/24 Quick Clean run (cube law predicted 2269, measured +6% — good).
    wattsByRpm: { 1350: 136, 3450: 2398 },
    wattsProv: prov("measured", "2026-07-20", "1350 clamp 7/20; 3450 display 1/26/24"),
    gpmPerRpm: 0.02, gpmProv: prov("est", null, "back-solved from the handoff's ~62k gal/day"),
    // The pump's complete 8-slot configuration register — the mirror of the
    // device (record-follows-device). Scheduled slots (1,2,5) mirror
    // schedules.active, which drives the timeline/costs; the rest are here for
    // completeness. Times are PUMP-CLOCK; real = start − clocks.intelliflo offset.
    slots: [
      { slot: 1, mode: "Schedule", rpm: 3250, start: "07:00", end: "15:05", prov: prov("measured", "2026-07-20") },
      { slot: 2, mode: "Schedule", rpm: 3000, start: "15:00", end: "18:02", prov: prov("measured", "2026-07-20", "overlaps Speed 1 3:00–3:05; higher RPM wins") },
      { slot: 3, mode: "Egg timer", rpm: 3450, durationMin: 190, prov: prov("measured", "2026-07-20", "the heating run — 3 h 10 m") },
      { slot: 4, mode: "Manual", rpm: 3030, prov: prov("measured", "2026-07-20", "on-demand button") },
      { slot: 5, mode: "Schedule", rpm: 1350, start: "18:50", end: "06:55", prov: prov("measured", "2026-07-20") },
      { slot: 6, mode: "Disabled", prov: prov("measured", "2026-07-20") },
      { slot: 7, mode: "Disabled", prov: prov("measured", "2026-07-20") },
      { slot: 8, mode: "Disabled", prov: prov("measured", "2026-07-20") },
    ],
    slotsVerified: "2026-07-20",
  },

  // Pad clock offsets (Commissioning test 17). offsetMin = clock − real (negative
  // = behind). NONE of these clocks has battery backup, so an outage resets them.
  // Real time is always DERIVED: real = programmed − offset. Schedules stay stored
  // as PROGRAMMED (device-clock, as photographed); timelines + Costs render REAL.
  // R5 zeroes the offsets (set clocks + promote the TOU schedule in one event).
  clocks: {
    intelliflo: { label: "IntelliFlo", offsetMin: -600, prov: prov("measured", "2026-07-26", "~10 h behind — two photos a week apart") },
    suntouch: { label: "SunTouch", offsetMin: -600, prov: prov("measured", "2026-07-17", "2:26 AM shown at 12:26 PM — same outage signature") },
    intermaticLeft: { label: "Intermatic (left)", offsetMin: -720, prov: prov("measured", "2026-07-18", "12 nite at ~12:30 PM; moot while tripper-less") },
    intermaticRight: { label: "Intermatic (right)", offsetMin: 0, prov: prov("measured", "2026-07-18", "correct") },
  },

  // Rating plate illegible, but the 7/16/26 bill's daily-therms spikes (~11–15
  // therms over the ~1-therm house baseline, ÷ the 3:10 session ⇒ 3.5–4.7 therms/hr
  // ≈ 350–470k BTU/hr) pin it to an H400. EST until the meter is clocked — that's
  // now confirmation, not discovery (Commissioning test 1).
  heater: { model: "H400 (inferred)", btu: 400000,
            prov: prov("est", "2026-07-16", "billing inference → ~400k BTU/hr H400; clock the meter to confirm (Commissioning 1)") },

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
    // Routine-care calendar (Maintenance centerpiece; populated by Commissioning
    // test 15). who / what / how-often, split pool-service vs Justin, seasonal.
    careCalendar: [
      { task: "Surface skimmer robot", owner: "Justin", cadence: "every other day (recharge = empty)", season: "ANCHOR — battery sets its own cadence; first interceptor", lastDone: "" },
      { task: "Skimmer baskets + pump strainer", owner: "Justin", cadence: "per interview (test 15)", season: "much lighter since the surface bot; serious in needle-drop months", lastDone: "" },
      { task: "Bottom robot (underwater cleaner)", owner: "Justin", cadence: "deploy/recharge cycle (test 15)", season: "", lastDone: "" },
      { task: "Floater tablet refill", owner: "Pool service", cadence: "weekly-ish", season: "", lastDone: "" },
      { task: "Filter-gauge glance", owner: "Justin", cadence: "weekly", season: "Δ from clean baseline → clean at +8–10 psi", lastDone: "" },
      { task: "Spa-level glance", owner: "Justin", cadence: "weekly", season: "split-drift monitor", lastDone: "" },
      { task: "Cartridge cleaning", owner: "Pool service", cadence: "when gauge Δ is high", season: "", lastDone: "" },
      { task: "Pool service visit", owner: "Pool service", cadence: "per interview (test 15)", season: "", lastDone: "" },
      { task: "Polaris hose vacuum (SURGE — Tier 2)", owner: "Pool service", cadence: "only when the robots can't keep up — dogs in", season: "dirty season only; ~25¢/run (test 16)", lastDone: "" },
    ],
  },

  notes: "",

  // SENSITIVE bucket — competitively/personally private values. Empty in the
  // public bundle by design: these arrive ONLY via passphrase-authenticated sync
  // from the private data repo, so an unauthenticated browser never receives them
  // (redaction by absence — view-source-proof). The UI locks them and excludes
  // them from totals until unlocked.
  private: { poolGuyFeeMonthly: "", contractNumber: "" },

  // Commissioning results: testId -> { value, date, who }. These flip badges.
  commissioning: {},
  // Remediation tasks (fixes, not tests): taskId -> { done, date, notes }.
  remediation: {},

  // Service visit log — the `visit-log` namespace, writable by the contractor
  // passphrase (see Worker roles). Each: date, work{}, psi, notes, by.
  visitLog: [],

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

// Merge two configs for conflict resolution: `over` wins on scalars, but keyed
// objects (commissioning, remediation, wattsByRpm) keep entries from both — the
// disjoint-merge the sync design relies on.
export const mergeConfigs = (base, over) => merge(base, over);
