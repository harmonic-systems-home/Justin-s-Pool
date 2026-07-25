import React, { useState, useEffect, useRef } from "react";
import { load, save } from "../storage.js";
import { fmtWindow } from "../schedule.js";
import { solve, DOWNSTREAM_OF_FILTER } from "../simulate.js";
import Timeline from "../Timeline.jsx";
import ScheduleEditor from "../ScheduleEditor.jsx";
import IntermaticDial, { DialGraphic, DialDefs } from "../IntermaticDial.jsx";
import { C, mono, cond, Card, Badge } from "../ui.jsx";

// Justin's daily tab — the live schematic + timeline + procedures + warnings.
// Reads the schedule (and everything else) from the shared config; only the
// ephemeral valve/equipment taps are local sim state, so exploring the diagram
// never mutates the record.

const KEY_SIM = "pool-v4:sim";

const P = {
  pool: { x: 105, y: 150 }, spa: { x: 105, y: 360 }, vDeck: { x: 220, y: 255 },
  pump: { x: 350, y: 210 }, filter: { x: 470, y: 210 }, heater: { x: 595, y: 210 },
  vWF: { x: 715, y: 210 }, waterfall: { x: 865, y: 210 },
  booster: { x: 470, y: 365 }, cleaner: { x: 660, y: 402 }, dial: { x: 320, y: 388 },
};

// Series-loop topology (refined 7/20): suction pool/spa → deck → pump; pressure
// pump → filter → heater → pad valve; return pad valve → waterfall OR under-deck
// trunk → deck return → floor returns / spa jets.
const EDGES = [
  { id: "poolSuc", d: `M ${P.pool.x + 45} ${P.pool.y} L ${P.vDeck.x - 34} ${P.pool.y} L ${P.vDeck.x} ${P.vDeck.y - 26}` },
  { id: "spaSuc", d: `M ${P.spa.x + 45} ${P.spa.y} L ${P.vDeck.x - 34} ${P.spa.y} L ${P.vDeck.x} ${P.vDeck.y + 26}` },
  { id: "deckPump", d: `M ${P.vDeck.x + 20} ${P.vDeck.y - 12} L ${P.pump.x - 42} ${P.pump.y}` },
  { id: "pumpFilter", d: `M ${P.pump.x + 42} ${P.pump.y} L ${P.filter.x - 42} ${P.filter.y}` },
  { id: "filterHeater", d: `M ${P.filter.x + 42} ${P.filter.y} L ${P.heater.x - 42} ${P.heater.y}` },
  { id: "heaterPad", d: `M ${P.heater.x + 42} ${P.heater.y} L ${P.vWF.x - 26} ${P.vWF.y}` },
  { id: "vwfFalls", d: `M ${P.vWF.x + 22} ${P.vWF.y} L ${P.waterfall.x - 58} ${P.waterfall.y}` },
  { id: "padTrunk", d: `M ${P.vWF.x} ${P.vWF.y + 26} L ${P.vWF.x} 292 L ${P.vDeck.x + 6} 292 L ${P.vDeck.x + 14} ${P.vDeck.y + 16}` },
  { id: "retPool", d: `M ${P.vDeck.x - 18} ${P.vDeck.y - 12} L ${P.pool.x + 58} ${P.pool.y + 32}` },
  { id: "retSpa", d: `M ${P.vDeck.x - 18} ${P.vDeck.y + 12} L ${P.spa.x + 58} ${P.spa.y - 32}` },
  { id: "boostTap", d: `M ${P.filter.x + 20} ${P.filter.y + 26} L ${P.booster.x} ${P.booster.y - 28}` },
  { id: "boostCleaner", d: `M ${P.booster.x + 44} ${P.booster.y} L ${P.cleaner.x - 52} ${P.cleaner.y - 8}` },
];

