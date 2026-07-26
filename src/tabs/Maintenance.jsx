import React from "react";
import { C, mono, Card, H, TextField, Sensitive } from "../ui.jsx";

// Servicing view: the recurring rituals + editable notes/dates. Static guidance
// comes from the handoff; the fields persist into config so a service log
// accumulates and exports with everything else.

export default function Maintenance({ config, update, authed }) {
  const m = config.maintenance;
  const set = (k, v) => update((d) => { d.maintenance[k] = v; });
  const note = (label, key, ph) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ font: mono(11, 600), color: C.faint, marginBottom: 3 }}>{label}</div>
      <TextField value={m[key]} onChange={(v) => set(key, v)} placeholder={ph} area minRows={2} />
    </div>
  );

  const cal = m.careCalendar || [];
  const setCal = (i, key, v) => update((d) => { d.maintenance.careCalendar[i][key] = v; });
  const addRow = () => update((d) => { d.maintenance.careCalendar.push({ task: "", owner: "Justin", cadence: "", season: "", lastDone: "" }); });
  const delRow = (i) => update((d) => { d.maintenance.careCalendar.splice(i, 1); });
  const cell = { padding: "3px 5px", verticalAlign: "top" };
  const inp = { font: mono(11), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 6, color: C.ink, background: "#fff", width: "100%", boxSizing: "border-box" };

  return (
    <div>
      <Card title="Routine care calendar" right={<span style={{ font: mono(10), color: C.faint }}>who · what · how often (test 15)</span>}>
        <div style={{ font: mono(11), color: C.ink, lineHeight: 1.6, marginBottom: 10 }}>
          Defense-in-depth chain: <b>surface bot → skimmer baskets → bottom robot → cartridge filter → heater flow switch.</b> The surface skimmer robot is the first interceptor — it catches needles before they waterlog and sink, relieving every layer downstream (the state change that broke the old "choked basket → sunk needles → heater won't fire" chain). The Polaris hose vacuum is <b>surge capacity, not routine</b> — Tier 2, deployed with the booster dogs only when the two robots can't keep up.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", font: mono(11), color: C.ink }}>
            <thead>
              <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}`, textAlign: "left" }}>
                <th style={cell}>Task</th><th style={cell}>Owner</th><th style={cell}>Cadence</th><th style={cell}>Season notes</th><th style={cell}>Last done</th><th style={cell}></th>
              </tr>
            </thead>
            <tbody>
              {cal.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.pad}` }}>
                  <td style={{ ...cell, minWidth: 150 }}><input style={inp} value={row.task} onChange={(e) => setCal(i, "task", e.target.value)} /></td>
                  <td style={{ ...cell, minWidth: 90 }}><input style={inp} value={row.owner} onChange={(e) => setCal(i, "owner", e.target.value)} /></td>
                  <td style={{ ...cell, minWidth: 130 }}><input style={inp} value={row.cadence} onChange={(e) => setCal(i, "cadence", e.target.value)} /></td>
                  <td style={{ ...cell, minWidth: 160 }}><input style={inp} value={row.season} onChange={(e) => setCal(i, "season", e.target.value)} /></td>
                  <td style={{ ...cell, minWidth: 90 }}><input style={inp} value={row.lastDone} placeholder="date" onChange={(e) => setCal(i, "lastDone", e.target.value)} /></td>
                  <td style={cell}><button onClick={() => delRow(i)} title="remove" style={{ font: mono(11, 600), padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} style={{ marginTop: 8, font: mono(11, 600), padding: "6px 10px", borderRadius: 8, border: `1.5px dashed ${C.faint}`, background: "#fff", color: C.faint, cursor: "pointer" }}>+ add task</button>
        <div style={{ font: mono(10), color: C.faint, marginTop: 8 }}>The 12-month debris-load strip (colored by tier) appears once the seasonal calendar is characterized (Commissioning test 16). A full-basket reference photo lives on the Photos tab (Historical).</div>
      </Card>

      <Card title="Service visits">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.6 }}>
          The per-visit service log lives on its own <b>Service Visits</b> tab now (deep-link <code>#service</code>, handy for a QR code at the pad). The pool guy logs work there with the contractor passphrase — writable, but he never sees the sensitive fee.
        </div>
      </Card>

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
          The gauge reads tank PSI, which scales ~RPM² and shifts with valve config — so a reading only counts at the <b>reference condition: Speed 4 @3030, deck SPLIT, pad → POOL, 1 min to stabilize</b>. Clean baseline = the PSI right after a cartridge cleaning at that condition; paint-pen it on the tank (<i>"CLEAN = __ PSI @3030"</i>). Clean the cartridge at <b>+8–10 psi over baseline</b>; REPLACE it (~2–4 yr) when the post-clean baseline creeps and won't return. Gauge sanity: the needle must rest at 0 with the pump off — a sticky gauge lies ($12 to replace). A dirty cartridge cuts GPM everywhere downstream — first symptom is the heater flow switch refusing to fire.
        </div>
      </Card>

      <Card title="Sanitation">
        {note("Chlorine — dispenser type, refill cadence, notes", "chlorine", "")}
        <div style={{ font: mono(10.5), color: C.faint }}>Trichlor is independent of pump run-hours, so the schedule redesign has no chlorine constraint. CYA accumulates over years → occasional partial drain/refill.</div>
      </Card>

      <Card title="Drain & fill (partial only)">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.6 }}>
          For CYA management: <b>partial</b> drain-and-refill, 1–2 ft, not a full drain. No backwash port (cartridge system) — a submersible pump empties to a <b>sewer cleanout</b> (never the storm drain). <span style={{ color: C.warn }}>Never fully drain casually</span> — empty shells can float/crack. Refill via hose or the fill line, watched (no autofill). Full details on Pool Design.
        </div>
      </Card>

      <Card title="Pool service">
        {note("Pool guy — visit schedule, known activities, questions queue", "poolGuy", "visit cadence · what they do · open questions")}
        <div style={{ font: mono(11.5), color: C.ink, display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <span style={{ color: C.faint }}>Contract #</span>
          <Sensitive authed={authed} value={config.private.contractNumber} placeholder="service contract no."
            onChange={(v) => update((d) => { d.private.contractNumber = v; })} />
          <span style={{ font: mono(9, 700), color: C.warn, background: "#FDECE7", border: `1px solid ${C.warn}`, borderRadius: 5, padding: "1px 5px" }}>SENSITIVE</span>
        </div>
      </Card>
    </div>
  );
}
