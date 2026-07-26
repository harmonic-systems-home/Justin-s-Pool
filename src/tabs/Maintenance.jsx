import React, { useState } from "react";
import { C, mono, Card, H, TextField, Sensitive } from "../ui.jsx";

const WORK = [["chemicals", "chemicals"], ["brushed", "brushed"], ["baskets", "baskets"], ["cartridge", "cartridge cleaned"], ["other", "other"]];

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

  const [visit, setVisit] = useState({ date: "", work: {}, psi: "", notes: "", by: "" });
  const log = config.visitLog || [];
  const addVisit = () => {
    if (!visit.date && !visit.psi && !visit.notes && Object.values(visit.work).every((v) => !v)) return;
    update((d) => { d.visitLog.unshift({ ...visit, work: { ...visit.work } }); });
    setVisit({ date: "", work: {}, psi: "", notes: "", by: "" });
  };
  const delVisit = (i) => update((d) => { d.visitLog.splice(i, 1); });
  const workSummary = (w) => WORK.filter(([k]) => w && w[k]).map(([, l]) => l).join(", ") || "—";

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

      <Card title="Service visit log" right={<span style={{ font: mono(9, 700), color: C.timer, background: "#FBF6E7", border: `1px solid ${C.timer}`, borderRadius: 5, padding: "1px 5px" }}>CONTRACTOR-WRITABLE</span>}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8, font: mono(11.5) }}>
          <input type="date" value={visit.date} onChange={(e) => setVisit((v) => ({ ...v, date: e.target.value }))}
            style={{ font: mono(11.5), padding: "5px 7px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} />
          {WORK.map(([k, label]) => (
            <label key={k} style={{ display: "flex", gap: 4, alignItems: "center", color: C.faint, cursor: "pointer" }}>
              <input type="checkbox" checked={!!visit.work[k]} onChange={(e) => setVisit((v) => ({ ...v, work: { ...v.work, [k]: e.target.checked } }))} />{label}
            </label>
          ))}
          <label style={{ color: C.faint, display: "flex", gap: 4, alignItems: "center" }}>PSI
            <input value={visit.psi} onChange={(e) => setVisit((v) => ({ ...v, psi: e.target.value }))} placeholder="gauge"
              style={{ width: 60, font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} /></label>
          <input value={visit.by} onChange={(e) => setVisit((v) => ({ ...v, by: e.target.value }))} placeholder="who"
            style={{ width: 90, font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ flex: 1 }}><TextField value={visit.notes} onChange={(v) => setVisit((s) => ({ ...s, notes: v }))} placeholder="notes" /></span>
          <button onClick={addVisit} style={{ font: mono(12, 600), padding: "7px 12px", borderRadius: 8, border: `2px solid ${C.ink}`, background: C.ink, color: "#fff", cursor: "pointer" }}>Log visit</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {log.length === 0 && <div style={{ font: mono(11), color: C.faint }}>No visits logged yet.</div>}
          {log.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", font: mono(11), borderBottom: `1px solid ${C.pad}`, paddingBottom: 4 }}>
              <span style={{ color: C.timer, minWidth: 86 }}>{e.date || "—"}</span>
              <span style={{ flex: 1, color: C.ink }}>{workSummary(e.work)}{e.psi ? ` · ${e.psi} psi` : ""}{e.notes ? ` · ${e.notes}` : ""}</span>
              <span style={{ color: C.faint }}>{e.by}</span>
              <button onClick={() => delVisit(i)} title="remove" style={{ font: mono(11, 600), padding: "2px 7px", borderRadius: 6, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ font: mono(10), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          The pool guy logs each visit here with the <b>contractor passphrase</b> (Cloud sync) — he can write this log but never sees the sensitive fee. Fallback: a laminated sheet on a clipboard at the pad, photographed monthly into Photos. The PSI series (vs clean baseline) drives the filter-cleaning indicator and, plotted against the debris calendar, the clog-rate curve.
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
          Cleaning indicator = pressure-gauge rise above the clean baseline (≈ +8–10 psi → clean). A dirty cartridge cuts GPM everywhere downstream — the first symptom is the heater's flow switch refusing to fire (hence the waterfall workaround).
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
