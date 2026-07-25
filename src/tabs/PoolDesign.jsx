import React from "react";
import { C, mono, cond, Card, H, Badge } from "../ui.jsx";
import { poolGal, spaGal, totalGal } from "../config.js";

// Understanding view: component inventory, switches, controllers, volumes, the
// static plumbing topology, and lighting hypotheses. Mostly reference; volumes
// read live from config so a Commissioning refinement shows here too.

const INVENTORY = [
  ["Main pump", "Pentair IntelliFlo VS — Speed 1–4 keys + internal schedule. Speed 3 ≈ 3450 RPM heating run."],
  ["Filter", "Waterway Crystal Water cartridge (suction-side). Pressure gauge on top."],
  ["Heater", "Hayward H-Series gas. MODE cycles STANDBY→SPA→POOL. BTU unread — see Commissioning."],
  ["Booster", "Polaris PB4-60 ¾ HP — pressure-side hose cleaner, seasonal."],
  ["Cleaners", "Polaris hose cleaner (booster) + robot underwater + robot surface skimmer."],
  ["Timers", "Two Intermatic T104-style. Right = Polaris booster (dogs seasonal). Left = tripper-less main power bus."],
  ["Automation", "Pentair SunTouch — abandoned in place (AIR Error, wrong clock). Possibly still in a fireman's-switch path."],
  ["Lights", "Three deck J-boxes; waterfall CL115 12 V 20 W (2002). Niche lights — no known switch."],
  ["Solar (defunct)", "Rooftop loop decommissioned; mats rolled up beside the pad. SunTouch likely installed for it."],
];

const CONTROLLERS = [
  ["IntelliFlo", "ACTIVE — the real filtration boss; internal schedule + egg timers."],
  ["Hayward thermostat", "ACTIVE — no clock; fires whenever MODE ≠ STANDBY and water flows."],
  ["Intermatics ×2", "Manual switches now (tripper-less). Right takes dogs seasonally."],
  ["SunTouch", "ABANDONED — AIR Error, wrong clock. Capabilities if revived: valve actuators, spa button, freeze protection, light AUX."],
];

export default function PoolDesign({ config }) {
  const row = (k, v) => (
    <tr key={k} style={{ borderBottom: `1px solid ${C.pad}`, verticalAlign: "top" }}>
      <td style={{ padding: "5px 10px", font: mono(11.5, 600), whiteSpace: "nowrap" }}>{k}</td>
      <td style={{ padding: "5px 10px", font: mono(11.5), color: C.ink }}>{v}</td>
    </tr>
  );

  return (
    <div>
      <Card title="Water volumes" right={<Badge prov={config.volumes.pool.prov} />}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", font: cond(20) }}>
          <div><div style={{ font: mono(9.5), color: C.faint, letterSpacing: "0.04em" }}>POOL</div>{poolGal(config).toLocaleString()} gal</div>
          <div><div style={{ font: mono(9.5), color: C.faint, letterSpacing: "0.04em" }}>SPA</div>{spaGal(config).toLocaleString()} gal</div>
          <div><div style={{ font: mono(9.5), color: C.faint, letterSpacing: "0.04em" }}>TOTAL AT SPLIT</div>{totalGal(config).toLocaleString()} gal</div>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6 }}>Derived from editable inputs on the Commissioning tab (35×15 bounding × 5 ft × 0.80 freeform). ±15% until refined.</div>
      </Card>

      <Card title="Component inventory">
        <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>{INVENTORY.map(([k, v]) => row(k, v))}</tbody></table>
      </Card>

      <Card title="Controllers">
        <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>{CONTROLLERS.map(([k, v]) => row(k, v))}</tbody></table>
      </Card>

      <Card title="Switch list">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.7 }}>
          House wall switches: kitchen pair + master pair → floods + lanterns (map each).<br />
          Timer levers: right Intermatic (booster), left Intermatic (master power bus — don't flip casually).<br />
          IntelliFlo keypad: buttons 1–4 (proposed as verbs: Heat pool / Heat spa / Waterfall / Manual).
        </div>
      </Card>

      <Card title="Plumbing topology (series return)">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.7 }}>
          POOL/SPA → <b>deck valve pair</b> (suction + return select, at the spa) → IntelliFlo → filter → heater → <b>pad valve</b>.<br />
          Pad valve → <b>waterfall</b> (dedicated line) OR → <b>under-deck return trunk</b> → deck RETURN valve → pool floor returns (deep + shallow) / spa jets.<br />
          Booster branch: filter-output tap → Polaris PB4-60 → dedicated cleaner line.<br />
          Orphan solar stub: capped/removed at the pad (verify cap status).<br />
          <span style={{ color: C.warn }}>Series consequence: the deck valve is in-line for 100% of main-pool flow; any pad-valve diversion needs deck at POOL first.</span>
        </div>
      </Card>

      <Card title="Lighting — reverse-engineering underway (L-series)">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.7 }}>
          Pad subpanel: Square D HOM612L100RB (fed by the main panel's 40A "POOL EQUIP" Challenger pair). 30A 2-pole → pump chain; 15A 1-pole = the pad's only 120 V circuit (SunTouch/lights suspect); slots 4–6 empty = future capacity.<br />
          Niche lights (pool + spa) — no known switch; SunTouch AUX hypothesis. <span style={{ color: C.warn }}>GFCI audit is non-negotiable before energizing any 120 V niche light.</span><br />
          Waterfall CL115s — all four flooded → plan: 12 V LED fountain lights + new outdoor smart transformer (~60 W), direct-burial LV cable; reuse old cable run if continuity holds.<br />
          Three riser J-boxes metered against SunTouch AUX / subpanel 15A / main #8 to build the circuit→box→fixture map. Cut lamp cord removed 7/2026.<br />
          <span style={{ color: C.faint }}>Full L0–L6 procedure + results on the Commissioning tab.</span>
        </div>
      </Card>

      <Card title="Drain & fill">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.7 }}>
          Cartridge-filter system → <b>no backwash/waste port</b> at the pad. Draining needs a submersible utility pump in the deep end, discharging to a <b>sanitary sewer cleanout</b> (CA rule: pool water to sewer, never storm drain — Sacramento districts enforce). The main pump can't pump the pool down (loses prime below the skimmer).<br />
          <span style={{ color: C.warn }}>Never fully drain casually</span> — an empty gunite shell can float/crack from groundwater (hydrostatic pop-out); full drains are deliberate, pro-supervised events. Realistic use: partial drain-and-refill (1–2 ft) for CYA management (pool-guy territory).<br />
          Filling: hose over the coping or the dedicated fill line (Commissioning test 13); watched — no autofill installed.
        </div>
      </Card>
    </div>
  );
}
