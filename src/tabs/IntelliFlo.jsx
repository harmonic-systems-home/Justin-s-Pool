import React, { useState } from "react";
import { C, mono, cond, Card, Badge, NumField, TimeField } from "../ui.jsx";
import { fmtWindow, toRealBand } from "../schedule.js";
import { wattsAt } from "../energy.js";

// The pump's complete configuration register — the mirror of the device, every
// slot (not just the scheduled ones that drive the timeline). Plus the operating
// procedures and a practice emulator to rehearse them before the real pad.

const MODES = ["Schedule", "Egg timer", "Manual", "Disabled"];
const today = () => new Date().toISOString().slice(0, 10);

export default function IntelliFlo({ config, update }) {
  const clkOff = config.clocks?.intelliflo?.offsetMin || 0;
  const slots = config.pump.slots || [];
  const setSlot = (i, patch) => update((d) => { d.pump.slots[i] = { ...d.pump.slots[i], ...patch, prov: { status: "measured", date: today(), note: "edited to match device" } }; });

  const cell = { padding: "4px 8px", verticalAlign: "middle", whiteSpace: "nowrap" };
  const inp = { font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 6, color: C.ink, background: "#fff" };

  return (
    <div>
      <Card title="Speed register — all 8 slots" right={
        <span style={{ font: mono(10), color: C.faint }}>
          verified vs device {config.pump.slotsVerified || "—"}
          <button onClick={() => update((d) => { d.pump.slotsVerified = today(); })}
            style={{ marginLeft: 8, font: mono(10, 600), padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint, cursor: "pointer" }}>mark verified today</button>
        </span>
      }>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", font: mono(11.5), color: C.ink }}>
            <thead>
              <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}`, textAlign: "left" }}>
                <th style={cell}>#</th><th style={cell}>Mode</th><th style={cell}>RPM</th>
                <th style={cell}>Start–Stop / duration (pump clock)</th>
                {clkOff !== 0 && <th style={cell}>Runs (real)</th>}
                <th style={cell}>Watts</th><th style={cell}>Verified</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => {
                const disabled = s.mode === "Disabled";
                const sched = s.mode === "Schedule";
                const egg = s.mode === "Egg timer";
                const watts = disabled ? null : wattsAt(s.rpm, config.pump);
                const measuredW = config.pump.wattsByRpm?.[s.rpm] != null;
                return (
                  <tr key={s.slot} style={{ borderBottom: `1px solid ${C.pad}`, opacity: disabled ? 0.55 : 1 }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{s.slot}</td>
                    <td style={cell}>
                      <select value={s.mode} onChange={(e) => setSlot(i, { mode: e.target.value })} style={inp}>
                        {MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </td>
                    <td style={cell}>{disabled ? "—" : <NumField value={s.rpm ?? 0} step="50" min="0" width={66} onChange={(v) => setSlot(i, { rpm: v || 0 })} />}</td>
                    <td style={cell}>
                      {sched ? (
                        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                          <TimeField value={s.start || ""} onChange={(v) => setSlot(i, { start: v })} /><span style={{ color: C.faint }}>→</span>
                          <TimeField value={s.end || ""} onChange={(v) => setSlot(i, { end: v })} />
                        </span>
                      ) : egg ? (
                        <span><NumField value={s.durationMin ?? 0} step="5" width={64} onChange={(v) => setSlot(i, { durationMin: v || 0 })} /> min</span>
                      ) : disabled ? "—" : <span style={{ color: C.faint }}>on-demand button</span>}
                    </td>
                    {clkOff !== 0 && <td style={{ ...cell, color: sched ? C.warn : C.faint }}>{sched ? fmtWindow(toRealBand({ start: s.start, end: s.end }, clkOff)) : "—"}</td>}
                    <td style={cell}>{watts == null ? "—" : <span title={measuredW ? "measured" : "affinity-law estimate"}>{Math.round(watts)} W{measuredW ? "" : " ~"}</span>}</td>
                    <td style={cell}>{s.prov && <Badge prov={s.prov} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          This table is the device mirror — <b>editing here means "the pump was changed, update the record"</b> (record-follows-device), the complement of What-If's plan-then-promote. Scheduled slots (1, 2, 5) also drive the Daily timeline &amp; Costs via the Active schedule. Watts marked <b>~</b> are affinity-law estimates; the rest are measured. {clkOff ? "\"Runs (real)\" applies the IntelliFlo clock offset." : ""}
        </div>
      </Card>

      <Card title="Operating procedures">
        <Proc title="1 · INSPECT (read-only, safe)" body={[
          "Menu opens the menu (pump must be stopped; pressing Menu stops it).",
          "Select (✗) drills into an item. Escape (←) backs up / cancels.",
          "Enter only SAVES — never needed for viewing; pressing it where nothing can be saved gives a harmless \"Key Error! Key not in use!\".",
          "Exit: press Start/Stop to leave the menu and re-arm (display returns to \"Running Schedule / Running Speed X\"). Photograph every settings screen — the photos ARE the verification stamp.",
        ]} />
        <Proc title="2 · CONTROL (daily operation, no settings touched)" body={[
          "Manual run: press a Speed button, then Start (Speed 3 self-stops via its 3:10 egg timer).",
          "Stop halts any run. Time Out = temporary pause with auto-resume. Quick Clean = temporary high-speed run (the pool guy's button).",
          "After ANY interaction, confirm the display shows \"Running Schedule\" or \"Running Speed N\" before walking away.",
        ]} />
        <Proc title="3 · UPDATE (settings changes)" warn body={[
          "Menu → navigate (per Inspect) → adjust values → Enter is the SAVE action (the one context where Enter is wanted) → Escape out.",
          "⚠ CRITICAL: press Start/Stop to exit the menu and RE-ARM the schedule. A pump left stopped in the menu after an edit runs NOTHING — no filtration, no freeze protection — until someone notices.",
          "Same session: update the table above to match, photograph the new screens, add a History entry (date/what/why/who). Clock changes only together with schedule promotion (R5).",
        ]} />
      </Card>

      <Emulator config={config} />
    </div>
  );
}

function Proc({ title, body, warn }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.pad}`, padding: "6px 0" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ font: mono(12, 700), color: warn ? C.warn : C.ink, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {open ? "▾" : "▸"} {title}
      </button>
      {open && <ol style={{ margin: "6px 0 4px", paddingLeft: 20, font: mono(11.5), color: C.ink, lineHeight: 1.55 }}>{body.map((b, i) => <li key={i}>{b}</li>)}</ol>}
    </div>
  );
}

