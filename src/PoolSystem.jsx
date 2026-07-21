import React, { useState, useEffect, useRef } from "react";
import { load, save, isPersistent } from "./storage.js";
import { fmtWindow } from "./schedule.js";
import { solve, DOWNSTREAM_OF_FILTER } from "./simulate.js";
import Timeline from "./Timeline.jsx";
import ProposedSchedule from "./ProposedSchedule.jsx";
import { CURRENT_SCHEDULE } from "./energy.js";
import IntermaticDial, { DialGraphic, DialDefs } from "./IntermaticDial.jsx";

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
  // Amber, deliberately far from `hot`. A heater that is armed but stalled on
  // low flow used to render in a red almost identical to a firing one, which
  // made a red heater sitting next to blue (unheated) water look like a
  // rendering bug rather than the actual complaint: below the flow switch, the
  // burner never lights, so there is no hot water to draw.
  stall: "#E08A1E",
};

const P = {
  // x=105 rather than 80: these two carry the widest sub-labels, and now that
  // boxes size to their text they need room to grow left without running off
  // the viewBox (the card clips them).
  pool: { x: 105, y: 150 },
  spa: { x: 105, y: 360 },
  vDeck: { x: 220, y: 255 },
  pump: { x: 350, y: 210 },
  filter: { x: 470, y: 210 },
  heater: { x: 595, y: 210 },
  vWF: { x: 715, y: 210 },
  // Waterfall now sits on the equipment row (the old top-right POOL RETURNS node
  // is gone — pool returns are fed through the deck valve, not the pad valve).
  waterfall: { x: 865, y: 210 },
  booster: { x: 470, y: 365 },
  cleaner: { x: 660, y: 402 },
  // Right Intermatic dial. Sits in the open pocket below the deck valve and
  // left of the booster it powers.
  dial: { x: 320, y: 388 },
};

// Topology is a series loop (refined 7/20). Suction: pool/spa → deck SUCTION →
// pump. Pressure: pump → filter → heater → pad valve. Return: pad valve →
// waterfall (its own line) OR → under-deck trunk → deck RETURN → pool floor
// returns / spa jets. The deck valve is therefore in-line for every
// non-waterfall return — 100% of main-pool flow passes through it.
const EDGES = [
  { id: "poolSuc", d: `M ${P.pool.x + 45} ${P.pool.y} L ${P.vDeck.x - 34} ${P.pool.y} L ${P.vDeck.x} ${P.vDeck.y - 26}` },
  { id: "spaSuc", d: `M ${P.spa.x + 45} ${P.spa.y} L ${P.vDeck.x - 34} ${P.spa.y} L ${P.vDeck.x} ${P.vDeck.y + 26}` },
  { id: "deckPump", d: `M ${P.vDeck.x + 20} ${P.vDeck.y - 12} L ${P.pump.x - 42} ${P.pump.y}` },
  { id: "pumpFilter", d: `M ${P.pump.x + 42} ${P.pump.y} L ${P.filter.x - 42} ${P.filter.y}` },
  { id: "filterHeater", d: `M ${P.filter.x + 42} ${P.filter.y} L ${P.heater.x - 42} ${P.heater.y}` },
  { id: "heaterPad", d: `M ${P.heater.x + 42} ${P.heater.y} L ${P.vWF.x - 26} ${P.vWF.y}` },
  { id: "vwfFalls", d: `M ${P.vWF.x + 22} ${P.vWF.y} L ${P.waterfall.x - 58} ${P.waterfall.y}` },
  // under-deck return trunk: pad valve down, back left along the pad, up into the
  // deck return valve.
  { id: "padTrunk", d: `M ${P.vWF.x} ${P.vWF.y + 26} L ${P.vWF.x} 292 L ${P.vDeck.x + 6} 292 L ${P.vDeck.x + 14} ${P.vDeck.y + 16}` },
  // deck return valve → pool floor returns / spa jets
  { id: "retPool", d: `M ${P.vDeck.x - 18} ${P.vDeck.y - 12} L ${P.pool.x + 58} ${P.pool.y + 32}` },
  { id: "retSpa", d: `M ${P.vDeck.x - 18} ${P.vDeck.y + 12} L ${P.spa.x + 58} ${P.spa.y - 32}` },
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
      "IntelliFlo (white box): press ON, then Speed 3 (3450 RPM)",
      "It self-stops after 3 h 10 min (Speed 3 Time Out — Justin's \"~5 hours\" was the older belief)",
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
      "IntelliFlo: press ON, then Speed 3 (3450 RPM)",
      "Self-stops after 3 h 10 min (Speed 3 Time Out)",
      "WHEN DONE: heater to STANDBY, deck valves back to POOL",
    ],
    state: { deck: "spa", vwf: "pool", heaterMode: "spa", pump: "manual3" },
  },
  daily: {
    label: "Normal day (hands off)",
    steps: [
      "Deck valves rest at SPLIT — every pump run turns over both pool and spa (design-intent default)",
      "IntelliFlo internal schedule runs filtration ~23 h/day",
      "Midday (dirty season): booster timer runs the Polaris hose cleaner",
      "Robot cleaner + surface skimmer do their own thing",
      "Heater stays in STANDBY",
    ],
    state: { deck: "split", vwf: "pool", heaterMode: "standby", pump: "schedule" },
  },
};

