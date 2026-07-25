// Time-of-use cost model (PG&E E-TOU-C assumption: peak 4–9 PM daily, off-peak
// otherwise). Each speed band runs at a constant RPM, so its energy is constant
// power × time — split that time across the peak window to get peak vs off-peak
// kWh, then price each. This is what makes the schedule redesign's off-peak
// shift show up as dollars, not just kWh.

import { toMinutes, spans } from "./schedule.js";
import { bandKWh } from "./energy.js";

/** Minutes of a band that fall inside the daily peak window. */
export function peakMinutes(band, rates) {
  const pS = toMinutes(rates.peakStart), pE = toMinutes(rates.peakEnd);
  let m = 0;
  for (const [a, b] of spans(band)) m += Math.max(0, Math.min(b, pE) - Math.max(a, pS));
  return m;
}

/** { kwh, peakKWh, offKWh, cost } for one band. */
export function bandTOU(band, rates) {
  const kwh = bandKWh(band);
  const total = spans(band).reduce((t, [a, b]) => t + (b - a), 0) || 1;
  const peakFrac = peakMinutes(band, rates) / total;
  const peakKWh = kwh * peakFrac, offKWh = kwh * (1 - peakFrac);
  return { kwh, peakKWh, offKWh, cost: peakKWh * rates.peak + offKWh * rates.offPeak };
}

/** Same totals summed across a whole schedule. */
export const scheduleTOU = (sched, rates) =>
  sched.reduce((a, b) => {
    const t = bandTOU(b, rates);
    return { kwh: a.kwh + t.kwh, peakKWh: a.peakKWh + t.peakKWh, offKWh: a.offKWh + t.offKWh, cost: a.cost + t.cost };
  }, { kwh: 0, peakKWh: 0, offKWh: 0, cost: 0 });

export const dollarsPerMonthTOU = (sched, rates) => scheduleTOU(sched, rates).cost * 30;

/** $/kWh in effect at a given minute — drives the TOU lane on the timeline. */
export const rateAtMinute = (min, rates) => {
  const pS = toMinutes(rates.peakStart), pE = toMinutes(rates.peakEnd);
  return min >= pS && min < pE ? rates.peak : rates.offPeak;
};
