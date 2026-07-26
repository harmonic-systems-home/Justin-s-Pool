import { fmtWindow, uncoveredMinutes } from "./schedule.js";

// Hayward H-Series flow switch, in GPM. Nominal for the class — the real
// threshold isn't on the rating plate and hasn't been measured.
export const FLOW_SWITCH = 40;

// Every leg carrying water pushed by the pump, i.e. everything from the pump
// discharge onward. Used both for the dirty-filter flow restriction and for
// deciding which legs run hot, since the heater sits on this side.
//
// Return path is a SERIES loop, not a parallel one: heater → pad valve → either
// the waterfall's own line, or the under-deck trunk back to the deck RETURN
// valve, which feeds the pool floor returns / spa jets. Every non-waterfall
// return therefore passes through the deck valve — it is in-line for all
// main-pool circulation.
export const PRESSURE_SIDE = [
  "pumpFilter", "filterHeater", "heaterPad",
  "vwfFalls", "padTrunk", "retPool", "retSpa", "boostTap", "boostCleaner",
];

// Legs downstream of the heater outlet — these are the ones that actually
// carry heated water when the burner is lit. The booster/cleaner branch tees off
// the heated return trunk (corrected 7/25), so it heats up too.
export const DOWNSTREAM_OF_HEATER = ["heaterPad", "vwfFalls", "padTrunk", "retPool", "retSpa", "boostTap", "boostCleaner"];

// Legs downstream of the filter, where a dirty cartridge shows up as reduced
// flow. Note this excludes pumpFilter: that leg is upstream of the restriction.
export const DOWNSTREAM_OF_FILTER = PRESSURE_SIDE.filter((e) => e !== "pumpFilter");

export function solve(s) {
  const active = new Set();
  const heated = new Set();
  const weeping = new Set(); // legs carrying only the small always-open trickle
  const warnings = [];

  const pumpRunning = s.pump === "manual3" || s.pump === "schedule-running";
  let gpm = 0;
  if (pumpRunning) {
    gpm = s.pump === "manual3" ? 70 : 45;
    if (s.filterDirty) gpm = Math.round(gpm * 0.55);
    if (s.vwf === "waterfall") gpm += 12;
    // Suction side: pool, spa, or (split) both bodies at once.
    if (s.deck === "spa") active.add("spaSuc");
    else if (s.deck === "split") active.add("poolSuc").add("spaSuc");
    else active.add("poolSuc");
    active.add("deckPump").add("pumpFilter").add("filterHeater").add("heaterPad");
    // Return side. The pad valve either dumps the whole flow to the waterfall on
    // its own line, or sends it back through the under-deck trunk to the deck
    // RETURN valve, which then feeds the pool floor returns and/or spa jets. So
    // in waterfall mode nothing returns to the bodies via the deck at all.
    if (s.vwf === "waterfall") {
      active.add("vwfFalls");
    } else {
      active.add("padTrunk");
      if (s.deck === "spa") active.add("retSpa");
      else if (s.deck === "split") active.add("retSpa").add("retPool");
      else active.add("retPool");
      // The cleaner line tees off this heated return trunk downstream of the
      // heater (corrected 7/25). The Intermatic (right) powers the booster via
      // its lever: lever ON → the Polaris is DRIVEN (full cleaner flow); lever
      // OFF → the idle centrifugal booster still passes a trickle, so the port
      // WEEPS a small always-open return (drawn distinctly). Both run hot during
      // a heat run since the tee is downstream of the heater.
      active.add("boostTap").add("boostCleaner");
      if (s.rightTimer?.lever !== "on") weeping.add("boostTap").add("boostCleaner");
    }
  }

  let heaterStatus = "standby";
  const wantsHeat = s.heaterMode !== "standby";
  if (wantsHeat && pumpRunning) {
    if (gpm >= FLOW_SWITCH) {
      heaterStatus = "firing";
      DOWNSTREAM_OF_HEATER.forEach((e) => active.has(e) && heated.add(e));
    } else {
      heaterStatus = "lowflow";
      warnings.push(`~${gpm} GPM is under the ~${FLOW_SWITCH} GPM flow switch — heater won't fire. Justin's workaround: pad valve → WATERFALL. Real fix: clean the filter.`);
    }
  }
  if (wantsHeat && s.pump === "schedule")
    warnings.push(`Heater left on ${s.heaterMode.toUpperCase()} — it WILL fire during the scheduled filter run (${s.pumpWindows.map(fmtWindow).join(", ")}), burning gas unattended. Return MODE to STANDBY after heating.`);
  if (wantsHeat && s.pump === "off") warnings.push("Heater mode set but pump is off — no flow, no fire.");
  if (s.heaterMode === "spa" && s.deck === "pool") warnings.push("Heater in SPA mode but deck valves on POOL — pool water, spa thermostat.");
  if (s.heaterMode === "pool" && s.deck === "spa") warnings.push("Heater in POOL mode but deck valves on SPA — spa can badly overheat.");
  if (s.heaterMode !== "standby" && s.deck === "split") warnings.push("Deck valves at SPLIT — the heater warms BOTH pool and spa toward the current mode's setpoint. Fine for gentle whole-system heat, but slower than isolating one body; switch to POOL or SPA to heat one faster.");
  // Spa drain-down: the pad valve is upstream of the deck return valve, so with
  // it on WATERFALL the whole flow leaves over the falls and nothing returns to
  // the deck. If the deck is drawing from the spa, the spa empties out the
  // waterfall. No documented procedure produces this — only a wrong-order session.
  if (pumpRunning && s.vwf === "waterfall" && (s.deck === "spa" || s.deck === "split"))
    warnings.push("HAZARD: pad valve on WATERFALL while the deck valves draw from the SPA — spa water is pumped out over the waterfall with no return to the spa, draining it down. Put the pad valve back to POOL before running with the spa in suction.");

  if (s.filterDirty) warnings.push("Filter flagged DIRTY — flow cut ~45% everywhere downstream.");

  // Right Intermatic → booster power (its lever is the master switch here).
  const rt = s.rightTimer ?? { dogsIn: false, lever: "off" };
  const boosterPowered = rt.lever === "on";
  if (boosterPowered && !pumpRunning)
    warnings.push("Booster powered (lever ON) with the main pump off — dead-heading, burns seals. Pull the lever OFF.");
  if (boosterPowered && pumpRunning && s.vwf === "waterfall")
    warnings.push("Booster powered but the pad valve is on WATERFALL — the cleaner line tees off the return trunk, which is diverted to the falls, so the Polaris gets little/no flow.");
  if (rt.dogsIn) {
    // With dogs installed, does the timer window sit inside a filtration window?
    const orphan = uncoveredMinutes(s.booster, s.pumpWindows);
    if (orphan > 0)
      warnings.push(`Booster timer window (${fmtWindow(s.booster)}) sits ${orphan} min outside every IntelliFlo filtration window — during that stretch the Polaris would run with no main pump behind it. Either the IntelliFlo has a midday window nobody has read yet, or this timer needs moving.`);
  } else if (boosterPowered) {
    warnings.push("Right Intermatic: trip dogs are OUT (off-season) and the lever is ON — the booster has continuous power whenever the pump runs. Pull the lever OFF or reinstall the dogs for seasonal control.");
  }

  const costPerHr = heaterStatus === "firing" ? 8.8 : 0;
  return { active, heated, weeping, gpm, pumpRunning, heaterStatus, warnings, costPerHr };
}
