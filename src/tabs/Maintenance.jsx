import React from "react";
import { C, mono, Card, H, TextField } from "../ui.jsx";

// Servicing view: the recurring rituals + editable notes/dates. Static guidance
// comes from the handoff; the fields persist into config so a service log
// accumulates and exports with everything else.

export default function Maintenance({ config, update }) {
  const m = config.maintenance;
  const set = (k, v) => update((d) => { d.maintenance[k] = v; });
  const note = (label, key, ph) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ font: mono(11, 600), color: C.faint, marginBottom: 3 }}>{label}</div>
      <TextField value={m[key]} onChange={(v) => set(key, v)} placeholder={ph} area minRows={2} />
    </div>
  );

  return (
    <div>
      <Card title="Cleaners">
        {note("Robot surface skimmer — model, charging/cleaning cadence", "robotSkimmer", "model TBD · charge cadence · notes")}
        {note("Robot underwater scrubber — model, cadence", "robotScrubber", "model TBD · run cadence · notes")}
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.6 }}>
          <b>Polaris booster + hose cleaner (seasonal).</b> Dogs-in/dogs-out ritual: the pool guy installs trip "dogs" when the trees drop debris and pulls them off-season. Target window <b>9:30–11:30 AM</b> (inside a pump run, off-peak, neighbor-friendly). Lever at the right Intermatic in the Timing Control Center. <span style={{ color: C.warn }}>Dead-head warning: the booster must only run with the main pump on — dogs out + lever ON runs it continuously and burns the seals.</span>
        </div>
      </Card>

      <Card title="Filter (Waterway Crystal Water cartridge)">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ font: mono(11.5), color: C.faint }}>Last cleaned <TextField value={m.filterLastCleaned} onChange={(v) => set("filterLastCleaned", v)} placeholder="YYYY-MM-DD" /></label>
          <label style={{ font: mono(11.5), color: C.faint }}>Clean-baseline PSI <TextField value={m.filterCleanPSI} onChange={(v) => set("filterCleanPSI", v)} placeholder="e.g. 10 psi" /></label>
        </div>
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.6 }}>
          Cleaning indicator = pressure-gauge rise above the clean baseline (≈ +8–10 psi → clean). A dirty cartridge cuts GPM everywhere downstream — the first symptom is the heater's flow switch refusing to fire (hence the waterfall workaround).
        </div>
      </Card>

      <Card title="Sanitation">
        {note("Chlorine — dispenser type, refill cadence, notes", "chlorine", "")}
        <div style={{ font: mono(10.5), color: C.faint }}>Trichlor is independent of pump run-hours, so the schedule redesign has no chlorine constraint. CYA accumulates over years → occasional partial drain/refill.</div>
      </Card>

      <Card title="Pool service">
        {note("Pool guy — visit schedule, known activities, questions queue", "poolGuy", "visit cadence · what they do · open questions")}
      </Card>
    </div>
  );
}