const DEFAULT = {
  // Deck pair rests at SPLIT — the design-intent default (its position when
  // Justin bought the house), so every pump run circulates both bodies. Heating
  // procedures still isolate to POOL or SPA; this is only the resting state.
  deck: "split", vwf: "pool", heaterMode: "standby",
  pump: "schedule", filterDirty: true, boosterOn: false,
  // CAPTURED from the IntelliFlo menu 7/20/26 (see §3 of the handoff). The pump
  // runs almost the whole day: Speed 1 @3250 RPM 7:00a–3:05p and Speed 2 @3000
  // 3:00p–6:02p collapse into one daytime window; Speed 5 @1350 6:50p–6:55a is
  // the overnight low leg. The only idle stretch is 6:02–6:50 PM.
  //
  // pumpWindows carries no RPM — it only encodes "flow present," which is what
  // the heater trap and booster-orphan checks care about. The near-24 h coverage
  // is the point: a heater left off STANDBY fires almost continuously, not just
  // on an overnight run. Speeds/RPMs live in the "who controls what" card.
  pumpWindows: [{ start: "07:00", end: "18:02" }, { start: "18:50", end: "06:55" }],
  booster: { start: "12:00", end: "14:00" },
  schedVerified: true,

  // Right Intermatic — Polaris booster. As of the July 2026 survey the trip
  // pins ("dogs") are OUT for the off-season, so the dial actuates nothing and
  // the timer is a plain manual switch, currently left OFF. When the trees
  // start dropping and the dogs go back in, it resumes timer duty on the window
  // above. Lever position and dogs are independent: dogs out + lever ON would
  // mean the booster runs continuously, which is why the sim warns about it.
  rightTimer: { dogsIn: false, lever: "off" },

  // Left Intermatic — CONFIRMED the pad's main power bus / de facto master
  // disconnect: tripper-less, lever ON, runs continuously, feeds SunTouch and
  // the believed pump/heater side (§3). Its clock is moot with no dogs in. Don't
  // flip it off casually — it kills the filtration schedule, freeze protection,
  // and heater. Exact load list still to verify.
  leftTimer: { lever: "on" },
};

