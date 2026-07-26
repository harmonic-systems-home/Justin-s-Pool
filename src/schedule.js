// Schedule windows as structured times rather than the free-text strings the
// prototype carried ("after midnight (verify)"). A timeline can't draw prose,
// and the whole value of the timeline is making clock disagreements visible.
//
// Times are "HH:MM" 24-hour strings — what <input type="time"> emits natively,
// so no parsing layer is needed between the UI and this module.

export const DAY = 24 * 60;

/** "HH:MM" → minutes past midnight. Returns null on anything unparseable. */
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes past midnight → "12:30 AM", for display to a non-technical reader. */
export function fmt(mins) {
  const m = ((mins % DAY) + DAY) % DAY;
  const h24 = Math.floor(m / 60), min = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export const fmtWindow = (w) => {
  const s = toMinutes(w.start), e = toMinutes(w.end);
  if (s == null || e == null) return "—";
  return `${fmt(s)}–${fmt(e)}`;
};

/** Minutes past midnight → "HH:MM" 24-hour, wrapping into 0..1440. */
export const hhmm = (mins) => {
  const m = ((mins % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Shift a window/band from device-clock time to REAL time.
 *
 * offsetMin = clock − real (negative = the clock runs behind). A schedule fires
 * when its clock reads the programmed time, i.e. when real = programmed − offset.
 * Duration is preserved, so hours/RPM/etc. carry through unchanged.
 */
export const toRealBand = (band, offsetMin) => {
  const s = toMinutes(band.start), e = toMinutes(band.end);
  if (s == null || e == null || !offsetMin) return band;
  return { ...band, start: hhmm(s - offsetMin), end: hhmm(e - offsetMin) };
};
export const toRealBands = (bands, offsetMin) => (offsetMin ? bands.map((b) => toRealBand(b, offsetMin)) : bands);

/**
 * A window as one or two [start, end) spans in minutes.
 *
 * The overnight filter run is the normal case here, so windows that cross
 * midnight aren't an edge case to tolerate — they're the main one. Such a
 * window splits into two spans so callers can draw or test each on a plain
 * 0..1440 axis without special-casing the wrap.
 */
export function spans(w) {
  const s = toMinutes(w.start), e = toMinutes(w.end);
  if (s == null || e == null || s === e) return [];
  return e > s ? [[s, e]] : [[s, DAY], [0, e]];
}

export const duration = (w) => spans(w).reduce((t, [a, b]) => t + (b - a), 0);

/** Total minutes of `inner` not covered by any window in `outers`. */
export function uncoveredMinutes(inner, outers) {
  const covered = outers.flatMap(spans);
  let loose = 0;
  for (const [a, b] of spans(inner)) {
    // Walk the span minute-block by minute-block against the covered set.
    // Ranges here are tiny (a handful per day), so clarity beats cleverness.
    const marks = new Set();
    for (const [c, d] of covered) {
      for (let t = Math.max(a, c); t < Math.min(b, d); t++) marks.add(t);
    }
    loose += (b - a) - marks.size;
  }
  return loose;
}

export const isFullyCovered = (inner, outers) =>
  duration(inner) > 0 && uncoveredMinutes(inner, outers) === 0;