const PROCEDURES = {
  heatPool: {
    label: "Heat the pool",
    steps: [
      "Deck valves → POOL (handles parallel to side of house)",
      "Hayward heater: MODE button until POOL is lit",
      "Pad valve → POOL (handle up — its normal spot)",
      "IntelliFlo: press ON, then Speed 3 (3450 RPM)",
      "Self-stops after 3 h 10 min (Speed 3 Time Out)",
      "WHEN DONE: heater MODE back to STANDBY — or it re-fires on the overnight filter run",
    ],
    state: { deck: "pool", vwf: "pool", heaterMode: "pool", pump: "manual3" },
  },
  heatPoolClogged: {
    label: "Heat pool — clogged-filter workaround",
    steps: [
      "Same as Heat the Pool, except:",
      "Pad valve → WATERFALL (deck already POOL, so no spa-drain risk)",
      "Lower backpressure lets enough flow through the dirty filter for the heater's flow switch",
      "Real fix: have the filter cartridge cleaned",
      "WHEN DONE: heater back to STANDBY",
    ],
    state: { deck: "pool", vwf: "waterfall", heaterMode: "pool", pump: "manual3" },
  },
  heatSpa: {
    label: "Heat the spa",
    steps: [
      "Both deck valves → rotate 180° to SPA",
      "Hayward heater: MODE button until SPA is lit",
      "IntelliFlo: press ON, then Speed 3 (3450 RPM)",
      "Self-stops after 3 h 10 min",
      "WHEN DONE: heater to STANDBY, deck valves back to SPLIT/POOL",
    ],
    state: { deck: "spa", vwf: "pool", heaterMode: "spa", pump: "manual3" },
  },
  waterfall: {
    label: "Waterfall show",
    steps: [
      "DECK VALVES → POOL FIRST. At rest the deck sits at SPLIT; diverting the pad valve while split keeps drawing from the spa → the falls slowly drain it.",
      "Then pad valve → WATERFALL",
      "IntelliFlo: press ON, Speed 3 (or button 3 ≈ 2800 RPM)",
      "WHEN DONE: pad valve back to POOL, deck back to SPLIT",
    ],
    state: { deck: "pool", vwf: "waterfall", heaterMode: "standby", pump: "manual3" },
  },
  daily: {
    label: "Normal day (hands off)",
    steps: [
      "Deck valves rest at SPLIT — every pump run turns over both pool and spa",
      "IntelliFlo internal schedule runs filtration ~23 h/day",
      "Midday (dirty season): booster timer runs the Polaris hose cleaner",
      "Robot cleaner + surface skimmer self-manage; heater stays in STANDBY",
    ],
    state: { deck: "split", vwf: "pool", heaterMode: "standby", pump: "schedule" },
  },
};

const monoWidth = (t, s) => t.length * s * 0.6;
const condensedWidth = (t, s) => t.length * s * 0.5;