// The v3 prototype stored these as free text (tPump / tBooster). Drop those
// keys on load rather than trying to parse prose back into times.
function migrate(saved) {
  if (!saved || typeof saved !== "object") return {};
  const { tPump, tBooster, ...rest } = saved;
  if (!Array.isArray(rest.pumpWindows)) delete rest.pumpWindows;
  if (!rest.booster || typeof rest.booster !== "object") delete rest.booster;
  return rest;
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

// Native <input type="time"> rather than a custom picker: it gives a phone
// keyboard the owner already knows, validates itself, and emits the "HH:MM"
// that schedule.js consumes directly.
function WindowRow({ C, label, window: w, onChange, onRemove }) {
  const field = {
    font: "500 12px 'IBM Plex Mono', monospace", padding: "6px 8px",
    border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink, background: "#fff",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ font: "500 12px 'IBM Plex Mono', monospace", color: C.timer, minWidth: 210 }}>{label}</span>
      <input type="time" value={w.start} style={field}
        onChange={(e) => onChange({ ...w, start: e.target.value })} />
      <span style={{ color: C.faint }}>→</span>
      <input type="time" value={w.end} style={field}
        onChange={(e) => onChange({ ...w, end: e.target.value })} />
      <span style={{ font: "500 11px 'IBM Plex Mono', monospace", color: C.faint }}>{fmtWindow(w)}</span>
      {onRemove && (
        <button onClick={onRemove} title="remove window"
          style={{ font: "600 12px 'IBM Plex Mono', monospace", padding: "5px 9px", borderRadius: 8, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
      )}
    </div>
  );
}

export default function PoolSystemV3() {
  // Read persisted state during the initial render rather than in an effect —
  // localStorage is synchronous, so there's no need for the load-then-merge
  // dance (and no first-paint flash of defaults).
  const [s, setS] = useState(() => ({ ...DEFAULT, ...migrate(load(KEY_STATE, {})) }));
  const [proc, setProc] = useState(null);
  const [notes, setNotes] = useState(() => load(KEY_NOTES, ""));
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the mount pass so we don't immediately rewrite what we just read.
    if (firstRender.current) { firstRender.current = false; return; }
    save(KEY_STATE, s);
  }, [s]);

  const saveNotes = (v) => { setNotes(v); save(KEY_NOTES, v); };

  // "now" marker on the timeline, refreshed each minute so a page left open on
  // a phone at the pad doesn't drift.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

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
          border: `2px solid ${r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.pipe}`,
          color: r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.faint,
        }}>
          HEATER {s.heaterMode.toUpperCase()}{r.heaterStatus === "firing" ? ` · FIRING ~$${r.costPerHr.toFixed(2)}/hr` : r.heaterStatus === "lowflow" ? " · ARMED BUT NOT FIRING" : ""}
        </span>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.pipe}`, overflow: "hidden" }}>
        <svg viewBox="0 0 1000 500" style={{ width: "100%", display: "block" }}>
          <DialDefs />
          {EDGES.map((e) => (
            <path key={e.id} d={e.d} fill="none" stroke={C.pipe} strokeWidth="9" strokeLinejoin="round" />
          ))}
          {EDGES.map((e) => {
            const col = stroke(e.id);
            if (!col) return null;
            // pattern = flow rate: dots only on legs downstream of the choked filter
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
          <Box x={P.heater.x} y={P.heater.y} label="HAYWARD"
            sub={r.heaterStatus === "firing" ? "FIRING" : r.heaterStatus === "lowflow" ? "no fire: low flow" : `mode: ${s.heaterMode}`}
            tone={r.heaterStatus === "firing" ? C.hot : r.heaterStatus === "lowflow" ? C.stall : C.faint}
            onClick={() => setS((p) => ({ ...p, heaterMode: p.heaterMode === "standby" ? "pool" : p.heaterMode === "pool" ? "spa" : "standby" }))} />
          <Box x={P.waterfall.x} y={P.waterfall.y} label="WATERFALL" small w={104} />

          {/* return-leg labels: pool floor returns and spa jets both hang off the
              deck RETURN valve, downstream of the pad valve (series, not parallel) */}
          <text x={P.pool.x + 40} y={P.pool.y + 48} textAnchor="middle" style={{ font: "500 8.5px 'IBM Plex Mono', monospace", fill: C.faint }}>floor returns</text>
          <text x={P.spa.x + 40} y={P.spa.y - 40} textAnchor="middle" style={{ font: "500 8.5px 'IBM Plex Mono', monospace", fill: C.faint }}>spa jets</text>
          <text x={(P.vWF.x + P.vDeck.x) / 2} y="304" textAnchor="middle" style={{ font: "500 8px 'IBM Plex Mono', monospace", fill: C.faint }}>under-deck return trunk</text>
          <Box x={P.booster.x} y={P.booster.y} label="POLARIS BOOST" sub={s.boosterOn ? "running" : "off (seasonal)"} small w={116} tone={s.boosterOn ? C.ink : C.faint}
            onClick={() => setS((p) => ({ ...p, boosterOn: !p.boosterOn }))} />
          <Box x={P.cleaner.x} y={P.cleaner.y} label="HOSE CLEANER" small w={110} tone={C.faint} />

          {/* timer badges */}
          <TimerBadge x={P.pump.x - 10} y={P.pump.y - 105}
            lines={["INTELLIFLO SCHED", ...s.pumpWindows.map((w) => "filter: " + fmtWindow(w))]} />
          {/* Switched power from the right Intermatic to the booster it controls.
              Deliberately unlike the pipe runs — thin, dashed, amber — because
              this carries volts, not water, and conflating the two is exactly
              the confusion the diagram exists to prevent. Stops just short of
              both the dial rim and the booster box rather than running beneath
              them, since it draws after the nodes. */}
          <path d={`M ${P.dial.x + 46} ${P.dial.y - 8} L ${P.booster.x - 60} ${P.booster.y + 8}`}
            fill="none" stroke={C.timer} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          <text x={(P.dial.x + 46 + P.booster.x - 60) / 2} y={P.dial.y - 16} textAnchor="middle"
            style={{ font: "600 8.5px 'IBM Plex Mono', monospace", fill: C.timer }}>120 V</text>

          {/* The right Intermatic, drawn as itself rather than as a text badge.
              Scaled to ~0.44 so the whole mechanism plate fits the gap between
              the spa return and the booster node. Tap the lever to flip it. */}
          <g transform={`translate(${P.dial.x} ${P.dial.y}) scale(0.44)`}>
            <DialGraphic C={C} window={s.booster} nowMinutes={nowMinutes}
              dogsIn={s.rightTimer.dogsIn} lever={s.rightTimer.lever}
              onToggleLever={() => setS((p) => ({
                ...p, rightTimer: { ...p.rightTimer, lever: p.rightTimer.lever === "on" ? "off" : "on" },
              }))} />
          </g>
          <text x={P.dial.x} y={P.dial.y - 62} textAnchor="middle"
            style={{ font: "700 11px 'Barlow Semi Condensed'", fill: C.ink }}>INTERMATIC (right)</text>
          <text x={P.dial.x} y={P.dial.y + 82} textAnchor="middle"
            style={{ font: "500 9px 'IBM Plex Mono', monospace", fill: s.rightTimer.dogsIn ? C.timer : C.faint }}>
            {s.rightTimer.dogsIn ? `timer: ${fmtWindow(s.booster)}` : `manual — lever ${s.rightTimer.lever.toUpperCase()}`}
          </text>

          <ValveDot x={P.vDeck.x} y={P.vDeck.y} angle={s.deck === "pool" ? 0 : s.deck === "split" ? 90 : 180} label="DECK PAIR"
            sub={s.deck === "pool" ? "parallel = POOL" : s.deck === "split" ? "intermediate = SPLIT" : "180° = SPA"}
            onTap={() => setS((p) => ({ ...p, deck: p.deck === "pool" ? "split" : p.deck === "split" ? "spa" : "pool" }))} />
          <ValveDot x={P.vWF.x} y={P.vWF.y} angle={s.vwf === "pool" ? 0 : 90} label="PAD VALVE"
            sub={s.vwf === "pool" ? "up = POOL (trunk)" : "WATERFALL"}
            onTap={() => setS((p) => ({ ...p, vwf: p.vwf === "pool" ? "waterfall" : "pool" }))} />
        </svg>
      </div>

      <Timeline C={C} pumpWindows={s.pumpWindows} booster={s.booster}
        rightTimer={s.rightTimer} heaterMode={s.heaterMode} nowMinutes={nowMinutes}
        pumpBands={CURRENT_SCHEDULE} />

      {/* editable schedule windows — still placeholders until §6 is filled in */}
      <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ font: "700 15px 'Barlow Semi Condensed'" }}>Schedule windows</div>
          {!s.schedVerified && (
            <span style={{ font: "600 10px 'IBM Plex Mono', monospace", color: C.timer, background: "#FBF6E7", border: `1px solid ${C.timer}`, borderRadius: 6, padding: "2px 6px" }}>
              UNVERIFIED — read the IntelliFlo menu + timer trippers
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {s.pumpWindows.map((w, i) => (
            <WindowRow key={i} C={C} label={`IntelliFlo filtration ${s.pumpWindows.length > 1 ? `#${i + 1}` : ""}`}
              window={w}
              onChange={(next) => setS((p) => ({ ...p, pumpWindows: p.pumpWindows.map((x, j) => (j === i ? next : x)) }))}
              onRemove={s.pumpWindows.length > 1 ? () => setS((p) => ({ ...p, pumpWindows: p.pumpWindows.filter((_, j) => j !== i) })) : null} />
          ))}
          <div>
            <button onClick={() => setS((p) => ({ ...p, pumpWindows: [...p.pumpWindows, { start: "12:00", end: "14:00" }] }))}
              style={{ font: "600 11.5px 'IBM Plex Mono', monospace", padding: "6px 10px", borderRadius: 8, border: `1.5px dashed ${C.faint}`, background: "#fff", color: C.faint, cursor: "pointer" }}>
              + add filtration window
            </button>
          </div>
          <WindowRow C={C} label="Booster (right Intermatic)" window={s.booster}
            onChange={(next) => setS((p) => ({ ...p, booster: next }))} />
        </div>

        {/* Both dials in the Timing Control Center, drawn to match the physical
            units so they can be compared side by side at the pad. */}
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap", marginTop: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ font: "700 14px 'Barlow Semi Condensed'", color: C.ink }}>Right — Polaris booster</div>
            <IntermaticDial C={C} window={s.booster} nowMinutes={nowMinutes} size={215}
              dogsIn={s.rightTimer.dogsIn} lever={s.rightTimer.lever}
              onToggleLever={() => setS((p) => ({
                ...p, rightTimer: { ...p.rightTimer, lever: p.rightTimer.lever === "on" ? "off" : "on" },
              }))} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, font: "500 11px 'IBM Plex Mono', monospace", color: C.faint, cursor: "pointer" }}>
              <input type="checkbox" checked={s.rightTimer.dogsIn}
                onChange={(e) => setS((p) => ({ ...p, rightTimer: { ...p.rightTimer, dogsIn: e.target.checked } }))} />
              trip dogs installed
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ font: "700 14px 'Barlow Semi Condensed'", color: C.ink }}>Left — main power bus</div>
            <IntermaticDial C={C} window={{ start: "", end: "" }} nowMinutes={nowMinutes} size={215}
              dogsIn={false} lever={s.leftTimer.lever}
              caption={<>master disconnect · tripper-less · lever {s.leftTimer.lever.toUpperCase()}</>}
              onToggleLever={() => setS((p) => ({
                ...p, leftTimer: { ...p.leftTimer, lever: p.leftTimer.lever === "on" ? "off" : "on" },
              }))} />
          </div>

          <div style={{ font: "500 12px 'IBM Plex Mono', monospace", color: C.faint, lineHeight: 1.6, flex: "1 1 260px", minWidth: 260 }}>
            The silver tabs on the dial rim are the trip dogs: outer tab ON, inner
            tab OFF. Green marks the stretch where the switch is closed. The grey
            triangle is the current time — on the real timer the dial turns beneath
            a fixed pointer instead, so compare the <em>numeral</em> at the pointer,
            not the pointer's position.
            <div style={{ marginTop: 8 }}>
              The slider below each dial is the manual lever. Tap it to flip it.
            </div>
            <div style={{ marginTop: 8, color: C.timer }}>
              Right timer is in off-season manual mode: dogs OUT, so the dial
              actuates nothing and the lever alone decides. Reinstall the dogs when
              the trees start dropping and it resumes the window above. The left
              timer is confirmed tripper-less too — it's the pad's main power bus
              (de facto master disconnect), so its clock is moot; don't flip it off
              casually. See §3 of the handoff doc.
            </div>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, font: "500 11.5px 'IBM Plex Mono', monospace", color: C.faint, cursor: "pointer" }}>
          <input type="checkbox" checked={!!s.schedVerified}
            onChange={(e) => setS((p) => ({ ...p, schedVerified: e.target.checked }))} />
          These times were read off the equipment, not guessed
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
          IntelliFlo — internal schedule for filtration ({s.pumpWindows.map(fmtWindow).join(", ")}, ~23 h/day: Spd 1 3250 RPM daytime, Spd 5 1350 overnight); manual Speed 3 @3450 for heating, 3 h 10 min Time Out.<br />
          Hayward heater — own thermostat, no clock: fires whenever mode ≠ STANDBY and water flows. With the pump running ~23 h/day, a heater left on POOL fires almost continuously — the standby discipline is the whole game.<br />
          Right Intermatic — Polaris booster, manual seasonal switch (dogs out, lever OFF now); pool guy installs dogs in dirty season.<br />
          Left Intermatic — the pad's main power bus / master disconnect (tripper-less, lever ON) · SunTouch (AIR Error) abandoned in place.<br />
          Deck valve pair — manual pool/spa select (design-intent default is an intermediate SPLIT feeding both bodies) · Pad valve — pool vs waterfall return.
        </div>
      </div>

      <ProposedSchedule C={C} nowMinutes={nowMinutes} />

      <textarea value={notes} onChange={(e) => saveNotes(e.target.value)}
        placeholder="Field notes — exact schedule times from IntelliFlo menu, tripper positions, wire colors…"
        style={{ width: "100%", minHeight: 64, boxSizing: "border-box", font: "500 13px 'IBM Plex Mono', monospace", border: `1px solid ${C.pipe}`, borderRadius: 10, padding: 10, resize: "vertical" }} />
      <div style={{ font: "500 10.5px 'IBM Plex Mono', monospace", color: C.faint, marginTop: 8 }}>
        Color = temperature (blue cold, red hot — red only after a firing heater) · pattern = flow (dashes normal, dots restricted — dots only after a dirty filter) · tap equipment/valves to change state · timer fields persist.
        <br />
        The thin amber dashed line is switched 120 V from the timer to the booster — power, not water.
        <br />
        An amber heater means armed but <em>not</em> lit — below the flow switch the burner never fires, so the water downstream stays blue. That is the real "heat only works through the waterfall" complaint.
        {!isPersistent() && " · NOTE: this browser is blocking local storage (common when opening the file directly), so edits won't survive a reload."}
      </div>
    </div>
  );
}
