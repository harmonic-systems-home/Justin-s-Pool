import React from "react";
import { DAY, spans, toMinutes, fmt, fmtWindow, uncoveredMinutes } from "./schedule.js";
import { bandCost, DEFAULT_RATE } from "./energy.js";

// 24-hour strip showing which clock runs what, and where they disagree.
//
// Four separate clocks drive this pad (IntelliFlo internal schedule, two
// Intermatic timers, the heater's own thermostat with no clock at all), and
// nothing coordinates them. Laid out on a shared axis, the two failure modes
// from the survey become visible rather than theoretical:
//
//   - booster running outside every pump window  -> dead-heads the Polaris
//   - heater left off STANDBY                    -> fires on the overnight run

const LANE_H = 26;
const GAP = 10;
const LABEL_W = 116;
const RIGHT_PAD = 14;
const AXIS_H = 22;

export default function Timeline({ C, pumpWindows, booster, rightTimer, heaterMode, nowMinutes, pumpBands, rate = DEFAULT_RATE }) {
  const width = 1000;
  const trackX = LABEL_W;
  const trackW = width - LABEL_W - RIGHT_PAD;
  const xOf = (mins) => trackX + (mins / DAY) * trackW;

  const heaterArmed = heaterMode !== "standby";
  const dogsIn = rightTimer?.dogsIn ?? true;
  const leverOn = (rightTimer?.lever ?? "on") === "on";
  // Only a timer with its dogs installed has a window to be orphaned.
  const orphanMins = dogsIn ? uncoveredMinutes(booster, pumpWindows) : 0;

  // With the dogs out the dial actuates nothing, so the booster lane is not a
  // schedule at all: lever ON means continuous power across the whole day (drawn
  // in warn colour, since nothing will ever switch it back off), lever OFF means
  // no power at any hour.
  const boosterBars = dogsIn
    ? spans(booster).map((sp) => ({ sp, fill: orphanMins > 0 ? C.warn : C.ok }))
    : leverOn
      ? [{ sp: [0, DAY], fill: C.warn }]
      : [];

  // Pump-lane bars. Given per-band metadata (RPM + effective hours) each band is
  // labelled with its speed and, on its widest visible span, the estimated
  // $/day; without it the lane falls back to plain flow bars from pumpWindows.
  const pumpBars = pumpBands
    ? pumpBands.flatMap((b) => {
        const segs = spans(b);
        if (!segs.length) return [];
        const widest = segs.reduce((a, c) => (c[1] - c[0] > a[1] - a[0] ? c : a));
        const cost = bandCost(b, rate);
        return segs.map((sp) => ({ sp, fill: C.flow, rpm: b.rpm, cost: sp === widest ? cost : null }));
      })
    : pumpWindows.flatMap((w) => spans(w).map((sp) => ({ sp, fill: C.flow })));
  const pumpTotal = pumpBands ? pumpBands.reduce((t, b) => t + bandCost(b, rate), 0) : null;

  const lanes = [
    {
      key: "pump",
      label: "INTELLIFLO",
      sub: "filtration",
      bars: pumpBars,
    },
    {
      key: "booster",
      label: "INTERMATIC",
      sub: dogsIn ? "Polaris boost" : "manual (dogs out)",
      bars: boosterBars,
      empty: "dogs out, lever OFF — booster has no power at any hour",
    },
    {
      key: "heater",
      label: "HAYWARD",
      sub: heaterArmed ? `mode: ${heaterMode}` : "standby",
      // The heater has no clock: it fires whenever it's armed and water moves.
      // So its lane is exactly the pump lane, intersected with "armed".
      bars: heaterArmed
        ? pumpWindows.flatMap((w) => spans(w).map((sp) => ({ sp, fill: C.hot, hatch: true })))
        : [],
      empty: heaterArmed ? null : "STANDBY — will not fire",
    },
  ];

  const height = AXIS_H + lanes.length * (LANE_H + GAP) + 8;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ font: "700 15px 'Barlow Semi Condensed'" }}>24-hour clock agreement</div>
        <div style={{ font: "500 11px 'IBM Plex Mono', monospace", color: C.faint }}>
          four clocks, nothing coordinating them
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", display: "block" }}>
        <defs>
          {/* Hatching marks "burning gas unattended" — reads as hazard, and stays
              distinguishable from a solid bar without relying on color alone. */}
          <pattern id="tl-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill={C.hot} />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#fff" strokeWidth="3" opacity="0.55" />
          </pattern>
        </defs>

        {/* hour gridlines every 3 h */}
        {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
          <g key={h}>
            <line x1={xOf(h * 60)} y1={AXIS_H - 6} x2={xOf(h * 60)} y2={height - 8}
              stroke={C.pipe} strokeWidth="1" opacity={h % 12 === 0 ? 1 : 0.5} />
            <text x={xOf(h * 60)} y={AXIS_H - 12} textAnchor="middle"
              style={{ font: "500 10px 'IBM Plex Mono', monospace", fill: C.faint }}>
              {h === 0 ? "12A" : h === 12 ? "12P" : h > 12 ? `${h - 12}P` : `${h}A`}
            </text>
          </g>
        ))}

        {lanes.map((lane, i) => {
          const y = AXIS_H + i * (LANE_H + GAP);
          return (
            <g key={lane.key}>
              <text x={LABEL_W - 12} y={y + 15} textAnchor="end"
                style={{ font: "700 11px 'Barlow Semi Condensed'", fill: C.ink }}>{lane.label}</text>
              <text x={LABEL_W - 12} y={y + 25} textAnchor="end"
                style={{ font: "500 8.5px 'IBM Plex Mono', monospace", fill: C.faint }}>{lane.sub}</text>

              <rect x={trackX} y={y} width={trackW} height={LANE_H} rx="5"
                fill="#F4F7F7" stroke={C.pipe} strokeWidth="1" />

              {lane.bars.map(({ sp, fill, hatch, rpm, cost }, j) => {
                const x0 = xOf(sp[0]);
                const w = Math.max(2, xOf(sp[1]) - x0);
                // Fit the richest label the band width allows: RPM + $/day, then
                // RPM + $, then bare RPM, then nothing on a sliver.
                const label = rpm == null ? null
                  : cost != null && w > 150 ? `${rpm} RPM · $${cost.toFixed(2)}/day`
                  : cost != null && w > 74 ? `${rpm} · $${cost.toFixed(2)}`
                  : w > 40 ? `${rpm}` : null;
                return (
                  <g key={j}>
                    <rect x={x0} y={y + 3} width={w} height={LANE_H - 6}
                      rx="4" fill={hatch ? "url(#tl-hatch)" : fill} stroke={hatch ? C.hot : "none"} strokeWidth="1" />
                    {label && (
                      <text x={x0 + w / 2} y={y + LANE_H / 2 + 3} textAnchor="middle"
                        style={{ font: "700 9px 'IBM Plex Mono', monospace", fill: "#fff" }}>{label}</text>
                    )}
                  </g>
                );
              })}

              {lane.empty && lane.bars.length === 0 && (
                <text x={trackX + 10} y={y + 17}
                  style={{ font: "500 10px 'IBM Plex Mono', monospace", fill: C.faint }}>{lane.empty}</text>
              )}
            </g>
          );
        })}

        {/* now marker */}
        {nowMinutes != null && (
          <g>
            <line x1={xOf(nowMinutes)} y1={AXIS_H - 6} x2={xOf(nowMinutes)} y2={height - 8}
              stroke={C.ink} strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={xOf(nowMinutes)} y={height - 1} textAnchor="middle"
              style={{ font: "600 9px 'IBM Plex Mono', monospace", fill: C.ink }}>now</text>
          </g>
        )}
      </svg>

      <div style={{ font: "500 11px 'IBM Plex Mono', monospace", color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
        {pumpBands
          ? <span>filtration ~${pumpTotal.toFixed(2)}/day (est @ {(rate * 100).toFixed(1)}¢/kWh)</span>
          : pumpWindows.map((w, i) => <span key={i}>filtration {fmtWindow(w)}{i < pumpWindows.length - 1 ? " · " : ""}</span>)}
        {dogsIn
          ? <> · booster {fmtWindow(booster)}</>
          : <> · booster on manual lever ({leverOn ? "ON — continuous" : "OFF"}), no schedule</>}
      </div>
    </div>
  );
}
