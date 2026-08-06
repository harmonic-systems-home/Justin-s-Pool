import React, { useState, useEffect, useRef } from "react";
import { load, save, isPersistent } from "./storage.js";
import { loadConfig, DEFAULT_CONFIG } from "./config.js";
import { C, FONT_CSS, mono, cond } from "./ui.jsx";
import SyncPanel from "./SyncPanel.jsx";

import DailyOperation from "./tabs/DailyOperation.jsx";
import Maintenance from "./tabs/Maintenance.jsx";
import ServiceVisits from "./tabs/ServiceVisits.jsx";
import IntelliFlo from "./tabs/IntelliFlo.jsx";
import PoolDesign from "./tabs/PoolDesign.jsx";
import Costs from "./tabs/Costs.jsx";
import WhatIf from "./tabs/WhatIf.jsx";
import Commissioning from "./tabs/Commissioning.jsx";
import History from "./tabs/History.jsx";
import Photos from "./tabs/Photos.jsx";

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
  { id: "service", label: "Service Visits", Comp: ServiceVisits },
  { id: "design", label: "Pool Design", Comp: PoolDesign },
  { id: "intelliflo", label: "IntelliFlo", Comp: IntelliFlo },
  { id: "costs", label: "Costs", Comp: Costs },
  { id: "whatif", label: "What If", Comp: WhatIf },
  { id: "commissioning", label: "Commissioning", Comp: Commissioning },
  { id: "history", label: "History", Comp: History },
  { id: "photos", label: "Photos", Comp: Photos },
];

export default function App() {
  const [config, setConfig] = useState(() => loadConfig(load(KEY_CFG, {})));
  // Active tab lives in the URL hash (#service) so it's deep-linkable — e.g. a QR
  // code straight to Service Visits — falling back to the last-used tab.
  const validTab = (id) => TABS.some((t) => t.id === id);
  const [tab, setTab] = useState(() => {
    const h = location.hash.replace(/^#/, "").split("&")[0]; // tab is the first segment; a #…&key=… login param is ignored here
    return validTab(h) ? h : load(KEY_TAB, "daily");
  });
  const [authed, setAuthed] = useState(false);
  const [level, setLevel] = useState("view"); // owner | service | view — privilege badge
  const firstCfg = useRef(true);
  const importRef = useRef(null);

  useEffect(() => {
    if (firstCfg.current) { firstCfg.current = false; return; }
    save(KEY_CFG, config);
  }, [config]);
  useEffect(() => {
    save(KEY_TAB, tab);
    if (location.hash.replace(/^#/, "") !== tab) history.replaceState(null, "", `#${tab}`);
  }, [tab]);
  // React to the hash changing under us (QR scan into an open tab, back/forward).
  useEffect(() => {
    const onHash = () => { const h = location.hash.replace(/^#/, ""); if (validTab(h)) setTab(h); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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

  // Browser-tab styling — deliberately unlike the pill-shaped procedure buttons
  // on the Daily schematic, so the two never read as the same control. Folder
  // tabs: rounded top only, sitting on a shared baseline, active one raised in
  // white with a colored top edge and its baseline notched away.
  const tabStyle = (on) => ({
    font: mono(12, on ? 700 : 600),
    padding: "7px 14px 8px", cursor: "pointer", whiteSpace: "nowrap",
    borderRadius: "9px 9px 0 0",
    border: `1px solid ${on ? C.pipe : "transparent"}`,
    borderTop: `3px solid ${on ? C.flow : "transparent"}`,
    borderBottom: on ? "1px solid #fff" : `1px solid transparent`,
    background: on ? "#fff" : "transparent",
    color: on ? C.ink : C.faint,
    marginBottom: -1,
  });
  const tool = { font: mono(11, 600), padding: "6px 10px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint };

  return (
    <div style={{ minHeight: "100vh", background: C.pad, color: C.ink, fontFamily: "'Barlow Semi Condensed', sans-serif", padding: 14 }}>
      <style>{FONT_CSS}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ font: cond(24) }}>JUSTIN'S POOL — SYSTEM MAP</div>
        {(() => {
          const B = {
            owner: { label: "Owner", bg: "#E7F6EE", bd: C.ok, fg: "#1E5647" },
            service: { label: "Service", bg: "#FBF6E7", bd: C.timer, fg: "#7A5A1E" },
            view: { label: "View-Only", bg: "#EEF1F0", bd: C.pipe, fg: C.faint },
          }[level];
          return <span title="Your access level (from the saved password or a URL login)"
            style={{ font: mono(11, 700), letterSpacing: "0.03em", padding: "3px 10px", borderRadius: 20, background: B.bg, border: `1.5px solid ${B.bd}`, color: B.fg }}>{B.label}</span>;
        })()}
        <div style={{ font: mono(11), color: C.faint }}>v4 · tabbed · surveyed July 2026</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button style={tool} onClick={exportJSON} title="download the whole config as JSON">↧ Export</button>
          <button style={tool} onClick={() => importRef.current?.click()} title="load a config JSON (e.g. from another device)">↥ Import</button>
          <button style={tool} onClick={resetConfig} title="restore default config">Reset</button>
          <input ref={importRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}><SyncPanel config={config} setConfig={setConfig} onAuthChange={setAuthed} onLevel={setLevel} /></div>

      {/* tab bar — browser-style folder tabs on a shared baseline */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-end", margin: "6px 0 10px", borderBottom: `1px solid ${C.pipe}`, paddingLeft: 2 }}>
        {TABS.map((t) => (
          <button key={t.id} style={tabStyle(t.id === tab)} onClick={() => setTab(t.id)}>{t.label}</button>
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
