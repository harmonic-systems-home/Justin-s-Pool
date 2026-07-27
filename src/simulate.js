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
// return therefore passes through the return valve — it is in-line for all
// main-pool circulation. `spillway` is the spa→pool overflow weir: a GRAVITY
// edge, not pumped, so it's not on the pressure side.
export const PRESSURE_SIDE = [
  "pumpFilter", "filterHeater", "heaterPad",
  "vwfFalls", "padTrunk", "retPool", "retSpa", "boostTap", "boostCleaner",
];

// Legs downstream of the heater outlet — these are the ones that actually
// carry heated water when the burner is lit. The booster/cleaner branch tees off
// the heated return trunk (corrected 7/25), so it heats up too. The spillway
// carries heated water too whenever the heated split-return is spilling.
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
    // Suction side: the SUCTION valve draws from pool (normal) or spa (spa-heat).
    if (s.suction === "spa") active.add("spaSuc");
    else active.add("poolSuc");
    active.add("deckPump").add("pumpFilter").add("filterHeater").add("heaterPad");
    // Return side. The pad valve either dumps the whole flow to the waterfall on
    // its own line, or sends it back through the under-deck trunk to the RETURN
    // valve, which feeds the pool floor returns and/or spa jets. So in waterfall
    // mode nothing returns to the bodies via the deck at all.
    if (s.vwf === "waterfall") {
      active.add("vwfFalls");
    } else {
      active.add("padTrunk");
      if (s.return === "spa") active.add("retSpa");
      else if (s.return === "split") active.add("retSpa").add("retPool");
      else active.add("retPool");
      // Designed spa→pool overflow weir. Whenever the return delivers ANY flow to
      // the spa jets (split or full-spa) while the suction is NOT drawing the spa
      // back down, the spa overfills and spills over the weir into the pool. In
      // the daily config (return SPLIT, suction POOL) this runs on every pump
      // cycle — it's the true resting water path, and a visible health check.
      if ((s.return === "split" || s.return === "spa") && s.suction !== "spa") active.add("spillway");
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
      // The weir spills whatever reaches the spa jets — heated when retSpa is.
      if (active.has("spillway") && heated.has("retSpa")) heated.add("spillway");
    } else {
      heaterStatus = "lowflow";
      warnings.push(`~${gpm} GPM is under the ~${FLOW_SWITCH} GPM flow switch — heater won't fire. Justin's workaround: pad valve → WATERFALL. Real fix: clean the filter.`);
    }
  }
  if (wantsHeat && s.pump === "schedule")
    warnings.push(`Heater left on ${s.heaterMode.toUpperCase()} — it WILL fire during the scheduled filter run (${s.pumpWindows.map(fmtWindow).join(", ")}), burning gas unattended. Return MODE to STANDBY after heating.`);
  if (wantsHeat && s.pump === "off") warnings.push("Heater mode set but pump is off — no flow, no fire.");
  if (s.heaterMode === "spa" && !(s.suction === "spa" && s.return === "spa"))
    warnings.push("Heater in SPA mode but the deck valves aren't both on SPA — to heat the spa alone, set SUCTION and RETURN both to SPA. As is, you're heating pool water toward the spa setpoint.");
  if (s.heaterMode === "pool" && s.suction === "spa")
    warnings.push("Heater in POOL mode but SUCTION is on SPA — you're circulating spa water on the pool thermostat; the spa can badly overheat.");
  if (s.heaterMode !== "standby" && s.return === "split" && s.suction !== "spa")
    warnings.push("Return valve at SPLIT while heating — heat is shared: some to the spa jets (then over the weir to the pool), the rest to the pool floor. Fine for gentle whole-system heat, but slower than isolating one body. To heat one fast, set both valves to it.");
  // Spa drain-down, revised for the spillover config: the ONLY way to empty the
  // spa is to draw it into suction (full SPA) AND divert the pad valve to the
  // waterfall, so it leaves over the falls with no return. In the daily config
  // (suction POOL) diverting to the waterfall is SAFE — the spa simply stops
  // spilling and sits at its weir.
  if (pumpRunning && s.vwf === "waterfall" && s.suction === "spa")
    warnings.push("HAZARD: SUCTION on SPA while the pad valve is on WATERFALL — spa water is pumped out over the falls with no return, draining it down. Put SUCTION back to POOL before running the waterfall.");

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
