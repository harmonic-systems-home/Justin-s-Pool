import React, { useState } from "react";
import Timeline from "./Timeline.jsx";
import {
  CURRENT_SCHEDULE, PROPOSED_SCHEDULE, DEFAULT_RATE,
  kWhPerDay, dollarsPerMonth, wattsAtRpm,
} from "./energy.js";

// §6.5 of the handoff: a DRAFT time-of-use reprogram, kept deliberately separate
// from the live current-state model above. Everything here is "what we'd change
// to," pending pool-guy sign-off and a gallons/turnover check — never asserted as
// the pad's actual state. Collapsed by default so it doesn't crowd the manual.

// Proposed schedule as filtration windows (for the strip). The daytime peak
// window 12–8 PM is intentionally absent.
const PROP_WINDOWS = [{ start: "06:55", end: "12:00" }, { start: "20:00", end: "06:55" }];
const PROP_BOOSTER = { start: "09:30", end: "11:30" };

// Buttons = verbs, menu = background jobs (the keypad reassignment from §6.5).
const BUTTONS = [
  { n: 1, action: "Heat pool", rpm: "3450", dur: "3:10" },
  { n: 2, action: "Heat spa", rpm: "~2800", dur: "~1:00" },
  { n: 3, action: "Waterfall show", rpm: "~2800", dur: "~2:00" },
  { n: 4, action: "Manual utility", rpm: "3030", dur: "—" },
];

const money = (n) => `$${n.toFixed(0)}`;

export default function ProposedSchedule({ C, nowMinutes }) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const curKwh = kWhPerDay(CURRENT_SCHEDULE);
  const propKwh = kWhPerDay(PROPOSED_SCHEDULE);
  const curCost = dollarsPerMonth(CURRENT_SCHEDULE, rate);
  const propCost = dollarsPerMonth(PROPOSED_SCHEDULE, rate);
  const saveMo = curCost - propCost;

  const cell = { padding: "5px 9px", textAlign: "left", whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { font: "700 15px 'Barlow Semi Condensed'", color: C.ink, margin: "14px 0 6px" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}>
        <span style={{ font: "700 11px 'IBM Plex Mono', monospace", color: C.timer, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>▶</span>
        <span style={{ font: "700 15px 'Barlow Semi Condensed'", color: C.ink }}>Proposed TOU reprogram</span>
        <span style={{ font: "600 10px 'IBM Plex Mono', monospace", color: C.timer, background: "#FBF6E7", border: `1px solid ${C.timer}`, borderRadius: 6, padding: "2px 6px" }}>DRAFT · §6.5</span>
        {!open && <span style={{ font: "600 12px 'IBM Plex Mono', monospace", color: C.ok, marginLeft: "auto" }}>≈ {money(saveMo)}/mo saved</span>}
      </button>

      {open && (
        <div>
          <div style={{ font: "500 12px 'IBM Plex Mono', monospace", color: C.faint, lineHeight: 1.6, marginTop: 10 }}>
            The current high-RPM daytime profile is believed to be a vestige of the
            decommissioned rooftop solar (it needed high flow to lift to the roof
            during sun hours). Solar is gone and the house is on SMUD TOU (Tesla EV
            plan), so the win is shifting volume off-peak into a long-low profile.
            Sanitation is a trichlor floater + weekly service, so nothing ties
            turnover to pump run-hours. <strong style={{ color: C.ink }}>Pending: pool-guy sign-off, pool gallons vs turnover.</strong>
          </div>

          {/* Cost comparison */}
          <div style={head}>Pump energy — current vs proposed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 12px 'IBM Plex Mono', monospace", color: C.faint, marginBottom: 8 }}>
            <span>Rate</span>
            <input type="number" step="0.01" min="0" value={rate}
              onChange={(e) => setRate(Math.max(0, +e.target.value || 0))}
              style={{ width: 74, font: "500 12px 'IBM Plex Mono', monospace", padding: "5px 7px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink }} />
            <span>$/kWh blended · ×30 days</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", font: "500 12px 'IBM Plex Mono', monospace", color: C.ink }}>
              <thead>
                <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
                  <th style={cell}></th><th style={num}>kWh/day</th><th style={num}>$/mo</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.pad}` }}>
                  <td style={cell}>Current (captured 7/20)</td>
                  <td style={num}>{curKwh.toFixed(1)}</td>
                  <td style={num}>{money(curCost)}</td>
                </tr>
                <tr>
                  <td style={cell}>Proposed (off-peak)</td>
                  <td style={num}>{propKwh.toFixed(1)}</td>
                  <td style={num}>{money(propCost)}</td>
                </tr>
                <tr style={{ color: C.ok, borderTop: `1px solid ${C.pipe}` }}>
                  <td style={{ ...cell, fontWeight: 700 }}>Savings</td>
                  <td style={num}>−{(curKwh - propKwh).toFixed(1)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>−{money(saveMo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ font: "500 10.5px 'IBM Plex Mono', monospace", color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
            Watts per speed via the affinity law (P ∝ RPM³) anchored to the measured
            136 W @ 1350 RPM. The proposed profile is entirely off-peak, so its real
            bill is a bit below the flat-rate figure — the handoff's TOU-aware
            estimate is ≈ $25/mo.
          </div>

          {/* Proposed 24-h strip — note the booster window now sits inside a pump
              window (green), unlike the current-state orphan warnings above. */}
          <div style={head}>Proposed 24-hour schedule</div>
          <Timeline C={C} pumpWindows={PROP_WINDOWS} booster={PROP_BOOSTER}
            rightTimer={{ dogsIn: true, lever: "on" }} heaterMode="standby" nowMinutes={nowMinutes} />

          {/* Keypad reassignment */}
          <div style={head}>Keypad buttons = verbs</div>
          <div style={{ font: "500 12px 'IBM Plex Mono', monospace", color: C.faint, marginBottom: 6, lineHeight: 1.6 }}>
            Move the scheduled speeds to menu-only slots (Speed 5 = turnover, Speed
            6 = overnight) and put the on-demand jobs on the physical keys. Manual
            valve/heater steps still apply until a controller owns them.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", font: "500 12px 'IBM Plex Mono', monospace", color: C.ink }}>
              <thead>
                <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
                  <th style={cell}>Btn</th><th style={cell}>Action</th><th style={num}>RPM</th><th style={num}>Dur</th>
                </tr>
              </thead>
              <tbody>
                {BUTTONS.map((b) => (
                  <tr key={b.n} style={{ borderBottom: `1px solid ${C.pad}` }}>
                    <td style={cell}>{b.n}</td><td style={cell}>{b.action}</td>
                    <td style={num}>{b.rpm}</td><td style={num}>{b.dur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ font: "500 11.5px 'IBM Plex Mono', monospace", color: C.timer, lineHeight: 1.6, marginTop: 12 }}>
            <strong>Booster (dogs in):</strong> 9:30–11:30 AM — inside the turnover
            window, neighbor-friendly, off-peak, ~25¢/run.<br />
            <strong>Possible free interlock (verify):</strong> the Hayward pressure
            switch may stay OPEN at 1350 RPM, so the overnight leg could be
            inherently heater-proof even with MODE left on POOL — a damage limiter,
            not a guarantee. Test before relying on it; don't tune RPMs to sit near
            the threshold.<br />
            <strong>Caveat:</strong> egg timers auto-stop the pump only — heater
            standby and valve restoration stay human steps until a controller
            (IntelliConnect) owns them.
          </div>
        </div>
      )}
    </div>
  );
}
