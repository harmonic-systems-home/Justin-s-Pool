import React from "react";
import { duration, fmtWindow } from "./schedule.js";
import { bandTOU } from "./tou.js";
import { bandKWh } from "./energy.js";
import { C, mono, Badge, NumField, TimeField, money } from "./ui.jsx";

// Per-window RPM is first-class here (CHANGES-REQUESTED #2): Speed 1 and Speed 2
// are separate rows, never merged. Editing a time recomputes the band's hours
// (and therefore its kWh and TOU cost) so the record stays self-consistent.
// Shared by Daily (active schedule) and What-If (proposed draft).

const recompute = (b) => ({ ...b, hours: +(duration(b) / 60).toFixed(2) });

export default function ScheduleEditor({ bands, rates, onChange, allowAddRemove = false }) {
  const setBand = (i, patch) => onChange(bands.map((b, j) => (j === i ? recompute({ ...b, ...patch }) : b)));
  const remove = (i) => onChange(bands.filter((_, j) => j !== i));
  const add = () => onChange([...bands, recompute({
    id: "w" + bands.length + Math.floor(Math.random() * 1000),
    label: "Window", rpm: 1350, start: "12:00", end: "16:00",
  })]);

  const cell = { padding: "4px 8px", verticalAlign: "middle", whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", font: mono(12), color: C.ink, width: "100%" }}>
        <thead>
          <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
            <th style={{ ...cell, textAlign: "left" }}>Band</th>
            <th style={cell}>RPM</th>
            <th style={cell}>Start → End</th>
            <th style={num}>Hrs</th>
            <th style={num}>kWh</th>
            <th style={num}>$/day</th>
            <th style={cell}></th>
            {allowAddRemove && <th style={cell}></th>}
          </tr>
        </thead>
        <tbody>
          {bands.map((b, i) => {
            const kwh = bandKWh(b);
            const cost = rates ? bandTOU(b, rates).cost : 0;
            return (
              <tr key={b.id ?? i} style={{ borderBottom: `1px solid ${C.pad}` }}>
                <td style={{ ...cell, textAlign: "left", font: mono(12, 600) }}>{b.label}</td>
                <td style={cell}><NumField value={b.rpm} step="50" min="0" width={70}
                  onChange={(v) => setBand(i, { rpm: v || 0 })} /></td>
                <td style={cell}>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <TimeField value={b.start} onChange={(v) => setBand(i, { start: v })} />
                    <span style={{ color: C.faint }}>→</span>
                    <TimeField value={b.end} onChange={(v) => setBand(i, { end: v })} />
                  </span>
                </td>
                <td style={num}>{b.hours?.toFixed(2)}</td>
                <td style={num}>{kwh.toFixed(2)}</td>
                <td style={num}>{rates ? money(cost, 2) : "—"}</td>
                <td style={cell}>{b.prov && <Badge prov={b.prov} />}</td>
                {allowAddRemove && (
                  <td style={cell}>
                    <button onClick={() => remove(i)} title="remove band"
                      style={{ font: mono(12, 600), padding: "4px 8px", borderRadius: 7, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {allowAddRemove && (
        <button onClick={add} style={{ marginTop: 8, font: mono(11.5, 600), padding: "6px 10px", borderRadius: 8, border: `1.5px dashed ${C.faint}`, background: "#fff", color: C.faint, cursor: "pointer" }}>
          + add band
        </button>
      )}
    </div>
  );
}
