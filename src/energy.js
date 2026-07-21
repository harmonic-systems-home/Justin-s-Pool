// Pump electrical model + the two schedules we compare in the app.
//
// The IntelliFlo's draw follows the affinity ("cube") law: power ∝ RPM³.
// Anchored to the single measured point from the survey — 136 W at 1350 RPM —
// it reproduces the handoff's per-speed estimates within a few percent
// (3000 → ~1.49 kW, 3250 → ~1.9 kW, 3450 → ~2.27 kW), so one measurement is
// enough to cost every speed. Replace ANCHOR_* if a clamp meter says otherwise.

const ANCHOR_RPM = 1350;
const ANCHOR_W = 136;

export const wattsAtRpm = (rpm) => ANCHOR_W * (rpm / ANCHOR_RPM) ** 3;

// Captured schedule (IntelliFlo menu, 7/20/26). `hours` is effective on-time
// after the harmless 3:00–3:05 PM overlap is charged to the higher speed;
// start/end (HH:MM, wrapping past midnight) place the bands on the timeline.
export const CURRENT_SCHEDULE = [
  { label: "Speed 1", rpm: 3250, start: "07:00", end: "15:05", hours: 8.08, when: "7:00a–3:05p" },
  { label: "Speed 2", rpm: 3000, start: "15:05", end: "18:02", hours: 2.95, when: "3:05p–6:02p" },
  { label: "Speed 5", rpm: 1350, start: "18:50", end: "06:55", hours: 12.08, when: "6:50p–6:55a" },
];

// Proposed TOU reprogram (§6.5) — long-low, off-peak-weighted. The daytime peak
// window is left off entirely (robot skimmer covers the surface).
export const PROPOSED_SCHEDULE = [
  { label: "Turnover", rpm: 2600, start: "06:55", end: "12:00", hours: 5.08, when: "6:55a–12:00p" },
  { label: "Overnight", rpm: 1350, start: "20:00", end: "06:55", hours: 10.92, when: "8:00p–6:55a" },
];

// kWh/day and $/day for a single speed band, and the schedule totals.
export const bandKWh = (b) => (wattsAtRpm(b.rpm) / 1000) * b.hours;
export const bandCost = (b, rate) => bandKWh(b) * rate;

export const kWhPerDay = (schedule) =>
  schedule.reduce((t, s) => t + bandKWh(s), 0);

// Flat blended $/kWh, editable in the UI. Back-solved from the handoff's own
// figures (~21 kWh/day ≈ $105/mo). The proposed profile is entirely off-peak, so
// its true rate is lower than this blend — a flat rate therefore UNDERstates the
// saving, which is the conservative direction to be wrong in.
export const DEFAULT_RATE = 0.163;

export const dollarsPerMonth = (schedule, rate) => kWhPerDay(schedule) * rate * 30;
