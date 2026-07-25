import React, { useState } from "react";
import { C, mono, cond, Card, TextField } from "../ui.jsx";

// Change log + eras. What-If "promote" auto-appends here; manual entries capture
// the rest (dates from Justin, pool-guy practices, line clearing, etc.).

export default function History({ config, update }) {
  const [draft, setDraft] = useState({ date: "", what: "", who: "" });
  const add = () => {
    if (!draft.what.trim()) return;
    update((d) => { d.history.unshift({ ...draft, date: draft.date || "—" }); });
    setDraft({ date: "", what: "", who: "" });
  };
  const remove = (i) => update((d) => { d.history.splice(i, 1); });

  return (
    <div>
      <Card title="Eras">
        <div style={{ font: mono(11.5), color: C.ink, lineHeight: 1.7 }}>
          <b>Construction era:</b> rooftop solar heat loop; schedule sized for solar flow → ~4 turnovers/day; waterfall CL115 lights (2002).<br />
          <b>Pass-through controller era:</b> SunTouch installed (solar control + spa button + egg timers + booster interlock + light AUX), later abandoned in place; air sensor cut during solar demolition; the left Intermatic became a tripper-less power bus.<br />
          <b>Now:</b> IntelliFlo internal schedule is the boss; Intermatics are manual switches; documentation + commissioning underway.
        </div>
      </Card>

      <Card title="Change log">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ width: 90 }}><TextField value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} placeholder="date" /></span>
          <span style={{ flex: "1 1 260px", minWidth: 200 }}><TextField value={draft.what} onChange={(v) => setDraft({ ...draft, what: v })} placeholder="what changed / was learned" /></span>
          <span style={{ width: 110 }}><TextField value={draft.who} onChange={(v) => setDraft({ ...draft, who: v })} placeholder="who" /></span>
          <button onClick={add} style={{ font: mono(12, 600), padding: "7px 11px", borderRadius: 8, border: `2px solid ${C.ink}`, background: C.ink, color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {config.history.map((h, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", font: mono(11.5), borderBottom: `1px solid ${C.pad}`, paddingBottom: 5 }}>
              <span style={{ color: C.timer, minWidth: 74 }}>{h.date}</span>
              <span style={{ flex: 1, color: C.ink }}>{h.what}</span>
              <span style={{ color: C.faint }}>{h.who}</span>
              <button onClick={() => remove(i)} title="remove" style={{ font: mono(11, 600), padding: "2px 7px", borderRadius: 6, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
