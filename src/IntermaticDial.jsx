import React from "react";
import { DAY, toMinutes, fmt, spans } from "./schedule.js";

// A drawn likeness of the Intermatic T104 dials in the Timing Control Center,
// so the on-screen schedule is recognizable as the same object Justin is
// standing in front of with the door open.
//
// Orientation is taken from the survey photo, not from convention: 12 nite sits
// at top, AM hours run DOWN THE LEFT side, 12 noon is at the bottom, and PM
// hours run UP THE RIGHT. Time therefore advances counter-clockwise. (Checked
// against six labels in the photo.) On the real timer the dial rotates beneath a
// fixed pointer, which is why the printed numerals read "backwards" — here the
// face is fixed and the pointer moves, which is equivalent to read and far
// easier to follow.
//
// Two independent things decide whether the load has power:
//
//   dogsIn  — are the trip pins ("dogs") installed on the dial? With them out,
//             the dial spins but never actuates anything and the timer is a
//             plain manual switch. That is how the booster timer sits in the
//             off-season, per the owner.
//   lever   — the manual ON/OFF tab on the mechanism below the dial.
//
// So an empty ON arc is not the same as "off": with the dogs out there is no
// schedule at all, and the lever alone decides.

const R_FACE = 100;
const R_RIM = 108;
const R_TICK_OUT = 92;
const R_LABEL = 66;
const R_TRIPPER = 99;

const PLATE_TOP = 116;
const PLATE_BOT = 152;
const VIEW_X = 124;

// minutes → degrees clockwise from 12 o'clock (negative = counter-clockwise)
const angleOf = (mins) => -(mins / DAY) * 360;

const pt = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
};

const LABELS = [
  [0, "12", "nite"], [120, "2", "am"], [240, "4", "am"], [360, "6", "am"],
  [480, "8", "am"], [600, "10", "am"], [720, "12", "noon"], [840, "2", "pm"],
  [960, "4", "pm"], [1080, "6", "pm"], [1200, "8", "pm"], [1320, "10", "pm"],
];

/** Arc along radius r from minute a to minute b, advancing counter-clockwise. */
function arc(r, a, b) {
  const [x1, y1] = pt(r, angleOf(a));
  const [x2, y2] = pt(r, angleOf(b));
  const largeArc = (b - a + DAY) % DAY > DAY / 2 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}

function Tripper({ mins, kind }) {
  const deg = angleOf(mins);
  const [x, y] = pt(R_TRIPPER, deg);
  const on = kind === "on";
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      <rect x="-4.5" y="-11" width="9" height="22" rx="2.5"
        fill={on ? "#C9CFD2" : "#8C9599"} stroke="#5C666B" strokeWidth="1.2" />
      <line x1="0" y1="-6" x2="0" y2="6" stroke="#5C666B" strokeWidth="1.2" />
    </g>
  );
}

