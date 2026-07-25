import React from "react";
import { C, mono, cond, Card, money } from "../ui.jsx";
import Timeline from "../Timeline.jsx";
import ScheduleEditor from "../ScheduleEditor.jsx";
import { kWhPerDay, turnovers, galPerKWh } from "../energy.js";
import { scheduleTOU } from "../tou.js";
import { poolGal } from "../config.js";

// The proposal sandbox. Edit the draft schedule; deltas vs the ACTIVE schedule
// compute live. "Promote to active" formalizes a reprogram and writes History.
// Ships preloaded with the §6.5 TOU proposal.

const PROP_BOOSTER = { start: "09:30", end: "11:30" };

export default function WhatIf({ config, update, now }) {
  const active = config.schedules.active;
  const proposed = config.schedules.proposed;
  const rates = config.rates.electric;
  const gpr = config.pump.gpmPerRpm;
  const gal = poolGal(config);
  const f = config.valves.splitFraction.val;

  const pump = config.pump;
  const metrics = (sched) => {
    const cost = scheduleTOU(sched, rates, pump).cost;
    const to = turnovers(sched, gal, gpr);
    return { kwh: kWhPerDay(sched, pump), mo: cost * 30, to, poolTo: to * (1 - f), gpkwh: galPerKWh(sched, gpr) };
  };
  const a = metrics(active), p = metrics(proposed);

  const promote = () => {
    if (!confirm("Promote the proposed schedule to ACTIVE? This replaces the active schedule and logs a History entry.")) return;
    update((d) => {
      d.schedules.active = structuredClone(d.schedules.proposed);
      d.history.unshift({ date: new Date().toISOString().slice(0, 10), what: "Promoted proposed schedule to active (What-If).", who: "Rick" });
    });
  };

  const rows = [
    ["kWh / day", a.kwh.toFixed(1), p.kwh.toFixed(1), (p.kwh - a.kwh).toFixed(1)],
    ["Cost / month", money(a.mo), money(p.mo), money(p.mo - a.mo)],
    ["Turnovers / day", a.to.toFixed(1), p.to.toFixed(1), (p.to - a.to).toFixed(1)],
    [`Pool turnover (×${(1 - f).toFixed(2)} at split)`, a.poolTo.toFixed(1), p.poolTo.toFixed(1), (p.poolTo - a.poolTo).toFixed(1)],
    ["gal / kWh", Math.round(a.gpkwh).toLocaleString(), Math.round(p.gpkwh).toLocaleString(), "+" + Math.round(p.gpkwh - a.gpkwh).toLocaleString()],
  ];
  const cell = { padding: "5px 10px", whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      <Card title="Proposed vs active" right={
        <button onClick={promote} style={{ font: mono(12, 600), padding: "8px 12px", borderRadius: 9, border: `2px solid ${C.ok}`, background: C.ok, color: "#fff", cursor: "pointer" }}>Promote to active →</button>
      }>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", font: mono(12.5), color: C.ink, width: "100%" }}>
            <thead><tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
              <th style={{ ...cell, textAlign: "left" }}>Metric</th><th style={num}>Active</th><th style={num}>Proposed</th><th style={num}>Δ</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.pad}` }}>
                  <td style={{ ...cell, textAlign: "left" }}>{r[0]}</td>
                  <td style={num}>{r[1]}</td>
                  <td style={num}>{r[2]}</td>
                  <td style={{ ...num, color: r[0].startsWith("Cost") || r[0].startsWith("kWh") ? C.ok : C.ink, fontWeight: 700 }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          The proposed long-low profile shifts volume off-peak (cube law: flow ∝ RPM, power ∝ RPM³) while still holding &gt;2× the residential-standard turnover. Pool-at-split uses split-fraction f={f}. "Promote" copies this draft into the active schedule and logs the change.
        </div>
      </Card>

      <Card title="Proposed 24-hour schedule">
        <Timeline C={C} pumpWindows={proposed} pumpBands={proposed} booster={PROP_BOOSTER}
          rightTimer={{ dogsIn: true, lever: "on" }} heaterMode="standby" nowMinutes={now} rates={rates} pump={config.pump} />
      </Card>

      <Card title="Draft schedule (editable)">
        <ScheduleEditor bands={proposed} rates={rates} pump={config.pump} allowAddRemove
          onChange={(next) => update((d) => { d.schedules.proposed = next; })} />
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6 }}>
          §6.5 draft: ~2600 RPM turnover 6:55a–noon + 1350 overnight, 12–8 PM off (robot skimmer covers the surface). Booster (dogs in) 9:30–11:30, inside the turnover window.
        </div>
      </Card>
    </div>
  );
}
