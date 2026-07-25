import React, { useState } from "react";
import { C, mono, cond, Card, Badge, NumField, TextField } from "../ui.jsx";
import { prov, poolGal } from "../config.js";

// Commissioning is the mechanism that flips badges. Each card is a procedure +
// recordable result. Generic tests store {value,date,who} under
// config.commissioning[id]; the numeric ones (BTU, Watts, split-fraction,
// volume) WRITE INTO the model so every other tab recomputes with MEASURED data.

const today = () => new Date().toISOString().slice(0, 10);

function TestCard({ n, title, badge, steps, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title={`${n}. ${title}`} right={badge}>
      <button onClick={() => setOpen((o) => !o)} style={{ font: mono(11, 600), color: C.timer, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {open ? "▾ hide procedure" : "▸ procedure"}
      </button>
      {open && (
        <ol style={{ margin: "6px 0 10px", paddingLeft: 20, font: mono(11.5), color: C.ink, lineHeight: 1.55 }}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
      <div style={{ marginTop: 8 }}>{children}</div>
    </Card>
  );
}

// Generic result recorder — persists to config.commissioning[id].
function Recorder({ config, update, id, unit, placeholder }) {
  const rec = config.commissioning[id] || {};
  const set = (patch) => update((d) => { d.commissioning[id] = { ...(d.commissioning[id] || {}), ...patch }; });
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", font: mono(11.5), color: C.faint }}>
      <span style={{ flex: "1 1 200px", minWidth: 160 }}>
        <TextField value={rec.value || ""} onChange={(v) => set({ value: v })} placeholder={placeholder || "result"} />
      </span>
      {unit && <span>{unit}</span>}
      <input type="date" value={rec.date || ""} onChange={(e) => set({ date: e.target.value })} style={{ font: mono(11), padding: "5px 7px", border: `1.5px solid ${C.pipe}`, borderRadius: 8, color: C.ink }} />
      <span style={{ width: 90 }}><TextField value={rec.who || ""} onChange={(v) => set({ who: v })} placeholder="who" /></span>
      {rec.value && <Badge prov={prov("measured", rec.date || null)} />}
    </div>
  );
}

// Remediation tasks are fixes, not measurements: a done checkbox + date + notes,
// persisted to config.remediation[id].
function RemediationRow({ config, update, id, title, body }) {
  const rec = config.remediation[id] || {};
  const set = (patch) => update((d) => { d.remediation[id] = { ...(d.remediation[id] || {}), ...patch }; });
  return (
    <div style={{ borderBottom: `1px solid ${C.pad}`, padding: "8px 0" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "baseline", cursor: "pointer" }}>
        <input type="checkbox" checked={!!rec.done} onChange={(e) => set({ done: e.target.checked, date: e.target.checked ? (rec.date || today()) : rec.date })} />
        <span style={{ font: mono(12, 600), color: rec.done ? C.ok : C.ink }}>{title}</span>
        {rec.done && <Badge prov={prov("measured", rec.date || null, "done")} />}
      </label>
      <div style={{ font: mono(11), color: C.faint, lineHeight: 1.55, margin: "4px 0 6px 24px" }}>{body}</div>
      <div style={{ marginLeft: 24 }}>
        <TextField value={rec.notes || ""} onChange={(v) => set({ notes: v })} placeholder="notes / photo ref" />
      </div>
    </div>
  );
}

const Divider = ({ children }) => (
  <div style={{ font: cond(16), color: C.ink, margin: "18px 0 8px", borderBottom: `2px solid ${C.pipe}`, paddingBottom: 4 }}>{children}</div>
);

export default function Commissioning({ config, update }) {
  const badgeFor = (p) => <Badge prov={p} />;

  return (
    <div>
      <div style={{ font: mono(11.5), color: C.faint, marginBottom: 10, lineHeight: 1.5 }}>
        Record a result and its badge flips to MEASURED — and where a test feeds the model (BTU, Watts, split-fraction, volume), every other tab recomputes. Export after a session to save the record.
      </div>

      <TestCard n={1} title="Gas-meter clocking → heater BTU" badge={badgeFor(config.heater.prov)}
        steps={["Turn off all other gas appliances (water heater pilot too).", "Fire the pool heater; time one revolution of the smallest test dial (e.g. 1 ft³).", "BTU/hr = 3600 / seconds × dial-ft³ × ~1,030."]}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", font: mono(11.5) }}>
          <span>BTU input</span>
          <NumField value={config.heater.btu ?? ""} step="1000" min="0" width={110}
            onChange={(v) => update((d) => { d.heater.btu = v || null; d.heater.prov = v ? prov("measured", today(), "clocked at gas meter") : prov("pending"); })} />
          <span style={{ color: C.faint }}>→ populates the gas cost model + °F/session</span>
        </div>
      </TestCard>

      <TestCard n={2} title="Heater cabinet cross-check" badge={badgeFor(prov("est"))}
        steps={["Cabinet width vs BTU ladder: ~21\"=150k … 36\"=400k.", "Check inside the front access door + the gas-valve label for plates."]}>
        <Recorder config={config} update={update} id="cabinet" placeholder="width in / any plate reading" />
      </TestCard>

      <TestCard n={3} title="Watts per configured speed → power curve" badge={badgeFor(config.pump.wattsProv)}
        steps={["Start each programmed speed, let it stabilize ~30 s, read Watts off the IntelliFlo display.", "Any point entered overrides the affinity-law (P∝RPM³) estimate at that RPM everywhere in Costs/What-If; two or three points also validate the curve shape.", "Bonus while cycling: note the filter-gauge PSI at each RPM → a free flow-restriction baseline."]}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", font: mono(11.5) }}>
          {[
            { rpm: 1350, note: "measured 7/20" }, { rpm: 2600, note: "proposed turnover" },
            { rpm: 3000, note: "Speed 2" }, { rpm: 3030, note: "Speed 4" },
            { rpm: 3250, note: "Speed 1" }, { rpm: 3450, note: "Speed 3 heat" },
          ].map(({ rpm, note }) => (
            <label key={rpm} style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: C.faint }}>{rpm} <span style={{ fontSize: 9 }}>{note}</span></span>
              <NumField value={config.pump.wattsByRpm?.[rpm] ?? ""} step="10" min="0" width={72} suffix="W"
                onChange={(v) => update((d) => {
                  d.pump.wattsByRpm = { ...(d.pump.wattsByRpm || {}), [rpm]: v === "" ? undefined : v };
                  if (v !== "") d.pump.wattsProv = prov("measured", today());
                })} />
            </label>
          ))}
        </div>
      </TestCard>

      <TestCard n={4} title="Heater flow-switch test (accidental interlock)" badge={badgeFor(prov("pending"))}
        steps={["MODE = POOL. Run 1350 RPM: does the burner fire? Then 2600 RPM.", "Documents whether the overnight low leg is inherently heater-proof."]}>
        <Recorder config={config} update={update} id="flowSwitch" placeholder="fires @1350? @2600?" />
      </TestCard>

      <TestCard n={5} title="Switch-position mapping" badge={badgeFor(prov("pending"))}
        steps={["Identify which deck valve is suction vs return (see test 6 side effect).", "Paint-pen the calibrated split positions; photograph."]}>
        <Recorder config={config} update={update} id="switchMap" placeholder="suction valve = … / return valve = …" />
      </TestCard>

      <TestCard n={6} title="Spa drain-rate test → split-fraction f" badge={badgeFor(config.valves.splitFraction.prov)}
        steps={["Suction valve at its split setting; rotate ONLY the return valve to full POOL.", "Spa drains at f×Q. Spa ≈ 38 ft² → 1\" of level ≈ 24 gal. Time the drop.", "f = drain GPM / total GPM. Side effect: level DROPS → you moved the return valve; RISES → suction. Label both."]}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", font: mono(11.5) }}>
          <span>split-fraction f</span>
          <NumField value={config.valves.splitFraction.val} step="0.01" min="0" width={80}
            onChange={(v) => update((d) => { d.valves.splitFraction.val = v; d.valves.splitFraction.prov = prov("measured", today(), "drain-rate test"); })} />
          <span style={{ color: C.faint }}>→ pool-at-split turnover uses (1−f)</span>
        </div>
      </TestCard>

      <TestCard n={7} title="Dye test (return-side f cross-check)" badge={badgeFor(prov("est"))}
        steps={["Food coloring in the spa; half-fade time τ ≈ 800/(f×Q) cross-checks the return share."]}>
        <Recorder config={config} update={update} id="dye" placeholder="half-fade time / implied f" />
      </TestCard>

      <TestCard n={8} title="Waterfall + split drain verification" badge={badgeFor(prov("pending"))}
        steps={["From resting SPLIT, pad valve → WATERFALL briefly.", "Does the spa level fall? Confirms series topology + the POOL-valves-first rule.", "STOP at the first measurable drop; restore valves."]}>
        <Recorder config={config} update={update} id="waterfallDrain" placeholder="spa level fell? how fast?" />
      </TestCard>

      <TestCard n={9} title="SunTouch AUX / lights test" badge={badgeFor(prov("pending"))}
        steps={["Press AUX 1/2/3; listen for relays; meter the deck J-boxes.", "Tests the niche-light circuit hypothesis."]}>
        <Recorder config={config} update={update} id="auxLights" placeholder="which AUX drives which load" />
      </TestCard>

      <TestCard n={10} title="Left-timer load inventory" badge={badgeFor(prov("pending"))}
        steps={["SunTouch-breaker-off test: does the heater still fire?", "What dies with the left lever off? (CAREFUL — it's the master disconnect.)"]}>
        <Recorder config={config} update={update} id="leftTimer" placeholder="loads on the left bus" />
      </TestCard>

      <TestCard n={11} title="Spa-level stability (24 h at calibrated split)" badge={badgeFor(prov("pending"))}
        steps={["After calibrating the split, watch spa level over a day. A moving level = the split has drifted."]}>
        <Recorder config={config} update={update} id="spaStability" placeholder="level change over 24 h" />
      </TestCard>

      <TestCard n={12} title="Volume estimation (record the derivation)" badge={badgeFor(config.volumes.pool.prov)}
        steps={["Pool: max length × max width × avg depth (bounding box), × freeform plan-area factor 0.78–0.85 (chose 0.80), × 7.48 gal/ft³.", "Spa: diameter + seat depth TBD.", "1-INCH REFILL TEST (flips to MEASURED): tape the water line on a tile; let it fall 1\" (evaporation or brief pump-down); shut off all other household water; read the house meter; refill exactly to the mark; read again. Gallons added ÷ 0.62 = true surface area (ft²); area × avg depth = volume. This measures AREA — avg depth stays a soft input, so quote volume as measured-area × estimated-depth. Alt: trace plan area from the satellite photo at known scale."]}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", font: mono(11.5), color: C.faint }}>
          <label>L <NumField value={config.volumes.pool.length} step="1" width={60} onChange={(v) => update((d) => { d.volumes.pool.length = v; })} /> ft</label>
          <label>W <NumField value={config.volumes.pool.width} step="1" width={60} onChange={(v) => update((d) => { d.volumes.pool.width = v; })} /> ft</label>
          <label>avg depth <NumField value={config.volumes.pool.depth} step="0.5" width={60} onChange={(v) => update((d) => { d.volumes.pool.depth = v; })} /> ft</label>
          <label>factor <NumField value={config.volumes.pool.factor} step="0.01" width={70} onChange={(v) => update((d) => { d.volumes.pool.factor = v; })} /></label>
          <label>spa <NumField value={config.volumes.spa.gal} step="50" width={80} onChange={(v) => update((d) => { d.volumes.spa.gal = v; })} /> gal</label>
          <span style={{ font: cond(17), color: C.ink }}>= {poolGal(config).toLocaleString()} gal pool</span>
          <button onClick={() => update((d) => { d.volumes.pool.prov = prov("measured", today(), "refined"); })}
            style={{ font: mono(11, 600), padding: "5px 9px", borderRadius: 7, border: `1.5px solid ${C.ok}`, background: "#fff", color: C.ok, cursor: "pointer" }}>mark measured</button>
        </div>
      </TestCard>

      <TestCard n={13} title="Fill-line trace" badge={badgeFor(prov("est"))}
        steps={["The white PVC riser with the brass valve by the fence (near the heater) is believed a dedicated domestic fill line.", "Open it briefly; find where water emerges at the pool; label the valve.", "The rusty galvanized bib at the house wall is an ordinary hose bib, not this."]}>
        <Recorder config={config} update={update} id="fillLine" placeholder="where water emerges / confirmed fill line?" />
      </TestCard>

      <TestCard n={14} title="SMUD rate & EV-discount verification" badge={badgeFor(config.rates.electric.prov)}
        steps={["From Justin's SMUD bill: record the rate schedule name (TOD 5–8 PM expected) and the current $/kWh for each period → enter into the Costs rate table.",
          "Confirm the EV discount is active: the Tesla must be DMV-registered at the SMUD service address. Check the bill for the midnight–6 AM discount line, or Justin's SMUD account. If absent, registering it is a free ~1.5¢/kWh on all overnight usage (pool + car).",
          "Note the season boundaries (Jun 1 / Oct 1) so the Costs tab switches seasonally."]}>
        <Recorder config={config} update={update} id="smudRate" placeholder="schedule name · period $/kWh · EV discount active?" />
        <div style={{ font: mono(11, 600), color: C.ok, marginTop: 6, cursor: "pointer" }}
          onClick={() => update((d) => { d.rates.electric.prov = prov("measured", today(), "verified vs bill"); })}>
          ✓ mark the Costs rate table MEASURED (after entering bill values)
        </div>
      </TestCard>

      <Divider>Lighting reverse-engineering (L-series) — one metering session, helper + multimeter</Divider>

      <TestCard n="L0" title="Map the pad subpanel" badge={badgeFor(prov("pending"))}
        steps={["Square D HOM612L100RB (recently installed; fed by the main panel's 40A 'POOL EQUIP' Challenger pair).", "30A 2-pole = believed 240 V feed to the timer box → pump chain; 15A 1-pole = the pad's ONLY 120 V circuit — prime suspect for SunTouch supply and/or lights.", "Flip each; observe what dies; label. Slots 4–6 empty = future capacity (IntelliConnect, new light transformer).", "Note for Justin: the main-panel Challenger breakers have a known failure history — someday-replace, independent of this project."]}>
        <Recorder config={config} update={update} id="L0" placeholder="30A → … · 15A → … · labels applied?" />
      </TestCard>

      <TestCard n="L1" title="Prove/disprove main-panel #8 'lights'" badge={badgeFor(prov("pending"))}
        steps={["Flip main-panel breaker #8; check house lights vs anything poolside."]}>
        <Recorder config={config} update={update} id="L1" placeholder="#8 controls …" />
      </TestCard>

      <TestCard n="L2" title="Meter the 3 riser J-boxes" badge={badgeFor(prov("pending"))}
        steps={["Per box: meter black→white and orange→white while a helper cycles candidates one at a time: SunTouch AUX 1/2/3 (= test 9), subpanel 15A, main #8.", "Build the circuit → box → fixture map. Note which conductors are line voltage vs low voltage."]}>
        <Recorder config={config} update={update} id="L2" placeholder="box1=… box2=… box3=… (circuit → fixture)" />
      </TestCard>

      <TestCard n="L3" title="GFCI audit (before energizing ANY niche light)" badge={badgeFor(prov("pending"))}
        steps={["Find the GFCI protecting any 120 V underwater circuit — GFCI breaker or feed-through receptacle.", "If a 120 V niche light has NO GFCI: DO NOT energize. Add a GFCI breaker first (the subpanel has room)."]}>
        <Recorder config={config} update={update} id="L3" placeholder="GFCI found? where? or none → add breaker" />
      </TestCard>

      <TestCard n="L4" title="Find the 12 V transformer (or confirm it's gone)" badge={badgeFor(prov("pending"))}
        steps={["Look: eaves, boxes near the waterfall, behind/inside the SunTouch enclosure.", "While in the SunTouch, inventory the wires — identify any landing on AUX relays and heading toward the risers."]}>
        <Recorder config={config} update={update} id="L4" placeholder="transformer location / gone · SunTouch AUX wires" />
      </TestCard>

      <TestCard n="L5" title="Waterfall circuit continuity" badge={badgeFor(prov("pending"))}
        steps={["Locate the pad end of the old round CL115 cable; meter continuity/resistance toward the waterfall fixtures.", "All four CL115s are flooded → plan: new 12 V LED fountain lights + new outdoor smart transformer (~60 W covers 4× LED), direct-burial LV cable.", "Record whether the old cable is reusable as the run."]}>
        <Recorder config={config} update={update} id="L5" placeholder="continuity? old cable reusable?" />
      </TestCard>

      <TestCard n="L6" title="Niche fixture service (pool + spa)" badge={badgeFor(prov("pending"))}
        steps={["Breaker OFF + GFCI verified → one screw on the trim ring, tilt the fixture out, rest it on the deck on its coiled cord.", "Water inside = replace the fixture (don't relamp); dry = relamp (match lamp type/voltage to the label), NEW lens gasket regardless, reseat.", "Never energize a 120 V niche lamp out of water for more than a moment (they're water-cooled). Dry + healthy circuit → color-LED retrofit lamp option."]}>
        <Recorder config={config} update={update} id="L6" placeholder="pool niche: wet/dry · spa niche: wet/dry · action" />
      </TestCard>

      <Divider>Remediation (fixes, not tests — check off with date + photo ref)</Divider>

      <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: "6px 14px 12px" }}>
        <RemediationRow config={config} update={update} id="R1" title="R1 · Cap the orphan solar stub"
          body="Glued PVC cap (~$2, primer + cement). Defuses the open-pipe dump hazard on the old solar diverter — until capped, any rotation of that valve (bumped override lever, stray SunTouch valve command) discharges pool water at 45+ GPM, unattended. Capped, the worst case is a harmless dead-head." />
        <RemediationRow config={config} update={update} id="R2" title="R2 · Verify + lock the solar diverter in bypass"
          body="Confirm current position = bypass (it must be — pump→heater flows today), then disable the actuator: unplug its cable at the SunTouch end and/or use the actuator's manual toggle. Photograph the final state." />
        <RemediationRow config={config} update={update} id="R3" title="R3 · Paint-pen the pad"
          body="Label pipes at confusion points ('to waterfall', 'spa return', 'cleaner line'); mark the calibrated deck-valve split positions on the collars (after tests 5/6); write 'POOL VALVES FIRST' at the pad valve." />
        <RemediationRow config={config} update={update} id="R4" title="R4 · Reconnect the SunTouch air sensor"
          body="Clears the flashing AIR Error. Meter the salvaged probe (~10 kΩ across the leads at ~77 °F = good); splice with gel-filled connectors, or fit a new Pentair 10 kΩ sensor (~$15–25) — two-wire, non-polarized, on the AIR terminals behind the deadfront (POWER OFF first); mount in shade. Set the SunTouch clock while in there. Turns the abandoned controller into a quiet, credible fallback + a working pad thermometer." />
      </div>
    </div>
  );
}
