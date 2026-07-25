// Shared visual language for the tabbed app: the field-instrument palette, the
// font import, and the handful of primitives every tab reuses (provenance
// badges, cards, section headers, small inputs). Keeping these in one place is
// what makes seven tabs read as one instrument.

export const C = {
  pad: "#EDF1F0", ink: "#17313C", faint: "#6C8089",
  pipe: "#C3CDD0", flow: "#1F8FD4", hot: "#D2372B",
  warn: "#C4452B", ok: "#2E8B57", valve: "#2A3B42", timer: "#8A6D1D",
  stall: "#E08A1E",
};

export const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap');
`;

export const mono = (size, weight = 500) => `${weight} ${size}px 'IBM Plex Mono', monospace`;
export const cond = (size, weight = 700) => `${weight} ${size}px 'Barlow Semi Condensed', sans-serif`;

// Provenance badge — the app's core discipline. Every derived number carries one
// so a reader can tell a measured fact from an affinity-law estimate from a
// still-unknown. Commissioning is what flips EST/PENDING → MEASURED.
export function Badge({ prov }) {
  const map = {
    measured: { bg: "#E4F1E9", bd: C.ok, fg: "#1F6B43", txt: "MEASURED" },
    est: { bg: "#FBF6E7", bd: C.timer, fg: C.timer, txt: "EST" },
    pending: { bg: "#FDECE7", bd: C.warn, fg: C.warn, txt: "PENDING" },
  };
  const m = map[prov?.status] ?? map.est;
  return (
    <span title={prov?.note || ""} style={{
      font: mono(9, 700), color: m.fg, background: m.bg, border: `1px solid ${m.bd}`,
      borderRadius: 5, padding: "1px 5px", letterSpacing: "0.03em", whiteSpace: "nowrap",
    }}>{m.txt}{prov?.date ? ` ${prov.date}` : ""}</span>
  );
}

export function Card({ title, right, children, pad = "12px 14px" }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 12, padding: pad, marginBottom: 10 }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          {title && <div style={{ font: cond(15) }}>{title}</div>}
          {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export const H = ({ children }) => (
  <div style={{ font: cond(14), color: C.ink, margin: "14px 0 6px" }}>{children}</div>
);

const fieldBase = {
  font: mono(12), padding: "6px 8px", border: `1.5px solid ${C.timer}`,
  borderRadius: 8, color: C.ink, background: "#fff",
};

export function NumField({ value, onChange, step = "1", min, suffix, width = 84 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <input type="number" step={step} min={min} value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : +e.target.value)}
        style={{ ...fieldBase, width }} />
      {suffix && <span style={{ font: mono(11), color: C.faint }}>{suffix}</span>}
    </span>
  );
}

export function TextField({ value, onChange, placeholder, area, minRows = 2 }) {
  const common = { ...fieldBase, width: "100%", boxSizing: "border-box" };
  return area ? (
    <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={{ ...common, minHeight: minRows * 22, resize: "vertical" }} />
  ) : (
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={common} />
  );
}

export function TimeField({ value, onChange }) {
  return <input type="time" value={value} onChange={(e) => onChange(e.target.value)} style={fieldBase} />;
}

export const money = (n, dp = 0) => `$${(n ?? 0).toFixed(dp)}`;

// A SENSITIVE value. When `authed` (the passphrase/PAT is present on this
// device) it's an editable field; otherwise it renders as a lock — the real
// protection is that the value only arrives via authenticated sync, so an
// unauthenticated device simply never has it.
export function Sensitive({ authed, value, onChange, placeholder, prefix }) {
  if (!authed) {
    return <span style={{ font: mono(11.5), color: C.faint }}>🔒 unlock in Cloud sync to view</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {prefix && <span style={{ font: mono(11.5), color: C.faint }}>{prefix}</span>}
      <input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        style={{ font: mono(12), padding: "6px 8px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink, background: "#fff", width: 140 }} />
    </span>
  );
}
