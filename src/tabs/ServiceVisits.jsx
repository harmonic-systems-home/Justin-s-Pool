import React, { useState } from "react";
import { C, mono, Card, TextField } from "../ui.jsx";

// The pool guy's tab. Its own page so a QR code can deep-link straight here
// (#service). Contractor-writable: with the contractor passphrase it syncs the
// visitLog namespace only — he can log work but never sees the sensitive fee.

const WORK = [["chemicals", "chemicals"], ["brushed", "brushed"], ["baskets", "baskets"], ["cartridge", "cartridge cleaned"], ["other", "other"]];

export default function ServiceVisits({ config, update }) {
  const [visit, setVisit] = useState({ date: "", work: {}, psi: "", rpm: "3030", notes: "", by: "" });
  const log = config.visitLog || [];
  const addVisit = () => {
    if (!visit.date && !visit.psi && !visit.notes && Object.values(visit.work).every((v) => !v)) return;
    update((d) => { d.visitLog.unshift({ ...visit, work: { ...visit.work } }); });
    setVisit({ date: "", work: {}, psi: "", rpm: "3030", notes: "", by: "" });
  };
  const delVisit = (i) => update((d) => { d.visitLog.splice(i, 1); });
  const workSummary = (w) => WORK.filter(([k]) => w && w[k]).map(([, l]) => l).join(", ") || "—";

  return (
    <div>
      <Card title="Log a service visit" right={<span style={{ font: mono(9, 700), color: C.timer, background: "#FBF6E7", border: `1px solid ${C.timer}`, borderRadius: 5, padding: "1px 5px" }}>CONTRACTOR-WRITABLE</span>}>
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
              style={{ width: 56, font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} /></label>
          <label style={{ color: C.faint, display: "flex", gap: 4, alignItems: "center" }}>@ RPM
            <input value={visit.rpm} onChange={(e) => setVisit((v) => ({ ...v, rpm: e.target.value }))} placeholder="3030"
              style={{ width: 56, font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} /></label>
          <input value={visit.by} onChange={(e) => setVisit((v) => ({ ...v, by: e.target.value }))} placeholder="who"
            style={{ width: 90, font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 7, color: C.ink }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ flex: 1 }}><TextField value={visit.notes} onChange={(v) => setVisit((s) => ({ ...s, notes: v }))} placeholder="notes" /></span>
          <button onClick={addVisit} style={{ font: mono(12, 600), padding: "7px 12px", borderRadius: 8, border: `2px solid ${C.ink}`, background: C.ink, color: "#fff", cursor: "pointer" }}>Log visit</button>
        </div>
        <div style={{ font: mono(10, 600), color: C.timer, marginTop: 8 }}>Sync (with the pool password) after logging so it's saved. See Cloud sync at the top.</div>
        <div style={{ font: mono(10, 400), color: C.faint, marginTop: 4, lineHeight: 1.5 }}>PSI is uninterpretable without RPM on a variable-speed pump (pressure scales ~RPM²) — read it at <b>Speed 4 / 3030 RPM</b>, the standard reference condition (deck split, pad → POOL, ~1 min to stabilize).</div>
      </Card>

      <Card title={`Visit history${log.length ? ` (${log.length})` : ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {log.length === 0 && <div style={{ font: mono(11), color: C.faint }}>No visits logged yet.</div>}
          {log.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", font: mono(11.5), borderBottom: `1px solid ${C.pad}`, paddingBottom: 5 }}>
              <span style={{ color: C.timer, minWidth: 92 }}>{e.date || "—"}</span>
              <span style={{ flex: 1, color: C.ink }}>{workSummary(e.work)}{e.psi ? ` · ${e.psi} psi @ ${e.rpm || "?"} RPM` : ""}{e.notes ? ` · ${e.notes}` : ""}</span>
              <span style={{ color: C.faint }}>{e.by}</span>
              <button onClick={() => delVisit(i)} title="remove" style={{ font: mono(11, 600), padding: "2px 7px", borderRadius: 6, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ font: mono(10), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          The PSI series (vs the clean baseline on Maintenance) drives the filter-cleaning indicator and, plotted against the debris calendar, the clog-rate curve. Fallback: a laminated log sheet at the pad, photographed monthly into the Photos tab.
        </div>
      </Card>
    </div>
  );
}
