// SMUD Time-of-Day cost model (weekday, seasonal, with a midnight–6 AM EV band).
//
// Fixed weekday periods (SMUD TOD 5–8 PM):
//   peak         5–8 PM               (summer & winter)
//   mid-peak     noon–5 PM + 8 PM–mid (SUMMER only)
//   off-peak     everything else
//   EV band      midnight–6 AM        = the applicable (off-peak) rate − discount
//
// Weekends/holidays are all off-peak; we model a representative WEEKDAY (the
// higher case) and note it. A band runs at constant RPM, so its energy is
// constant power × time — we integrate the piecewise rate minute-by-minute
// (bands are ≤2 spans, cheap) to get cost + a per-period breakdown.

import { spans } from "./schedule.js";
import { wattsAt } from "./energy.js";

const H = (h) => h * 60;
const PEAK = [H(17), H(20)];
const SUMMER_MID = [[H(12), H(17)], [H(20), H(24)]];
const EV = [0, H(6)];
const within = (m, [a, b]) => m >= a && m < b;

// SMUD summer = Jun 1–Sep 30. `month` is 0-indexed (May=4 … Sep=8).
export function effectiveSeason(rates, month) {
  if (rates.season === "summer" || rates.season === "winter") return rates.season;
  const m = month ?? 6;
  return m >= 5 && m <= 8 ? "summer" : "winter";
}

export function periodAtMinute(min, rates, season) {
  season = season || effectiveSeason(rates);
  if (rates.ev?.enabled && within(min, EV)) return "ev";
  if (within(min, PEAK)) return "peak";
  if (season === "summer" && SUMMER_MID.some((s) => within(min, s))) return "midPeak";
  return "offPeak";
}

export function rateAtMinute(min, rates, season) {
  season = season || effectiveSeason(rates);
  const r = rates[season];
  let base;
  if (within(min, PEAK)) base = r.peak;
  else if (season === "summer" && SUMMER_MID.some((s) => within(min, s))) base = r.midPeak;
  else base = r.offPeak;
  if (rates.ev?.enabled && within(min, EV)) base -= rates.ev.discount; // EV window is always off-peak base
  return base;
}

// Merge the day into contiguous rate segments — drives the timeline TOU lane.
export function rateSegments(rates, season) {
  season = season || effectiveSeason(rates);
  const segs = [];
  for (let m = 0; m < H(24); m++) {
    const p = periodAtMinute(m, rates, season);
    const last = segs[segs.length - 1];
    if (last && last.period === p) last.end = m + 1;
    else segs.push({ start: m, end: m + 1, period: p, rate: rateAtMinute(m, rates, season) });
  }
  return segs;
}

// { kwh, cost, by:{peak,midPeak,offPeak,ev} } for one band.
export function bandTOU(band, rates, pump, season) {
  season = season || effectiveSeason(rates);
  const kwhPerMin = wattsAt(band.rpm, pump) / 1000 / 60;
  const out = { kwh: 0, cost: 0, by: { peak: 0, midPeak: 0, offPeak: 0, ev: 0 } };
  for (const [a, b] of spans(band)) {
    for (let m = a; m < b; m++) {
      out.kwh += kwhPerMin;
      out.cost += kwhPerMin * rateAtMinute(m, rates, season);
      out.by[periodAtMinute(m, rates, season)] += kwhPerMin;
    }
  }
  return out;
}

export const scheduleTOU = (sched, rates, pump, season) =>
  sched.reduce((a, b) => {
    const t = bandTOU(b, rates, pump, season);
    return {
      kwh: a.kwh + t.kwh, cost: a.cost + t.cost,
      by: {
        peak: a.by.peak + t.by.peak, midPeak: a.by.midPeak + t.by.midPeak,
        offPeak: a.by.offPeak + t.by.offPeak, ev: a.by.ev + t.by.ev,
      },
    };
  }, { kwh: 0, cost: 0, by: { peak: 0, midPeak: 0, offPeak: 0, ev: 0 } });

export const dollarsPerMonthTOU = (sched, rates, pump, season) => scheduleTOU(sched, rates, pump, season).cost * 30;

// Period → display style for the timeline lane / legends.
export const PERIOD_STYLE = {
  peak: { fill: "#E3A99A", ink: "#7E2A18", label: "peak" },
  midPeak: { fill: "#EAD3A6", ink: "#7A5A1E", label: "mid" },
  offPeak: { fill: "#CFE4D5", ink: "#2E5A3B", label: "off" },
  ev: { fill: "#A9D5C7", ink: "#1E5647", label: "EV" },
};
