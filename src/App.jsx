import React, { useState, useEffect, useRef } from "react";
import { load, save, isPersistent } from "./storage.js";
import { loadConfig, DEFAULT_CONFIG } from "./config.js";
import { C, FONT_CSS, mono, cond } from "./ui.jsx";
import SyncPanel from "./SyncPanel.jsx";

import DailyOperation from "./tabs/DailyOperation.jsx";
import Maintenance from "./tabs/Maintenance.jsx";
import PoolDesign from "./tabs/PoolDesign.jsx";
import Costs from "./tabs/Costs.jsx";
import WhatIf from "./tabs/WhatIf.jsx";
import Commissioning from "./tabs/Commissioning.jsx";
import History from "./tabs/History.jsx";

// ─────────────────────────────────────────────────────────────
// JUSTIN'S POOL — tabbed system map (v4)
// One config object (config.js) is the single source of truth; each tab renders
// a different reader mode from it. Commissioning writes measured values back in.
// ─────────────────────────────────────────────────────────────

const KEY_CFG = "pool-v4:config";
const KEY_TAB = "pool-v4:tab";

const TABS = [
  { id: "daily", label: "Daily Operation", Comp: DailyOperation },
  { id: "maintenance", label: "Maintenance", Comp: Maintenance },
  { id: "design", label: "Pool Design", Comp: PoolDesign },
  { id: "costs", label: "Costs", Comp: Costs },
  { id: "whatif", label: "What If", Comp: WhatIf },
  { id: "commissioning", label: "Commissioning", Comp: Commissioning },
  { id: "history", label: "History", Comp: History },
];

export default function App() {
  const [config, setConfig] = useState(() => loadConfig(load(KEY_CFG, {})));
  const [tab, setTab] = useState(() => load(KEY_TAB, "daily"));
  const [authed, setAuthed] = useState(false);
  const firstCfg = useRef(true);
  const importRef = useRef(null);

  useEffect(() => {
    if (firstCfg.current) { firstCfg.current = false; return; }
    save(KEY_CFG, config);
  }, [config]);
  useEffect(() => save(KEY_TAB, tab), [tab]);

  // Nested-immutable updates: clone, mutate, set. structuredClone keeps callers
  // from hand-threading spreads through five levels of config.
  const update = (fn) => setConfig((c) => { const d = structuredClone(c); fn(d); return d; });

  // "now" marker, refreshed each minute (a phone left open at the pad).
  const [now, setNow] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, []);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `justins-pool-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { setConfig(loadConfig(JSON.parse(reader.result))); }
      catch { alert("That file isn't valid config JSON."); }
    };
    reader.readAsText(file);
  };
  const resetConfig = () => { if (confirm("Reset all data to defaults? Exported files are unaffected.")) setConfig(structuredClone(DEFAULT_CONFIG)); };

  const Active = TABS.find((t) => t.id === tab)?.Comp ?? DailyOperation;

  const chip = (on) => ({
    font: mono(12.5, 600), padding: "8px 13px", borderRadius: 9, cursor: "pointer",
    border: `2px solid ${on ? C.ink : C.pipe}`, background: on ? C.ink : "#fff",
    color: on ? "#fff" : C.faint, whiteSpace: "nowrap",
  });
  const tool = { font: mono(11, 600), padding: "6px 10px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint };

  return (
    <div style={{ minHeight: "100vh", background: C.pad, color: C.ink, fontFamily: "'Barlow Semi Condensed', sans-serif", padding: 14 }}>
      <style>{FONT_CSS}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ font: cond(24) }}>JUSTIN'S POOL — SYSTEM MAP</div>
        <div style={{ font: mono(11), color: C.faint }}>v4 · tabbed · surveyed July 2026</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button style={tool} onClick={exportJSON} title="download the whole config as JSON">↧ Export</button>
          <button style={tool} onClick={() => importRef.current?.click()} title="load a config JSON (e.g. from another device)">↥ Import</button>
          <button style={tool} onClick={resetConfig} title="restore default config">Reset</button>
          <input ref={importRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}><SyncPanel config={config} setConfig={setConfig} onAuthChange={setAuthed} /></div>

      {/* tab bar */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "4px 0 10px" }}>
        {TABS.map((t) => (
          <button key={t.id} style={chip(t.id === tab)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <Active config={config} update={update} setConfig={setConfig} now={now} authed={authed} />

      <div style={{ font: mono(10.5), color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        One config object drives every tab; Commissioning writes measured values back into it (flipping EST/PENDING → MEASURED). Export/Import moves that record between devices.
        {!isPersistent() && " · NOTE: this browser is blocking local storage, so edits won't survive a reload — use Export."}
      </div>
    </div>
  );
}
