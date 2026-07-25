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

// (Schedules now live in config.js as the single source of truth — the physics
// helpers below operate on whatever bands a caller passes in.)

// kWh/day and flat-rate $/day for a single speed band, and the schedule total.
export const bandKWh = (b) => (wattsAtRpm(b.rpm) / 1000) * b.hours;
export const bandCost = (b, rate) => bandKWh(b) * rate;

export const kWhPerDay = (schedule) =>
  schedule.reduce((t, s) => t + bandKWh(s), 0);

// Flow ∝ RPM. Anchor back-solved from the handoff's ~62k gal/day current
// schedule (~0.02 GPM per RPM ⇒ 3250 RPM ≈ 65 GPM, 1350 ≈ 27 GPM).
export const gpmAtRpm = (rpm, gpmPerRpm = 0.02) => rpm * gpmPerRpm;

// Gallons moved per day by a schedule, and turnovers against a volume.
export const galPerDay = (schedule, gpmPerRpm = 0.02) =>
  schedule.reduce((t, s) => t + gpmAtRpm(s.rpm, gpmPerRpm) * 60 * s.hours, 0);
export const turnovers = (schedule, gal, gpmPerRpm = 0.02) =>
  gal > 0 ? galPerDay(schedule, gpmPerRpm) / gal : 0;
export const galPerKWh = (schedule, gpmPerRpm = 0.02) => {
  const k = kWhPerDay(schedule);
  return k > 0 ? galPerDay(schedule, gpmPerRpm) / k : 0;
};

// Flat blended $/kWh, editable in the UI. Back-solved from the handoff's own
// figures (~21 kWh/day ≈ $105/mo). The proposed profile is entirely off-peak, so
// its true rate is lower than this blend — a flat rate therefore UNDERstates the
// saving, which is the conservative direction to be wrong in.
export const DEFAULT_RATE = 0.163;

export const dollarsPerMonth = (schedule, rate) => kWhPerDay(schedule) * rate * 30;