function Box({ x, y, w = 88, h = 54, label, sub, tone = C.ink, onClick, small }) {
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

function TimerBadge({ x, y, lines }) {
  const PAD = 9;
  const w = Math.ceil(Math.max(monoWidth(`⏱ ${lines[0]}`, 10), ...lines.slice(1).map((l) => monoWidth(l, 9.5))) + PAD * 2);
  const h = 16 + lines.length * 13;
  return (
    <g transform={`translate(${x - w / 2} ${y})`}>
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

export default function DailyOperation({ config, update, now }) {
  const active = config.schedules.active;
  const rates = config.rates.electric;
  const bt = config.booster;

  const [sim, setSim] = useState(() => ({
    deck: config.valves.deck, vwf: config.valves.pad, heaterMode: "standby",
    pump: "schedule", filterDirty: true, boosterOn: false, ...load(KEY_SIM, {}),
  }));
  const [proc, setProc] = useState(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } save(KEY_SIM, sim); }, [sim]);
  const setS = (patch) => setSim((p) => ({ ...p, ...typeof patch === "function" ? patch(p) : patch }));

  const s = {
    ...sim,
    pumpWindows: active,
    booster: { start: bt.start, end: bt.end },
    rightTimer: { dogsIn: bt.dogsIn, lever: bt.lever },
    leftTimer: config.leftTimer,
  };
  const r = solve(s);
  const stroke = (id) => (r.heated.has(id) ? C.hot : r.active.has(id) ? C.flow : null);

  const applyProc = (k) => {
    setProc(k);
    const st = { ...PROCEDURES[k].state };
    if (st.pump === "schedule") st.pump = "schedule-running";
    setS({ ...st, boosterOn: k === "daily" });
  };
  const cyclePump = () => setS((p) => ({ pump: p.pump === "off" ? "schedule" : p.pump === "schedule" ? "schedule-running" : p.pump === "schedule-running" ? "manual3" : "off" }));
  const pumpSub = sim.pump === "manual3" ? "manual spd 3" : sim.pump === "schedule-running" ? "sched: running" : sim.pump === "schedule" ? "sched: idle" : "off";

  const Btn = ({ on, children, onClick }) => (
    <button onClick={onClick} style={{ font: mono(12.5, 600), padding: "9px 12px", borderRadius: 10, border: `2px solid ${on ? C.ink : C.pipe}`, background: on ? C.ink : "#fff", color: on ? "#fff" : C.faint, cursor: "pointer" }}>{children}</button>
  );
  const toggleLever = () => update((d) => { d.booster.lever = d.booster.lever === "on" ? "off" : "on"; });

  return (
    <div>
      <style>{`
        .flowdash { stroke-dasharray: 10 8; animation: flow 0.9s linear infinite; }
        .heatdash { stroke-dasharray: 12 9; animation: flow 2.1s linear infinite; }
        .flowdots { stroke-dasharray: 0.1 13; stroke-linecap: round; animation: dotflow 1.4s linear infinite; }
        .heatdots { stroke-dasharray: 0.1 15; stroke-linecap: round; animation: dotflow 2.8s linear infinite; }
        @keyframes flow { to { stroke-dashoffset: -21; } }
        @keyframes dotflow { to { stroke-dashoffset: -26.2; } }
        @media (prefers-reduced-motion: reduce) { .flowdash, .heatdash, .flowdots, .heatdots { animation: none; } }
      `}</style>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 10px", font: mono(13, 600) }}>
        <span style={{ background: "#fff", border: `2px solid ${C.pipe}`, borderRadius: 10, padding: "7px 11px" }}>
          {r.pumpRunning ? `PUMP ${sim.pump === "manual3" ? "3450 RPM" : "SCHED"} · ~${r.gpm} GPM` : `PUMP ${sim.pump === "schedule" ? "IDLE (sched)" : "OFF"}`}
        </span>
        <span style={{ background: "#fff", borderRadius: 10, padding: "7px 11px", border: `2px solid ${r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.pipe}`, color: r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.faint }}>
          HEATER {sim.heaterMode.toUpperCase()}{r.heaterStatus === "firing" ? ` · FIRING ~$${r.costPerHr.toFixed(2)}/hr` : r.heaterStatus === "lowflow" ? " · ARMED BUT NOT FIRING" : ""}
        </span>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.pipe}`, overflow: "hidden" }}>
        <svg viewBox="0 0 1000 500" style={{ width: "100%", display: "block" }}>
          <DialDefs />
          {EDGES.map((e) => <path key={e.id} d={e.d} fill="none" stroke={C.pipe} strokeWidth="9" strokeLinejoin="round" />)}
          {EDGES.map((e) => {
            const col = stroke(e.id);
            if (!col) return null;
            const restricted = sim.filterDirty && DOWNSTREAM_OF_FILTER.includes(e.id);
            const cls = restricted ? (col === C.hot ? "heatdots" : "flowdots") : (col === C.hot ? "heatdash" : "flowdash");
            return <path key={e.id + "f"} className={cls} d={e.d} fill="none" stroke={col} strokeWidth={col === C.hot ? 5.5 : 4.5} strokeLinejoin="round" />;
          })}

          <Box x={P.pool.x} y={P.pool.y} label="POOL" sub="deep end cold" />
          <Box x={P.spa.x} y={P.spa.y} label="SPA" sub="round, in-ground" />
          <Box x={P.pump.x} y={P.pump.y} label="INTELLIFLO" sub={pumpSub} tone={r.pumpRunning ? C.ink : C.faint} onClick={cyclePump} />
          <Box x={P.filter.x} y={P.filter.y} label="FILTER" sub={sim.filterDirty ? "DIRTY" : "clean"} tone={sim.filterDirty ? C.warn : C.ok}
            onClick={() => setS((p) => ({ filterDirty: !p.filterDirty }))} />
          <Box x={P.heater.x} y={P.heater.y} label="HAYWARD"
            sub={r.heaterStatus === "firing" ? "FIRING" : r.heaterStatus === "lowflow" ? "no fire: low flow" : `mode: ${sim.heaterMode}`}
            tone={r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.faint}
            onClick={() => setS((p) => ({ heaterMode: p.heaterMode === "standby" ? "pool" : p.heaterMode === "pool" ? "spa" : "standby" }))} />
          <Box x={P.waterfall.x} y={P.waterfall.y} label="WATERFALL" small w={104} />

          <text x={P.pool.x + 40} y={P.pool.y + 48} textAnchor="middle" style={{ font: "500 8.5px 'IBM Plex Mono', monospace", fill: C.faint }}>floor returns</text>
          <text x={P.spa.x + 40} y={P.spa.y - 40} textAnchor="middle" style={{ font: "500 8.5px 'IBM Plex Mono', monospace", fill: C.faint }}>spa jets</text>
          <text x={(P.vWF.x + P.vDeck.x) / 2} y="304" textAnchor="middle" style={{ font: "500 8px 'IBM Plex Mono', monospace", fill: C.faint }}>under-deck return trunk</text>
          <Box x={P.booster.x} y={P.booster.y} label="POLARIS BOOST" sub={sim.boosterOn ? "running" : "off (seasonal)"} small w={116} tone={sim.boosterOn ? C.ink : C.faint}
            onClick={() => setS((p) => ({ boosterOn: !p.boosterOn }))} />
          <Box x={P.cleaner.x} y={P.cleaner.y} label="HOSE CLEANER" small w={110} tone={C.faint} />

          <TimerBadge x={P.pump.x - 10} y={P.pump.y - 105} lines={["INTELLIFLO SCHED", ...active.map((b) => `${b.rpm}: ${fmtWindow(b)}`)]} />

          <path d={`M ${P.dial.x + 46} ${P.dial.y - 8} L ${P.booster.x - 60} ${P.booster.y + 8}`} fill="none" stroke={C.timer} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          <text x={(P.dial.x + 46 + P.booster.x - 60) / 2} y={P.dial.y - 16} textAnchor="middle" style={{ font: "600 8.5px 'IBM Plex Mono', monospace", fill: C.timer }}>120 V</text>

          <g transform={`translate(${P.dial.x} ${P.dial.y}) scale(0.44)`}>
            <DialGraphic C={C} window={{ start: bt.start, end: bt.end }} nowMinutes={now} dogsIn={bt.dogsIn} lever={bt.lever} onToggleLever={toggleLever} />
          </g>
          <text x={P.dial.x} y={P.dial.y - 62} textAnchor="middle" style={{ font: "700 11px 'Barlow Semi Condensed'", fill: C.ink }}>INTERMATIC (right)</text>
          <text x={P.dial.x} y={P.dial.y + 82} textAnchor="middle" style={{ font: "500 9px 'IBM Plex Mono', monospace", fill: bt.dogsIn ? C.timer : C.faint }}>
            {bt.dogsIn ? `timer: ${fmtWindow(bt)}` : `manual — lever ${bt.lever.toUpperCase()}`}
          </text>

          <ValveDot x={P.vDeck.x} y={P.vDeck.y} angle={sim.deck === "pool" ? 0 : sim.deck === "split" ? 90 : 180} label="DECK PAIR"
            sub={sim.deck === "pool" ? "parallel = POOL" : sim.deck === "split" ? "intermediate = SPLIT" : "180° = SPA"}
            onTap={() => setS((p) => ({ deck: p.deck === "pool" ? "split" : p.deck === "split" ? "spa" : "pool" }))} />
          <ValveDot x={P.vWF.x} y={P.vWF.y} angle={sim.vwf === "pool" ? 0 : 90} label="PAD VALVE"
            sub={sim.vwf === "pool" ? "up = POOL (trunk)" : "WATERFALL"}
            onTap={() => setS((p) => ({ vwf: p.vwf === "pool" ? "waterfall" : "pool" }))} />
        </svg>
      </div>

      <Timeline C={C} pumpWindows={active} pumpBands={active} booster={{ start: bt.start, end: bt.end }}
        rightTimer={{ dogsIn: bt.dogsIn, lever: bt.lever }} heaterMode={sim.heaterMode} nowMinutes={now} rates={rates} pump={config.pump} />

      {/* procedures */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
        {Object.entries(PROCEDURES).map(([k, p]) => <Btn key={k} on={proc === k} onClick={() => applyProc(k)}>{p.label}</Btn>)}
      </div>
      {proc && (
        <Card title={`${PROCEDURES[proc].label} — steps`}>
          <ol style={{ margin: 0, paddingLeft: 20, font: mono(13), lineHeight: 1.55 }}>
            {PROCEDURES[proc].steps.map((st, i) => <li key={i}>{st}</li>)}
          </ol>
        </Card>
      )}

      {r.warnings.map((w, i) => (
        <div key={i} style={{ background: "#FDF1EE", border: `1px solid ${C.warn}`, color: C.warn, borderRadius: 10, padding: "9px 12px", marginBottom: 7, font: mono(12.5) }}>⚠ {w}</div>
      ))}
      <div style={{ background: "#FBF6E7", border: `1px solid ${C.timer}`, color: C.timer, borderRadius: 10, padding: "9px 12px", marginBottom: 10, font: mono(12.5) }}>
        RULE: any pad-valve diversion (waterfall) requires deck valves at POOL first — otherwise a spa fraction drains out the falls.
      </div>

      {/* active schedule editor (per-window RPM, unmerged) */}
      <Card title="Active schedule" right={<Badge prov={active[0]?.prov} />}>
        <ScheduleEditor bands={active} rates={rates} pump={config.pump}
          onChange={(next) => update((d) => { d.schedules.active = next; })} />
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6 }}>Per-window RPM — Speed 1 and Speed 2 stay separate (the 3:00–3:05 overlap is charged to Speed 1). Edit times/RPM and every tab recomputes.</div>
      </Card>

      {/* Intermatic dials */}
      <Card title="Timing Control Center — the two Intermatics">
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ font: cond(14) }}>Right — Polaris booster</div>
            <IntermaticDial C={C} window={{ start: bt.start, end: bt.end }} nowMinutes={now} size={200} dogsIn={bt.dogsIn} lever={bt.lever} onToggleLever={toggleLever} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, font: mono(11), color: C.faint, cursor: "pointer" }}>
              <input type="checkbox" checked={bt.dogsIn} onChange={(e) => update((d) => { d.booster.dogsIn = e.target.checked; })} />
              trip dogs installed
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ font: cond(14) }}>Left — main power bus</div>
            <IntermaticDial C={C} window={{ start: "", end: "" }} nowMinutes={now} size={200} dogsIn={false} lever={config.leftTimer.lever}
              caption={<>master disconnect · tripper-less · lever {config.leftTimer.lever.toUpperCase()}</>}
              onToggleLever={() => update((d) => { d.leftTimer.lever = d.leftTimer.lever === "on" ? "off" : "on"; })} />
          </div>
          <div style={{ font: mono(12), color: C.faint, lineHeight: 1.6, flex: "1 1 240px", minWidth: 240 }}>
            Silver rim tabs are the trip dogs (outer ON, inner OFF); green = switch closed; grey triangle = now. The slider is the manual lever — tap it.
            <div style={{ marginTop: 8, color: C.timer }}>Right timer is off-season manual (dogs OUT, lever decides). Left is the tripper-less power bus / master disconnect — don't flip it off casually.</div>
          </div>
        </div>
      </Card>

      <Card title="Field notes">
        <textarea value={config.notes} onChange={(e) => update((d) => { d.notes = e.target.value; })}
          placeholder="Field notes — readings, tripper positions, wire colors…"
          style={{ width: "100%", minHeight: 60, boxSizing: "border-box", font: mono(13), border: `1px solid ${C.pipe}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
      </Card>

      <div style={{ font: mono(10.5), color: C.faint, lineHeight: 1.5 }}>
        Color = temperature (blue cold, red hot — red only after a firing heater) · pattern = flow (dashes normal, dots restricted after a dirty filter) · amber heater = armed but not lit · tap equipment/valves to simulate.
      </div>
    </div>
  );
}
