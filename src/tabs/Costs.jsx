import React from "react";
import { C, mono, cond, Card, H, Badge, NumField, TimeField, money } from "../ui.jsx";
import { kWhPerDay, galPerDay, turnovers, galPerKWh } from "../energy.js";
import { scheduleTOU, bandTOU } from "../tou.js";
import { poolGal } from "../config.js";

// Reads the ACTIVE schedule. Electric cost is TOU-aware (peak 4–9 PM vs
// off-peak); turnover + gal/kWh columns give the water-quality context
// (CHANGES-REQUESTED #1). Gas is a visible PENDING placeholder until the BTU
// plate is clocked (CHANGES-REQUESTED #3) — the absence reads as known.

export default function Costs({ config, update }) {
  const active = config.schedules.active;
  const rates = config.rates.electric;
  const gas = config.rates.gas;
  const gpr = config.pump.gpmPerRpm;
  const gal = poolGal(config);

  const tou = scheduleTOU(active, rates);
  const kwh = kWhPerDay(active);
  const gpd = galPerDay(active, gpr);
  const to = turnovers(active, gal, gpr);
  const gpkwh = galPerKWh(active, gpr);

  const setRate = (k, v) => update((d) => { d.rates.electric[k] = v; });
  const setGas = (k, v) => update((d) => { d.rates.gas[k] = v; });

  const cell = { padding: "5px 9px", whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const btu = config.heater.btu;

  return (
    <div>
      <Card title="Rate assumptions" right={<Badge prov={rates.prov} />}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", font: mono(12), color: C.ink, alignItems: "center" }}>
          <span>Plan <b>{rates.plan}</b></span>
          <label>Peak <NumField value={rates.peak} step="0.01" min="0" suffix="$/kWh" onChange={(v) => setRate("peak", v)} /></label>
          <label>Off-peak <NumField value={rates.offPeak} step="0.01" min="0" suffix="$/kWh" onChange={(v) => setRate("offPeak", v)} /></label>
          <label style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>Peak window
            <TimeField value={rates.peakStart} onChange={(v) => setRate("peakStart", v)} /> →
            <TimeField value={rates.peakEnd} onChange={(v) => setRate("peakEnd", v)} /></label>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6 }}>E-TOU-C: peak applies 4–9 PM every day; all other hours off-peak. Edit to match the actual bill.</div>
      </Card>

      <Card title="Electric — pump (active schedule)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", font: mono(12), color: C.ink, width: "100%" }}>
            <thead>
              <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
                <th style={{ ...cell, textAlign: "left" }}>Band</th><th style={num}>kWh/d</th>
                <th style={num}>peak</th><th style={num}>off</th><th style={num}>$/day</th>
              </tr>
            </thead>
            <tbody>
              {active.map((b) => {
                const t = bandTOU(b, rates);
                return (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${C.pad}` }}>
                    <td style={{ ...cell, textAlign: "left" }}>{b.label} <span style={{ color: C.faint }}>{b.rpm} RPM</span></td>
                    <td style={num}>{t.kwh.toFixed(2)}</td>
                    <td style={num}>{t.peakKWh.toFixed(2)}</td>
                    <td style={num}>{t.offKWh.toFixed(2)}</td>
                    <td style={num}>{money(t.cost, 2)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: `1px solid ${C.pipe}`, font: mono(12, 700) }}>
                <td style={{ ...cell, textAlign: "left" }}>Total</td>
                <td style={num}>{tou.kwh.toFixed(1)}</td>
                <td style={num}>{tou.peakKWh.toFixed(1)}</td>
                <td style={num}>{tou.offKWh.toFixed(1)}</td>
                <td style={num}>{money(tou.cost, 2)}/day</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, font: mono(13, 600) }}>
          <Stat label="Monthly" value={`${money(tou.cost * 30)}/mo`} />
          <Stat label="Turnovers/day" value={to.toFixed(1)} sub="1.0 = residential std" />
          <Stat label="Efficiency" value={`${Math.round(gpkwh).toLocaleString()} gal/kWh`} />
          <Stat label="Water moved" value={`${Math.round(gpd).toLocaleString()} gal/day`} />
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Turnover from flow ∝ RPM ({config.pump.gpmPerRpm} GPM/RPM, est) against pool volume {gal.toLocaleString()} gal. <b>4× turnovers is the fingerprint of the removed solar's flow needs, not a water-quality spec</b> — 1.0/day is the residential standard.
        </div>
      </Card>

      <Card title="Gas — heater" right={<Badge prov={config.heater.prov} />}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", font: mono(12), alignItems: "center", marginBottom: 8 }}>
          <label>$/therm <NumField value={gas.perTherm} step="0.05" min="0" onChange={(v) => setGas("perTherm", v)} /></label>
          <span>BTU input {btu ? <b>{btu.toLocaleString()}</b> : <span style={{ color: C.warn }}>pending — clock the gas meter (Commissioning)</span>}</span>
        </div>
        {btu ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", font: mono(12), color: C.ink }}>
              <thead><tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
                <th style={{ ...cell, textAlign: "left" }}>Egg timer</th><th style={num}>$/hr firing</th><th style={num}>$/session</th><th style={num}>°F/session</th>
              </tr></thead>
              <tbody>
                {config.eggTimers.filter((t) => t.hours).map((t) => {
                  const perHr = (btu / 100000) * gas.perTherm;
                  const lbs = gal * 8.34;
                  const degPerHr = (btu * 0.8) / lbs;
                  return (
                    <tr key={t.btn} style={{ borderBottom: `1px solid ${C.pad}` }}>
                      <td style={{ ...cell, textAlign: "left" }}>{t.label}</td>
                      <td style={num}>{money(perHr, 2)}</td>
                      <td style={num}>{money(perHr * t.hours, 2)}</td>
                      <td style={num}>{(degPerHr * t.hours).toFixed(1)} °F</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ font: mono(11.5), color: C.faint, lineHeight: 1.6 }}>
            When BTU lands: $/hr = BTU/100k × $/therm; $/session = ×3.17 h (heat-pool egg timer); °F/session = BTU×0.8 / (pool lbs) × hours.
            At {gal.toLocaleString()} gal (~{Math.round(gal * 8.34 / 1000)}k lbs): ~1.6 °F/hr (H250) to ~2.5 °F/hr (H400) → the 3:10 run ≈ 5–8 °F.
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ font: mono(9.5), color: C.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ font: cond(19), color: C.ink }}>{value}</div>
      {sub && <div style={{ font: mono(9), color: C.faint }}>{sub}</div>}
    </div>
  );
}