// ── Practice emulator ───────────────────────────────────────────
// A compact simulation of the IntelliFlo keypad so the re-arm habit (the mistake
// that actually costs) can be rehearsed. Menu depth is a skeleton sourced from
// the captured nav notes; unphotographed branches mark themselves UNVERIFIED so
// the emulator is honest about its own fidelity (fill it in from inspection).

const MENU = ["Running Speeds", "External Control", "Priming", "Anti-Freeze", "Time / Clock"];

function Emulator({ config }) {
  const slots = config.pump.slots || [];
  const init = { running: true, label: "Running Schedule", view: "run", menuIdx: 0, speedIdx: 0, msg: "", visitedMenu: false, saved: false };
  const [st, setSt] = useState(init);
  const [drill, setDrill] = useState("free");
  const set = (p) => setSt((s) => ({ ...s, msg: "", ...p }));

  const press = (k) => {
    const s = st;
    if (k === "reset") return setSt(init);
    if (k === "menu") return set({ running: false, view: "menu", menuIdx: 0, visitedMenu: true, label: "" });
    if (k === "startstop") {
      if (s.running) return set({ running: false, view: "run", label: "— STOPPED —" });
      return set({ running: true, view: "run", label: "Running Schedule", saved: false });
    }
    if (k === "quick") return set({ running: true, view: "run", label: "Quick Clean (temp)" });
    if (k === "timeout") return set({ msg: "Time Out — paused, auto-resumes" });
    if (k.startsWith("speed")) {
      const n = +k.slice(5);
      return set({ running: true, view: "run", label: `Running Speed ${n}${n === 3 ? " · egg 3:10" : ""}` });
    }
    if (k === "up" || k === "down" || k === "left" || k === "right") {
      const d = (k === "up" || k === "left") ? -1 : 1;
      if (s.view === "menu") return set({ menuIdx: (s.menuIdx + d + MENU.length) % MENU.length });
      if (s.view === "speeds") return set({ speedIdx: (s.speedIdx + d + slots.length) % slots.length });
      return;
    }
    if (k === "select") {
      if (s.view === "menu") {
        if (MENU[s.menuIdx] === "Running Speeds") return set({ view: "speeds", speedIdx: 0 });
        return set({ msg: "UNVERIFIED — photograph this screen on the real pump" });
      }
      if (s.view === "speeds") return set({ view: "speed" });
      return set({ msg: "UNVERIFIED — photograph this screen" });
    }
    if (k === "escape") {
      if (s.view === "speed") return set({ view: "speeds" });
      if (s.view === "speeds") return set({ view: "menu" });
      if (s.view === "menu") return set({ msg: "(already at menu top — press Start/Stop to exit + re-arm)" });
      return;
    }
    if (k === "enter") {
      if (s.view === "speed") return set({ msg: "Saved.", saved: true });
      return set({ msg: "Key Error! Key not in use!" });
    }
  };

  // LCD content
  let l1 = "", l2 = "";
  if (st.view === "run") { l1 = st.running ? st.label : "— STOPPED —"; l2 = st.running ? "" : "press Start/Stop to re-arm"; }
  else if (st.view === "menu") { l1 = `MENU ▸ ${MENU[st.menuIdx]}`; l2 = "pump STOPPED"; }
  else if (st.view === "speeds") { l1 = `SPEEDS ▸ Speed ${slots[st.speedIdx]?.slot}`; l2 = "pump STOPPED"; }
  else if (st.view === "speed") { const sp = slots[st.speedIdx]; l1 = `Speed ${sp?.slot}: ${sp?.mode}`; l2 = sp?.mode === "Schedule" ? `${sp.rpm} ${sp.start}–${sp.end}` : sp?.mode === "Egg timer" ? `${sp.rpm} · ${sp.durationMin}m` : sp?.mode === "Manual" ? `${sp.rpm} RPM` : "off"; }
  if (st.msg) l2 = st.msg;
  const armed = st.running && st.label === "Running Schedule";

  const drills = {
    free: { label: "Free play", check: null },
    inspect: { label: "Inspect Speed 5, then leave it armed", ok: (s) => s.visitedMenu && s.running && s.label === "Running Schedule", hint: "Menu → Running Speeds → Speed 5 → Escape out → Start/Stop to re-arm." },
    heat: { label: "Start a Speed 3 heat run", ok: (s) => s.running && s.label.includes("Speed 3"), hint: "Press Speed 3, then Start." },
    edit: { label: "Change a setting, then re-arm (R5 habit)", ok: (s) => s.saved && s.running && s.label === "Running Schedule", hint: "Menu → drill in → Enter (save) → Escape → Start/Stop. The re-arm is the graded step." },
  };
  const d = drills[drill];
  const pass = d.ok ? d.ok(st) : null;

  // Panel primitives, matching the real IntelliFlo faceplate: rounded squares for
  // Speed / Select / Escape / Menu / Enter, circles for the bottom row.
  const Sq = ({ k, children, h = 40 }) => (
    <button onClick={() => press(k)} style={{
      font: mono(9.5, 600), height: h, borderRadius: 8, cursor: "pointer", lineHeight: 1.1,
      border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: "0 4px",
    }}>{children}</button>
  );
  const Arr = ({ k, children }) => (
    <button onClick={() => press(k)} style={{
      width: 36, height: 32, borderRadius: 7, cursor: "pointer", font: mono(12, 600),
      border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: 0,
    }}>{children}</button>
  );
  const Circ = ({ k, children, tone }) => (
    <button onClick={() => press(k)} style={{
      width: 60, height: 60, borderRadius: "50%", cursor: "pointer", font: mono(9.5, 600), lineHeight: 1.1,
      border: `1.5px solid ${tone || C.pipe}`, background: "#fff", color: tone || C.ink,
    }}>{children}</button>
  );
  const Led = ({ on }) => <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#4ADE9E" : "#cdd6d3", boxShadow: on ? "0 0 5px #4ADE9E" : "none", display: "inline-block" }} />;

  return (
    <Card title="Practice emulator" right={<span style={{ font: mono(9.5), color: C.faint }}>sandbox — never touches config</span>}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 320, maxWidth: "100%", background: "#EDEFEE", border: `1px solid ${C.pipe}`, borderRadius: 14, padding: 12 }}>
          {/* LCD */}
          <div style={{ background: "#0E2A22", border: `2px solid ${C.valve}`, borderRadius: 8, padding: "12px 14px", fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: st.running ? "#4ADE9E" : "#7a3", boxShadow: st.running ? "0 0 6px #4ADE9E" : "none", opacity: st.running ? 1 : 0.3 }} />
              <span style={{ font: mono(9, 600), color: "#6ea", letterSpacing: "0.08em" }}>{st.running ? "RUNNING" : "STOPPED"}</span>
            </div>
            <div style={{ font: mono(14, 600), color: "#B8F5D8", minHeight: 20 }}>{l1}</div>
            <div style={{ font: mono(11), color: st.view !== "run" || !st.running ? "#F3B04B" : "#7fcaa8", minHeight: 16 }}>{l2}&nbsp;</div>
          </div>

          {/* Speed row (rounded squares), each with an LED above */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, justifyItems: "center" }}>
            {[1, 2, 3, 4].map((n) => <Led key={n} on={st.running && st.label.includes(`Speed ${n}`)} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 3 }}>
            {[1, 2, 3, 4].map((n) => <Sq key={n} k={`speed${n}`} h={44}>Speed<br />{n}</Sq>)}
          </div>

          {/* Select (left) / Escape (right) */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ width: 66 }}><Sq k="select" h={44}>Select<br />✗</Sq></span>
            <span style={{ width: 66 }}><Sq k="escape" h={44}>Escape<br />←</Sq></span>
          </div>

          {/* status icons · D-pad cross with Enter centered · Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", font: mono(13) }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>✓ <Led on={st.running} /></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>! <Led on={false} /></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>🔔 <Led on={false} /></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 36px)", gridTemplateRows: "repeat(3, 32px)", gap: 5, justifyItems: "center", alignItems: "center" }}>
              <span /><Arr k="up">▲</Arr><span />
              <Arr k="left">◀</Arr><button onClick={() => press("enter")} style={{ width: 36, height: 32, borderRadius: 7, cursor: "pointer", font: mono(9, 600), border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: 0 }}>⏎</button><Arr k="right">▶</Arr>
              <span /><Arr k="down">▼</Arr><span />
            </div>
            <span style={{ width: 56 }}><Sq k="menu" h={50}>☰<br />Menu</Sq></span>
          </div>

          {/* bottom circles, each with an LED above */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
            {[st.running && st.label.includes("Quick"), false, st.running, false].map((on, i) => <Led key={i} on={on} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <Circ k="quick">Quick<br />Clean</Circ>
            <Circ k="timeout">Time<br />Out</Circ>
            <Circ k="startstop" tone={st.running ? C.warn : C.ok}>{st.running ? "Stop" : "Run"}</Circ>
            <Circ k="reset">Reset</Circ>
          </div>
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ font: mono(11, 600), color: C.faint, marginBottom: 4 }}>Drill</div>
          <select value={drill} onChange={(e) => setDrill(e.target.value)} style={{ font: mono(12), padding: "6px 8px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink, width: "100%", boxSizing: "border-box" }}>
            {Object.entries(drills).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {d.ok && (
            <div style={{ marginTop: 8, font: mono(11.5), lineHeight: 1.5 }}>
              <div style={{ color: C.faint }}>{d.hint}</div>
              <div style={{ marginTop: 6, font: mono(12, 700), color: pass ? C.ok : C.faint }}>{pass ? "✓ PASS — display reads Running Schedule" : "…not complete"}</div>
            </div>
          )}
          <div style={{ marginTop: 10, font: mono(10.5), color: armed ? C.ok : C.warn, lineHeight: 1.5 }}>
            {armed ? "Armed: schedule is running." : "⚠ Not armed — the pump is stopped or mid-menu. On the real pad this means no filtration until re-armed (Start/Stop)."}
          </div>
          <div style={{ marginTop: 10, font: mono(10), color: C.faint, lineHeight: 1.5 }}>
            Menu depth is a skeleton from the captured nav notes; branches marked <b>UNVERIFIED</b> need an inspection photo. Firmware may differ — when the real pump diverges, photograph it (that's a menu-tree bug report).
          </div>
        </div>
      </div>
    </Card>
  );
}
