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

      <TestCard n={3} title="Watts per speed → power curve" badge={badgeFor(config.pump.wattsProv)}
        steps={["Read the IntelliFlo display Watts at each RPM.", "Enter one high-RPM point to anchor the affinity curve (or the measured 1350 point)."]}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", font: mono(11.5) }}>
          <span>at</span><NumField value={config.pump.anchorRpm} step="50" width={70} onChange={(v) => update((d) => { d.pump.anchorRpm = v; })} /><span>RPM =</span>
          <NumField value={config.pump.anchorWatts} step="10" width={80} onChange={(v) => update((d) => { d.pump.anchorWatts = v; d.pump.wattsProv = prov("measured", today()); })} /><span>W</span>
          <span style={{ color: C.faint }}>→ overrides the affinity-law estimate everywhere</span>
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
        steps={["Pool: max length × max width × avg depth (bounding box), × freeform plan-area factor 0.78–0.85 (chose 0.80), × 7.48 gal/ft³.", "Spa: diameter + seat depth TBD.", "Refine: trace plan area from satellite at known scale, or clock the meter on a measured drawdown refill (1\" pool-wide ≈ area ft² × 0.62 gal)."]}>
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
    </div>
  );
}
