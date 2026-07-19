import { fmtWindow, uncoveredMinutes } from "./schedule.js";

// Hayward H-Series flow switch, in GPM. Nominal for the class — the real
// threshold isn't on the rating plate and hasn't been measured.
export const FLOW_SWITCH = 40;

// Every leg carrying water pushed by the pump, i.e. everything from the pump
// discharge onward. Used both for the dirty-filter flow restriction and for
// deciding which legs run hot, since the heater sits on this side.
export const PRESSURE_SIDE = [
  "pumpFilter", "filterHeater", "heaterVWF",
  "vwfPool", "vwfFalls", "spaRet", "boostTap", "boostCleaner",
];

// Legs downstream of the heater outlet — these are the ones that actually
// carry heated water when the burner is lit.
export const DOWNSTREAM_OF_HEATER = ["heaterVWF", "vwfPool", "vwfFalls", "spaRet"];

// Legs downstream of the filter, where a dirty cartridge shows up as reduced
// flow. Note this excludes pumpFilter: that leg is upstream of the restriction.
export const DOWNSTREAM_OF_FILTER = PRESSURE_SIDE.filter((e) => e !== "pumpFilter");

export function solve(s) {
  const active = new Set();
  const heated = new Set();
  const warnings = [];

  const pumpRunning = s.pump === "manual3" || s.pump === "schedule-running";
  let gpm = 0;
  if (pumpRunning) {
    gpm = s.pump === "manual3" ? 70 : 45;
    if (s.filterDirty) gpm = Math.round(gpm * 0.55);
    if (s.vwf === "waterfall") gpm += 12;
    if (s.deck === "pool") active.add("poolSuc"); else active.add("spaSuc");
    active.add("deckPump").add("pumpFilter").add("filterHeater").add("heaterVWF");
    if (s.deck === "spa") active.add("spaRet");
    else if (s.vwf === "pool") active.add("vwfPool");
    else active.add("vwfFalls");
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
  if (s.heaterMode === "spa" && s.deck !== "spa") warnings.push("Heater in SPA mode but deck valves on POOL — pool water, spa thermostat.");
  if (s.heaterMode === "pool" && s.deck === "spa") warnings.push("Heater in POOL mode but deck valves on SPA — spa can badly overheat.");

  if (s.boosterOn && !pumpRunning)
    warnings.push(`Booster running with main pump off — dead-heading, burns seals. Its timer window (${fmtWindow(s.booster)}) must sit inside an IntelliFlo run window.`);
  if (s.boosterOn && pumpRunning) active.add("boostTap").add("boostCleaner");
  if (s.filterDirty) warnings.push("Filter flagged DIRTY — flow cut ~45% everywhere downstream.");

  // Schedule-level check, independent of the live toggles above: does the
  // booster's timer window actually sit inside a filtration window? Nothing on
  // this pad enforces that, and the two clocks were set years apart.
  const orphan = uncoveredMinutes(s.booster, s.pumpWindows);
  if (orphan > 0)
    warnings.push(`Booster timer window (${fmtWindow(s.booster)}) sits ${orphan} min outside every IntelliFlo filtration window — during that stretch the Polaris runs with no main pump behind it. Either the IntelliFlo has a midday window nobody has read yet, or this timer needs moving.`);

  const costPerHr = heaterStatus === "firing" ? 8.8 : 0;
  return { active, heated, gpm, pumpRunning, heaterStatus, warnings, costPerHr };
}