/** The manual ON/OFF tab on the mechanism plate below the dial. */
function ManualLever({ C, lever, onToggle }) {
  const on = lever === "on";
  const knobX = on ? 21 : -21;
  return (
    <g onClick={onToggle} style={{ cursor: onToggle ? "pointer" : "default" }}>
      <rect x={-58} y={PLATE_TOP} width={116} height={PLATE_BOT - PLATE_TOP} rx="5"
        fill="#B9BEC0" stroke="#7E8689" strokeWidth="1.5" />
      <rect x={-40} y={PLATE_TOP + 11} width={80} height={14} rx="7"
        fill="#8A9295" stroke="#6B7376" strokeWidth="1" />
      <text x={-40} y={PLATE_TOP + 8} textAnchor="middle"
        style={{ font: "700 8px 'IBM Plex Mono', monospace", fill: "#3E4547" }}>OFF</text>
      <text x={40} y={PLATE_TOP + 8} textAnchor="middle"
        style={{ font: "700 8px 'IBM Plex Mono', monospace", fill: "#3E4547" }}>ON</text>
      <g transform={`translate(${knobX} 0)`} style={{ transition: "transform 200ms ease" }}>
        <rect x={-13} y={PLATE_TOP + 5} width={26} height={26} rx="4"
          fill={on ? C.ok : "#DDE1E2"} stroke={on ? "#1F6B41" : "#6B7376"} strokeWidth="1.5" />
        <line x1="0" y1={PLATE_TOP + 11} x2="0" y2={PLATE_TOP + 25}
          stroke={on ? "#fff" : "#6B7376"} strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
}

/**
 * The dial as a bare <g>, so it can be dropped into the schematic's SVG as well
 * as rendered standalone in a card.
 */
export function DialGraphic({ C, window: w, nowMinutes, dogsIn = true, lever = "on", onToggleLever }) {
  const segs = dogsIn ? spans(w) : [];
  const start = toMinutes(w?.start);
  const end = toMinutes(w?.end);

  return (
    <g>
      <circle r={R_RIM} fill="url(#dial-rim)" stroke="#B3A75F" strokeWidth="1.5" />
      <circle r={R_FACE} fill="url(#dial-face)" stroke="#BCB06A" strokeWidth="1" />

      {segs.map(([a, b], i) => (
        <path key={i} d={arc(R_TRIPPER - 5, a, b)} fill="none"
          stroke={C.ok} strokeWidth="7" strokeLinecap="butt" opacity="0.85" />
      ))}

      {Array.from({ length: 96 }, (_, i) => i * 15).map((m) => {
        const deg = angleOf(m);
        const major = m % 120 === 0, hour = m % 60 === 0;
        const len = major ? 15 : hour ? 10 : 5;
        const [x1, y1] = pt(R_TICK_OUT, deg);
        const [x2, y2] = pt(R_TICK_OUT - len, deg);
        return <line key={m} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#3C3A28" strokeWidth={major ? 2.6 : hour ? 1.6 : 1} strokeLinecap="round" />;
      })}

      {LABELS.map(([m, big, small]) => {
        const deg = angleOf(m);
        const [x, y] = pt(R_LABEL, deg);
        return (
          <g key={m} transform={`translate(${x} ${y}) rotate(${deg})`}>
            <text textAnchor="middle" y="4"
              style={{ font: "700 17px 'Barlow Semi Condensed', sans-serif", fill: "#2B2A1C" }}>{big}</text>
            <text textAnchor="middle" y="15"
              style={{ font: "500 8px 'IBM Plex Mono', monospace", fill: "#4A4832" }}>{small}</text>
          </g>
        );
      })}

      <text textAnchor="middle" y="-34"
        style={{ font: "600 7.5px 'IBM Plex Mono', monospace", fill: "#5A5740", letterSpacing: "0.08em" }}>
        PULL OUT DIAL
      </text>
      <text textAnchor="middle" y="42"
        style={{ font: "600 7.5px 'IBM Plex Mono', monospace", fill: "#5A5740", letterSpacing: "0.08em" }}>
        TURN DIAL TO SET TIME
      </text>

      {/* Trippers only exist on the dial when the dogs are installed. */}
      {dogsIn && start != null && <Tripper mins={start} kind="on" />}
      {dogsIn && end != null && <Tripper mins={end} kind="off" />}

      {nowMinutes != null && (
        <g transform={`rotate(${angleOf(nowMinutes)})`}>
          <path d={`M -5 0 L 0 ${-(R_FACE - 6)} L 5 0 Z`} fill="#6E6A4E" opacity="0.9" />
        </g>
      )}

      <circle r="15" fill="#D7D9D6" stroke="#8A8F8C" strokeWidth="1.5" />
      <circle r="4" fill="#9AA09C" stroke="#6E7472" strokeWidth="1" />

      <ManualLever C={C} lever={lever} onToggle={onToggleLever} />
    </g>
  );
}

/** Gradients the dial needs. Include once per <svg> that hosts a DialGraphic. */
export function DialDefs() {
  return (
    <defs>
      <radialGradient id="dial-face" cx="42%" cy="34%">
        <stop offset="0%" stopColor="#F5EFC0" />
        <stop offset="70%" stopColor="#E8E0A2" />
        <stop offset="100%" stopColor="#D8CE8C" />
      </radialGradient>
      <linearGradient id="dial-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EFE8B4" />
        <stop offset="100%" stopColor="#C9BE78" />
      </linearGradient>
    </defs>
  );
}

export default function IntermaticDial({ C, window: w, nowMinutes, size = 220, caption, dogsIn = true, lever = "on", onToggleLever }) {
  const start = toMinutes(w?.start), end = toMinutes(w?.end);
  const height = (VIEW_X + PLATE_BOT + 8) / (VIEW_X * 2);
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg viewBox={`${-VIEW_X} ${-VIEW_X} ${VIEW_X * 2} ${VIEW_X + PLATE_BOT + 8}`}
        style={{ width: size, height: size * height, display: "block" }}>
        <DialDefs />
        <DialGraphic C={C} window={w} nowMinutes={nowMinutes} dogsIn={dogsIn} lever={lever} onToggleLever={onToggleLever} />
      </svg>
      <figcaption style={{ font: "500 11px 'IBM Plex Mono', monospace", color: C.faint, textAlign: "center", maxWidth: 240 }}>
        {caption ?? (dogsIn
          ? <>ON {start == null ? "—" : fmt(start)} · OFF {end == null ? "—" : fmt(end)}</>
          : <>dogs removed — no schedule · manual lever {lever.toUpperCase()}</>)}
      </figcaption>
    </figure>
  );
}
