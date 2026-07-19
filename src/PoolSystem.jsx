import React, { useState, useEffect, useRef } from "react";
import { load, save, isPersistent } from "./storage.js";

// ─────────────────────────────────────────────────────────────
// JUSTIN'S POOL — documented system map v3
// v3: hot water = slow red; timer badges (booster Intermatic,
// IntelliFlo internal schedule) with editable nominal times;
// heater-left-on-POOL overnight warning.
// ─────────────────────────────────────────────────────────────

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap');
`;

const KEY_STATE = "pool-v3:state";
const KEY_NOTES = "pool-v3:notes";

const C = {
  pad: "#EDF1F0", ink: "#17313C", faint: "#6C8089",
  pipe: "#C3CDD0", flow: "#1F8FD4", hot: "#D2372B",
  warn: "#C4452B", ok: "#2E8B57", valve: "#2A3B42", timer: "#8A6D1D",
};

const P = {
  // x=105 rather than 80: these two carry the widest sub-labels, and now that
  // boxes size to their text they need room to grow left without running off
  // the viewBox (the card clips them).
  pool: { x: 105, y: 150 },
  spa: { x: 105, y: 360 },
  vDeck: { x: 210, y: 255 },
  pump: { x: 330, y: 210 },
  filter: { x: 450, y: 210 },
  heater: { x: 580, y: 210 },
  vWF: { x: 700, y: 210 },
  poolRet: { x: 860, y: 130 },
  waterfall: { x: 860, y: 290 },
  booster: { x: 450, y: 360 },
  cleaner: { x: 640, y: 400 },
};

const EDGES = [
  { id: "poolSuc", d: `M ${P.pool.x + 45} ${P.pool.y} L ${P.vDeck.x - 30} ${P.pool.y} L ${P.vDeck.x} ${P.vDeck.y - 26}` },
  { id: "spaSuc", d: `M ${P.spa.x + 45} ${P.spa.y} L ${P.vDeck.x - 30} ${P.spa.y} L ${P.vDeck.x} ${P.vDeck.y + 26}` },
  { id: "deckPump", d: `M ${P.vDeck.x + 20} ${P.vDeck.y - 12} L ${P.pump.x - 42} ${P.pump.y}` },
  { id: "pumpFilter", d: `M ${P.pump.x + 42} ${P.pump.y} L ${P.filter.x - 42} ${P.filter.y}` },
  { id: "filterHeater", d: `M ${P.filter.x + 42} ${P.filter.y} L ${P.heater.x - 42} ${P.heater.y}` },
  { id: "heaterVWF", d: `M ${P.heater.x + 42} ${P.heater.y} L ${P.vWF.x - 26} ${P.vWF.y}` },
  { id: "vwfPool", d: `M ${P.vWF.x + 18} ${P.vWF.y - 16} L ${P.poolRet.x - 45} ${P.poolRet.y}` },
  { id: "vwfFalls", d: `M ${P.vWF.x + 18} ${P.vWF.y + 16} L ${P.waterfall.x - 58} ${P.waterfall.y}` },
  { id: "spaRet", d: `M ${P.vDeck.x + 20} ${P.vDeck.y + 12} L ${P.spa.x + 70} ${P.spa.y - 34}` },
  { id: "boostTap", d: `M ${P.filter.x + 20} ${P.filter.y + 26} L ${P.booster.x} ${P.booster.y - 28}` },
  { id: "boostCleaner", d: `M ${P.booster.x + 44} ${P.booster.y} L ${P.cleaner.x - 52} ${P.cleaner.y - 8}` },
];

const PROCEDURES = {
  heatPool: {
    label: "Heat the pool",
    steps: [
      "In-ground deck valves → POOL (handles parallel to side of house)",
      "Hayward heater: MODE button until POOL is lit",
      "Pad valve to-pool/-waterfall → POOL (handle up — its normal spot)",
      "IntelliFlo (white box): press ON, then Speed 3 (3500 RPM)",
      "It self-stops after ~5 hours (Time Out)",
      "WHEN DONE: heater MODE back to STANDBY — or it will fire again on the overnight filter run",
    ],
    state: { deck: "pool", vwf: "pool", heaterMode: "pool", pump: "manual3" },
  },
  heatPoolClogged: {
    label: "Heat pool — clogged-filter workaround",
    steps: [
      "Same as Heat the Pool, except:",
      "Pad valve to-pool/-waterfall → WATERFALL",
      "Lower backpressure lets enough flow through the dirty filter for the heater's flow switch",
      "Real fix: have the filter cartridge cleaned",
      "WHEN DONE: heater back to STANDBY",
    ],
    state: { deck: "pool", vwf: "waterfall", heaterMode: "pool", pump: "manual3" },
  },
  heatSpa: {
    label: "Heat the spa",
    steps: [
      "Both in-ground deck valves → rotate 180° to SPA",
      "Hayward heater: MODE button until SPA is lit",
      "IntelliFlo: press ON, then Speed 3",
      "Self-stops after ~5 hours",
      "WHEN DONE: heater to STANDBY, deck valves back to POOL",
    ],
    state: { deck: "spa", vwf: "pool", heaterMode: "spa", pump: "manual3" },
  },
  daily: {
    label: "Normal day (hands off)",
    steps: [
      "Overnight: IntelliFlo internal schedule runs filtration",
      "Midday (dirty season): booster timer runs the Polaris hose cleaner",
      "Robot cleaner + surface skimmer do their own thing",
      "Heater stays in STANDBY",
    ],
    state: { deck: "pool", vwf: "pool", heaterMode: "standby", pump: "schedule" },
  },
};

const DEFAULT = {
  deck: "pool", vwf: "pool", heaterMode: "standby",
  pump: "schedule", filterDirty: true, boosterOn: false,
  tBooster: "~12:00–2:00 PM (verify)",
  tPump: "after midnight (verify)",
};

function solve(s) {
  const active = new Set();
  const heated = new Set();
  const warnings = [];

  const pumpRunning = s.pump === "manual3" || s.pump === "schedule-running";
  let gpm = 0;
  if (pumpRunning) {
    gpm = s.pump === "manual3" ? 70 : 45;
    if (s.filterDirty) gpm = Math.round(gpm * 0.55);
    if (s.vwf === "waterfall") gpm += 12;
    if (s.deck === "pool") active.add("poolSuc"); else active.add("spaSuc");
    active.add("deckPump").add("pumpFilter").add("filterHeater").add("heaterVWF");
    if (s.deck === "spa") active.add("spaRet");
    else if (s.vwf === "pool") active.add("vwfPool");
    else active.add("vwfFalls");
  }

  const FLOW_SWITCH = 40;
  let heaterStatus = "standby";
  const wantsHeat = s.heaterMode !== "standby";
  if (wantsHeat && pumpRunning) {
    if (gpm >= FLOW_SWITCH) {
      heaterStatus = "firing";
      ["heaterVWF", "vwfPool", "vwfFalls", "spaRet"].forEach((e) => active.has(e) && heated.add(e));
    } else {
      heaterStatus = "lowflow";
      warnings.push(`~${gpm} GPM is under the ~${FLOW_SWITCH} GPM flow switch — heater won't fire. Justin's workaround: pad valve → WATERFALL. Real fix: clean the filter.`);
    }
  }
  if (wantsHeat && s.pump === "schedule")
    warnings.push(`Heater left on ${s.heaterMode.toUpperCase()} — it WILL fire during the scheduled overnight filter run (${s.tPump}), burning gas unattended. Return MODE to STANDBY after heating.`);
  if (wantsHeat && s.pump === "off") warnings.push("Heater mode set but pump is off — no flow, no fire.");
  if (s.heaterMode === "spa" && s.deck !== "spa") warnings.push("Heater in SPA mode but deck valves on POOL — pool water, spa thermostat.");
  if (s.heaterMode === "pool" && s.deck === "spa") warnings.push("Heater in POOL mode but deck valves on SPA — spa can badly overheat.");

  if (s.boosterOn && !pumpRunning)
    warnings.push(`Booster running with main pump off — dead-heading, burns seals. Its timer window (${s.tBooster}) must sit inside an IntelliFlo run window.`);
  if (s.boosterOn && pumpRunning) active.add("boostTap").add("boostCleaner");
  if (s.filterDirty) warnings.push("Filter flagged DIRTY — flow cut ~45% everywhere downstream.");

  const costPerHr = heaterStatus === "firing" ? 8.8 : 0;
  return { active, heated, gpm, pumpRunning, heaterStatus, warnings, costPerHr };
}

// SVG <text> neither wraps nor clips, so anything wider than its container just
// spills across the diagram. These boxes carry user-editable strings (the timer
// windows) whose length we can't know ahead of time, so measure and size to fit
// rather than guessing a fixed width.
//
// Both typefaces here are predictable enough to measure arithmetically: IBM Plex
// Mono is monospace at a 0.6em advance, and Barlow Semi Condensed averages about
// 0.5em. Approximate is fine — these only set container widths, and erring wide
// costs nothing but a little whitespace.
const monoWidth = (text, size) => text.length * size * 0.6;
const condensedWidth = (text, size) => text.length * size * 0.5;

function Box({ x, y, w = 88, h = 54, label, sub, tone = C.ink, onClick, small }) {
  // Grow past the caller's nominal width if the text demands it.
  const labelSize = small ? 11 : 13;
  const need = Math.max(condensedWidth(label, labelSize), sub ? monoWidth(sub, 9.5) : 0) + 16;
  const width = Math.max(w, Math.ceil(need));
  return (
    <g transform={`translate(${x - width / 2} ${y - h / 2})`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect width={width} height={h} rx="8" fill="#fff" stroke={tone} strokeWidth="2" />
      <text x={width / 2} y={h / 2 - (sub ? 4 : -4)} textAnchor="middle" style={{ font: `700 ${labelSize}px 'Barlow Semi Condensed', sans-serif`, fill: tone, letterSpacing: "0.03em" }}>{label}</text>
      {sub && <text x={width / 2} y={h / 2 + 14} textAnchor="middle" style={{ font: "500 9.5px 'IBM Plex Mono', monospace", fill: C.faint }}>{sub}</text>}
    </g>
  );
}

// `anchor` positions the badge relative to x: "middle" centers it, "end" pins its
// right edge there. The booster badge uses "end" so that as its editable time
// string grows it expands leftward into open space instead of rightward into the
// POLARIS BOOST node.
function TimerBadge({ x, y, lines, anchor = "middle" }) {
  const PAD = 9;
  const w = Math.ceil(Math.max(
    monoWidth(`⏱ ${lines[0]}`, 10),
    ...lines.slice(1).map((l) => monoWidth(l, 9.5))
  ) + PAD * 2);
  const h = 16 + lines.length * 13;
  const left = anchor === "end" ? x - w : x - w / 2;
  return (
    <g transform={`translate(${left} ${y})`}>
      <rect width={w} height={h} rx="7" fill="#FBF6E7" stroke={C.timer} strokeWidth="1.5" />
      <text x={PAD} y="13" style={{ font: "700 10px 'IBM Plex Mono', monospace", fill: C.timer }}>⏱ {lines[0]}</text>
      {lines.slice(1).map((l, i) => (
        <text key={i} x={PAD} y={26 + i * 13} style={{ font: "500 9.5px 'IBM Plex Mono', monospace", fill: C.timer }}>{l}</text>
      ))}
    </g>
  );
}

function ValveDot({ x, y, angle, label, sub, onTap }) {
  return (
    <g transform={`translate(${x} ${y})`} onClick={onTap} style={{ cursor: "pointer" }}>
      <circle r="24" fill="#fff" stroke={C.valve} strokeWidth="2" />
      <g transform={`rotate(${angle})`} style={{ transition: "transform 220ms ease" }}>
        <rect x="-3.5" y="-22" width="7" height="27" rx="3" fill={C.valve} />
        <circle r="5.5" fill={C.valve} />
      </g>
      <text y="42" textAnchor="middle" style={{ font: "600 12px 'IBM Plex Mono', monospace", fill: C.ink }}>{label}</text>
      <text y="56" textAnchor="middle" style={{ font: "500 10px 'IBM Plex Mono', monospace", fill: C.faint }}>{sub}</text>
    </g>
  );
}

export default function PoolSystemV3() {
  // Read persisted state during the initial render rather than in an effect —
  // localStorage is synchronous, so there's no need for the load-then-merge
  // dance (and no first-paint flash of defaults).
  const [s, setS] = useState(() => ({ ...DEFAULT, ...load(KEY_STATE, {}) }));
  const [proc, setProc] = useState(null);
  const [notes, setNotes] = useState(() => load(KEY_NOTES, ""));
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the mount pass so we don't immediately rewrite what we just read.
    if (firstRender.current) { firstRender.current = false; return; }
    save(KEY_STATE, s);
  }, [s]);

  const saveNotes = (v) => { setNotes(v); save(KEY_NOTES, v); };

  const r = solve(s);
  const applyProc = (k) => {
    setProc(k);
    const st = { ...PROCEDURES[k].state };
    if (st.pump === "schedule") st.pump = "schedule-running"; // show the daily flow live
    setS((p) => ({ ...p, ...st, boosterOn: k === "daily" }));
  };
  const stroke = (id) => (r.heated.has(id) ? C.hot : r.active.has(id) ? C.flow : null);

  const cyclePump = () =>
    setS((p) => ({ ...p, pump: p.pump === "off" ? "schedule" : p.pump === "schedule" ? "schedule-running" : p.pump === "schedule-running" ? "manual3" : "off" }));
  const pumpSub =
    s.pump === "manual3" ? "manual spd 3" : s.pump === "schedule-running" ? "sched: running" : s.pump === "schedule" ? "sched: idle" : "off";

  const Btn = ({ on, children, onClick }) => (
    <button onClick={onClick} style={{
      font: "600 12.5px 'IBM Plex Mono', monospace", padding: "9px 12px", borderRadius: 10,
      border: `2px solid ${on ? C.ink : C.pipe}`, background: on ? C.ink : "#fff",
      color: on ? "#fff" : C.faint, cursor: "pointer",
    }}>{children}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.pad, color: C.ink, fontFamily: "'Barlow Semi Condensed', sans-serif", padding: 14 }}>
      <style>{FONT_CSS + `
        .flowdash { stroke-dasharray: 10 8; animation: flow 0.9s linear infinite; }
        .heatdash { stroke-dasharray: 12 9; animation: flow 2.1s linear infinite; }
        .flowdots { stroke-dasharray: 0.1 13; stroke-linecap: round; animation: dotflow 1.4s linear infinite; }
        .heatdots { stroke-dasharray: 0.1 15; stroke-linecap: round; animation: dotflow 2.8s linear infinite; }
        @keyframes flow { to { stroke-dashoffset: -21; } }
        @keyframes dotflow { to { stroke-dashoffset: -26.2; } }
        @media (prefers-reduced-motion: reduce) { .flowdash, .heatdash, .flowdots, .heatdots { animation: none; } }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ font: "700 24px 'Barlow Semi Condensed'" }}>JUSTIN'S POOL — SYSTEM MAP</div>
        <div style={{ font: "500 11px 'IBM Plex Mono', monospace", color: C.faint }}>v3 · surveyed July 2026 · procedures per Justin</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0", font: "600 13px 'IBM Plex Mono', monospace" }}>
        <span style={{ background: "#fff", border: `2px solid ${C.pipe}`, borderRadius: 10, padding: "7px 11px" }}>
          {r.pumpRunning ? `PUMP ${s.pump === "manual3" ? "3500 RPM" : "SCHED"} · ~${r.gpm} GPM` : `PUMP ${s.pump === "schedule" ? "IDLE (sched)" : "OFF"}`}
        </span>
        <span style={{
          background: "#fff", borderRadius: 10, padding: "7px 11px",
          border: `2px solid ${r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.warn : C.pipe}`,
          color: r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.warn : C.faint,
        }}>
          HEATER {s.heaterMode.toUpperCase()}{r.heaterStatus === "firing" ? ` · FIRING ~$${r.costPerHr.toFixed(2)}/hr` : r.heaterStatus === "lowflow" ? " · LOW FLOW" : ""}
        </span>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.pipe}`, overflow: "hidden" }}>
        <svg viewBox="0 0 1000 500" style={{ width: "100%", display: "block" }}>
          {EDGES.map((e) => (
            <path key={e.id} d={e.d} fill="none" stroke={C.pipe} strokeWidth="9" strokeLinejoin="round" />
          ))}
          {EDGES.map((e) => {
            const col = stroke(e.id);
            if (!col) return null;
            // pattern = flow rate: dots only on legs downstream of the choked filter
            const DOWNSTREAM_OF_FILTER = ["filterHeater", "heaterVWF", "vwfPool", "vwfFalls", "spaRet", "boostTap", "boostCleaner"];
            const restricted = s.filterDirty && DOWNSTREAM_OF_FILTER.includes(e.id);
            // color = temperature (red only downstream of a firing heater, via stroke())
            const cls = restricted ? (col === C.hot ? "heatdots" : "flowdots") : (col === C.hot ? "heatdash" : "flowdash");
            return <path key={e.id + "f"} className={cls} d={e.d} fill="none" stroke={col} strokeWidth={col === C.hot ? 5.5 : 4.5} strokeLinejoin="round" />;
          })}

          <Box x={P.pool.x} y={P.pool.y} label="POOL" sub="deep end cold" />
          <Box x={P.spa.x} y={P.spa.y} label="SPA" sub="round, in-ground" />
          <Box x={P.pump.x} y={P.pump.y} label="INTELLIFLO" sub={pumpSub} tone={r.pumpRunning ? C.ink : C.faint} onClick={cyclePump} />
          <Box x={P.filter.x} y={P.filter.y} label="FILTER" sub={s.filterDirty ? "DIRTY" : "clean"} tone={s.filterDirty ? C.warn : C.ok}
            onClick={() => setS((p) => ({ ...p, filterDirty: !p.filterDirty }))} />
          <Box x={P.heater.x} y={P.heater.y} label="HAYWARD" sub={`mode: ${s.heaterMode}`} tone={r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.warn : C.faint}
            onClick={() => setS((p) => ({ ...p, heaterMode: p.heaterMode === "standby" ? "pool" : p.heaterMode === "pool" ? "spa" : "standby" }))} />
          <Box x={P.poolRet.x} y={P.poolRet.y} label="POOL RETURNS" small w={104} />
          <Box x={P.waterfall.x} y={P.waterfall.y} label="WATERFALL" small w={104} />
          <Box x={P.booster.x} y={P.booster.y} label="POLARIS BOOST" sub={s.boosterOn ? "running" : "off (seasonal)"} small w={116} tone={s.boosterOn ? C.ink : C.faint}
            onClick={() => setS((p) => ({ ...p, boosterOn: !p.boosterOn }))} />
          <Box x={P.cleaner.x} y={P.cleaner.y} label="HOSE CLEANER" small w={110} tone={C.faint} />

          {/* timer badges */}
          <TimerBadge x={P.pump.x - 10} y={P.pump.y - 105} lines={["INTELLIFLO SCHED", "filter: " + s.tPump]} />
          <TimerBadge x={P.booster.x - 66} y={P.booster.y - 20} anchor="end" lines={["INTERMATIC (right)", "cleaner: " + s.tBooster]} />

          <ValveDot x={P.vDeck.x} y={P.vDeck.y} angle={s.deck === "pool" ? 0 : 180} label="DECK PAIR"
            sub={s.deck === "pool" ? "parallel = POOL" : "180° = SPA"}
            onTap={() => setS((p) => ({ ...p, deck: p.deck === "pool" ? "spa" : "pool" }))} />
          <ValveDot x={P.vWF.x} y={P.vWF.y} angle={s.vwf === "pool" ? 0 : 90} label="PAD VALVE"
            sub={s.vwf === "pool" ? "up = POOL" : "WATERFALL"}
            onTap={() => setS((p) => ({ ...p, vwf: p.vwf === "pool" ? "waterfall" : "pool" }))} />
        </svg>
      </div>

      {/* editable nominal times */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0", font: "500 12px 'IBM Plex Mono', monospace" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, color: C.timer }}>
          IntelliFlo filter schedule
          <input value={s.tPump} onChange={(e) => setS((p) => ({ ...p, tPump: e.target.value }))}
            style={{ font: "inherit", padding: "7px 9px", border: `1.5px solid ${C.timer}`, borderRadius: 8, width: 230, color: C.ink }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, color: C.timer }}>
          Booster timer window (right Intermatic)
          <input value={s.tBooster} onChange={(e) => setS((p) => ({ ...p, tBooster: e.target.value }))}
            style={{ font: "inherit", padding: "7px 9px", border: `1.5px solid ${C.timer}`, borderRadius: 8, width: 230, color: C.ink }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
        {Object.entries(PROCEDURES).map(([k, p]) => (
          <Btn key={k} on={proc === k} onClick={() => applyProc(k)}>{p.label}</Btn>
        ))}
      </div>
      {proc && (
        <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ font: "700 15px 'Barlow Semi Condensed'", marginBottom: 6 }}>{PROCEDURES[proc].label} — Justin's steps</div>
          <ol style={{ margin: 0, paddingLeft: 20, font: "500 13px 'IBM Plex Mono', monospace", lineHeight: 1.55 }}>
            {PROCEDURES[proc].steps.map((st, i) => <li key={i}>{st}</li>)}
          </ol>
        </div>
      )}

      {r.warnings.map((w, i) => (
        <div key={i} style={{ background: "#FDF1EE", border: `1px solid ${C.warn}`, color: C.warn, borderRadius: 10, padding: "9px 12px", marginBottom: 7, font: "500 12.5px 'IBM Plex Mono', monospace" }}>⚠ {w}</div>
      ))}

      <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: "12px 14px", margin: "4px 0 10px" }}>
        <div style={{ font: "700 15px 'Barlow Semi Condensed'", marginBottom: 6 }}>Who controls what</div>
        <div style={{ font: "500 12.5px 'IBM Plex Mono', monospace", lineHeight: 1.6 }}>
          IntelliFlo — internal schedule for filtration ({s.tPump}); manual Speed 3 for heating, ~5 hr Time Out.<br />
          Hayward heater — own thermostat, no clock: fires whenever mode ≠ STANDBY and water flows. Hence the standby discipline.<br />
          Right Intermatic (clock correct) — Polaris booster, {s.tBooster}, dirty season only.<br />
          Left Intermatic (was 12 h off) + SunTouch (AIR Error) — legacy; verify nothing real attached.<br />
          Deck valve pair — manual pool/spa select · Pad valve — pool vs waterfall return.
        </div>
      </div>

      <textarea value={notes} onChange={(e) => saveNotes(e.target.value)}
        placeholder="Field notes — exact schedule times from IntelliFlo menu, tripper positions, wire colors…"
        style={{ width: "100%", minHeight: 64, boxSizing: "border-box", font: "500 13px 'IBM Plex Mono', monospace", border: `1px solid ${C.pipe}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
      <div style={{ font: "500 10.5px 'IBM Plex Mono', monospace", color: C.faint, marginTop: 8 }}>
        Color = temperature (blue cold, red hot — red only after a firing heater) · pattern = flow (dashes normal, dots restricted — dots only after a dirty filter) · tap equipment/valves to change state · timer fields persist.
        {!isPersistent() && " · NOTE: this browser is blocking local storage (common when opening the file directly), so edits won't survive a reload."}
      </div>
    </div>
  );
}
