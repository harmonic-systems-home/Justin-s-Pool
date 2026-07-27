import React from "react";
import { C, mono, cond, Card, Badge, NumField, money, Sensitive } from "../ui.jsx";
import { kWhPerDay, galPerDay, turnovers, galPerKWh } from "../energy.js";
import { scheduleTOU, bandTOU, effectiveSeason, PERIOD_STYLE } from "../tou.js";
import { toRealBands } from "../schedule.js";
import { poolGal } from "../config.js";

// Reads the ACTIVE schedule. Electric cost is SMUD TOD (seasonal, weekday, with
// the midnight–6 AM EV band); turnover + gal/kWh give the water-quality context
// (CHANGES-REQUESTED #1). Gas is a visible PENDING placeholder until BTU is
// clocked (CHANGES-REQUESTED #3).

const PERIODS = ["peak", "midPeak", "offPeak", "ev"];

export default function Costs({ config, update, authed }) {
  // TOU cost depends on WHEN the pump runs, so cost math uses REAL time (the
  // programmed schedule shifted by the IntelliFlo clock offset). kWh/turnover
  // are placement-independent, so they use the raw bands.
  const clkOff = config.clocks?.intelliflo?.offsetMin || 0;
  const active = config.schedules.active;
  const activeReal = toRealBands(active, clkOff);
  const rates = config.rates.electric;
  const gas = config.rates.gas;
  const pump = config.pump;
  const gpr = config.pump.gpmPerRpm;
  const gal = poolGal(config);
  const season = effectiveSeason(rates);

  const tou = scheduleTOU(activeReal, rates, pump, season);
  const kwh = kWhPerDay(active, pump);
  const gpd = galPerDay(active, gpr);
  const to = turnovers(active, gal, gpr);
  const gpkwh = galPerKWh(active, gpr);

  const setSeason = (v) => update((d) => { d.rates.electric.season = v; });
  const setRate = (path, v) => update((d) => {
    const [grp, key] = path;
    d.rates.electric[grp][key] = v;
  });
  const setEV = (v) => update((d) => { d.rates.electric.ev.discount = v; });
  const setGas = (k, v) => update((d) => { d.rates.gas[k] = v; });

  const cell = { padding: "5px 9px", whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const btu = config.heater.btu;
  const r = rates[season];

  return (
    <div>
      <Card title="SMUD Time-of-Day rates" right={<Badge prov={rates.prov} />}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", font: mono(12), color: C.ink, alignItems: "center", marginBottom: 8 }}>
          <span>Plan <b>{rates.plan}</b></span>
          <label>Season
            <select value={rates.season} onChange={(e) => setSeason(e.target.value)}
              style={{ font: mono(12), marginLeft: 5, padding: "5px 7px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink }}>
              <option value="auto">auto ({season})</option>
              <option value="summer">summer</option>
              <option value="winter">winter</option>
            </select>
          </label>
          <span style={{ color: C.faint }}>peak 5–8 PM weekdays{season === "summer" ? " · mid-peak noon–5 + 8–mid" : ""} · EV band midnight–6 AM</span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", font: mono(11.5), alignItems: "center" }}>
          <label>Summer peak <NumField value={rates.summer.peak} step="0.001" onChange={(v) => setRate(["summer", "peak"], v)} /></label>
          <label>mid <NumField value={rates.summer.midPeak} step="0.001" onChange={(v) => setRate(["summer", "midPeak"], v)} /></label>
          <label>off <NumField value={rates.summer.offPeak} step="0.001" onChange={(v) => setRate(["summer", "offPeak"], v)} /></label>
          <span style={{ color: C.pipe }}>|</span>
          <label>Winter peak <NumField value={rates.winter.peak} step="0.001" onChange={(v) => setRate(["winter", "peak"], v)} /></label>
          <label>off <NumField value={rates.winter.offPeak} step="0.001" onChange={(v) => setRate(["winter", "offPeak"], v)} /></label>
          <span style={{ color: C.pipe }}>|</span>
          <label>EV discount −<NumField value={rates.ev.discount} step="0.001" onChange={setEV} /></label>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6, lineHeight: 1.5 }}>Summer rates + the EV credit are <b>MEASURED</b> from Justin's SMUD bill (7/20/26; EV discount confirmed active). Winter is still the web schedule — capture from an Oct–May bill. Weekday rates shown — weekends are all off-peak (cheaper). EV band = off-peak − discount, and requires the Tesla registered at this service address. (SMUD's ~$27/mo fixed service charge isn't shown — it's a whole-account cost Justin pays with or without the pool.)</div>
      </Card>

      <Card title={`Electric — pump (active schedule, ${season} weekday${clkOff ? ", REAL time" : ""})`}
        right={clkOff ? <span style={{ font: mono(9.5, 600), color: C.warn }}>priced at real run-time (clock {Math.round(Math.abs(clkOff) / 60)} h off)</span> : null}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", font: mono(12), color: C.ink, width: "100%" }}>
            <thead>
              <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}` }}>
                <th style={{ ...cell, textAlign: "left" }}>Band</th><th style={num}>kWh/d</th>
                {PERIODS.map((p) => <th key={p} style={num}>{PERIOD_STYLE[p].label} kWh</th>)}
                <th style={num}>$/day</th>
              </tr>
            </thead>
            <tbody>
              {activeReal.map((b) => {
                const t = bandTOU(b, rates, pump, season);
                return (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${C.pad}` }}>
                    <td style={{ ...cell, textAlign: "left" }}>{b.label} <span style={{ color: C.faint }}>{b.rpm}</span></td>
                    <td style={num}>{t.kwh.toFixed(2)}</td>
                    {PERIODS.map((p) => <td key={p} style={{ ...num, color: t.by[p] > 0.001 ? PERIOD_STYLE[p].ink : C.pipe }}>{t.by[p].toFixed(2)}</td>)}
                    <td style={num}>{money(t.cost, 2)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: `1px solid ${C.pipe}`, font: mono(12, 700) }}>
                <td style={{ ...cell, textAlign: "left" }}>Total</td>
                <td style={num}>{tou.kwh.toFixed(1)}</td>
                {PERIODS.map((p) => <td key={p} style={num}>{tou.by[p].toFixed(1)}</td>)}
                <td style={num}>{money(tou.cost, 2)}/day</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, font: mono(13, 600) }}>
          <Stat label="Monthly (weekday×30)" value={`${money(tou.cost * 30)}/mo`} />
          <Stat label="Turnovers/day" value={to.toFixed(1)} sub="1.0 = residential std" />
          <Stat label="Efficiency" value={`${Math.round(gpkwh).toLocaleString()} gal/kWh`} />
          <Stat label="Water moved" value={`${Math.round(gpd).toLocaleString()} gal/day`} />
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Turnover from flow ∝ RPM ({config.pump.gpmPerRpm} GPM/RPM, est) against pool volume {gal.toLocaleString()} gal. <b>4× turnovers is the fingerprint of the removed solar's flow needs, not a water-quality spec</b> (1.0/day is the residential standard). Monthly = weekday $/day × 30 (a slight overestimate — weekends are all off-peak).
        </div>
      </Card>

      <Card title="Gas — heater" right={<Badge prov={config.heater.prov} />}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", font: mono(12), alignItems: "center", marginBottom: 8 }}>
          <label>$/therm <NumField value={gas.perTherm} step="0.05" min="0" onChange={(v) => setGas("perTherm", v)} /></label>
          <span>Heater {config.heater.model ? <b>{config.heater.model}</b> : "—"}</span>
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
                  const degPerHr = (btu * 0.8) / (gal * 8.34);
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
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          The house baseline already spends PG&E's cheap Tier-1 allowance (~0.39 therms/day), so every therm the pool heater burns is at the <b>marginal</b> price — Tier 2 $2.98 + PPP $0.121 + 2.5% county tax ≈ ${gas.perTherm}/therm (bill 7/16/26). A Speed-3 heat run is ~13 therms ≈ {money((btu / 100000) * gas.perTherm * 3.17, 0)}. The bill's daily-therms graph doubles as a heater-session log (spikes above the ~1 therm/day house baseline).
        </div>
      </Card>

      <Card title="Pool service" right={<span style={{ font: mono(9, 700), color: C.warn, background: "#FDECE7", border: `1px solid ${C.warn}`, borderRadius: 5, padding: "1px 5px" }}>SENSITIVE</span>}>
        <div style={{ font: mono(12), color: C.ink }}>
          Monthly pool-guy fee: <Sensitive authed={authed} value={config.private.poolGuyFeeMonthly} prefix="$"
            placeholder="/mo" onChange={(v) => update((d) => { d.private.poolGuyFeeMonthly = v; })} />
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
          Sensitive: this value lives only in the private data repo and arrives only with the pool password, so the shareable URL stays safe to hand to the pool guy or other workers.
        </div>
      </Card>

      <Card title="Monthly picture">
        {(() => {
          const electricMo = tou.cost * 30;
          const fee = config.private.poolGuyFeeMonthly;
          const feeNum = parseFloat(fee);
          const haveFee = authed && fee !== "" && !isNaN(feeNum);
          return (
            <div style={{ font: mono(12.5), color: C.ink, lineHeight: 1.8 }}>
              Electric (pump): <b>{money(electricMo)}/mo</b> <span style={{ color: C.faint }}>({season} weekday × 30)</span><br />
              {haveFee
                ? <>Pool service: <b>{money(feeNum)}/mo</b><br /><span style={{ font: cond(19) }}>Total ≈ {money(electricMo + feeNum)}/mo</span> <span style={{ color: C.faint, font: mono(10.5) }}>+ gas per heating session</span></>
                : <><span style={{ font: cond(19) }}>Total ≈ {money(electricMo)}/mo</span> <span style={{ color: C.faint, font: mono(10.5) }}>— utilities only; unlock for the full total (pool service is sensitive) · + gas per session</span></>}
              <div style={{ font: mono(10.5), color: C.faint, marginTop: 6 }}>+ gas billed per heat session (~{money((config.heater.btu / 100000) * gas.perTherm * 3.17, 0)} each).</div>
            </div>
          );
        })()}
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
