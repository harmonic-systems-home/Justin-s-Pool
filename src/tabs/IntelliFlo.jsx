import React, { useState } from "react";
import { C, mono, cond, Card, Badge, NumField, TimeField } from "../ui.jsx";
import { fmtWindow, toRealBand, spans, toMinutes } from "../schedule.js";
import { wattsAt } from "../energy.js";

// The pump's complete configuration register — the mirror of the device, every
// slot (not just the scheduled ones that drive the timeline). Plus the operating
// procedures and a practice emulator to rehearse them before the real pad.

const MODES = ["Schedule", "Egg timer", "Manual", "Disabled"];
const today = () => new Date().toISOString().slice(0, 10);

// The register is DERIVED from the single source of truth — no separate copy to
// drift. Scheduled speeds come straight from schedules.active (what Daily
// Operation & Costs show), the on-demand speeds from config.eggTimers. So
// promoting a new schedule updates this tab automatically.
function deriveSlots(config) {
  const sched = config.schedules?.active || [];
  const eggs = config.eggTimers || [];
  const heat = eggs.find((e) => e.hours);            // heat-pool egg timer (has a duration)
  const manual = eggs.find((e) => e.hours == null);  // manual utility button (no duration)
  const rows = [];
  sched.forEach((b) => rows.push({ slot: rows.length + 1, mode: "Schedule", rpm: b.rpm, start: b.start, end: b.end, label: b.label }));
  if (heat) rows.push({ slot: rows.length + 1, mode: "Egg timer", rpm: heat.rpm, durationMin: Math.round(heat.hours * 60), label: heat.label });
  if (manual) rows.push({ slot: rows.length + 1, mode: "Manual", rpm: manual.rpm, label: manual.label });
  while (rows.length < 8) rows.push({ slot: rows.length + 1, mode: "Disabled" });
  return rows;
}

export default function IntelliFlo({ config, update }) {
  const clkOff = config.clocks?.intelliflo?.offsetMin || 0;
  const slots = deriveSlots(config);

  const cell = { padding: "4px 8px", verticalAlign: "middle", whiteSpace: "nowrap" };
  const inp = { font: mono(11.5), padding: "5px 6px", border: `1.5px solid ${C.pipe}`, borderRadius: 6, color: C.ink, background: "#fff" };

  return (
    <div>
      <Card title="Speed register — the active schedule" right={
        <span style={{ font: mono(10), color: C.faint }}>derived from the schedule</span>
      }>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", font: mono(11.5), color: C.ink }}>
            <thead>
              <tr style={{ color: C.faint, borderBottom: `1px solid ${C.pipe}`, textAlign: "left" }}>
                <th style={cell}>#</th><th style={cell}>Mode</th><th style={cell}>RPM</th>
                <th style={cell}>Start–Stop / duration (pump clock)</th>
                {clkOff !== 0 && <th style={cell}>Runs (real)</th>}
                <th style={cell}>Watts</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => {
                const disabled = s.mode === "Disabled";
                const sched = s.mode === "Schedule";
                const egg = s.mode === "Egg timer";
                const watts = disabled ? null : wattsAt(s.rpm, config.pump);
                const measuredW = config.pump.wattsByRpm?.[s.rpm] != null;
                return (
                  <tr key={s.slot} style={{ borderBottom: `1px solid ${C.pad}`, opacity: disabled ? 0.55 : 1 }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{s.slot}</td>
                    <td style={cell}>{s.mode}{s.label ? <span style={{ color: C.faint }}> · {s.label}</span> : ""}</td>
                    <td style={cell}>{disabled ? "—" : `${s.rpm} RPM`}</td>
                    <td style={cell}>
                      {sched ? `${s.start}–${s.end}` : egg ? `${s.durationMin} min` : disabled ? "—" : <span style={{ color: C.faint }}>on-demand button</span>}
                    </td>
                    {clkOff !== 0 && <td style={{ ...cell, color: sched ? C.warn : C.faint }}>{sched ? fmtWindow(toRealBand({ start: s.start, end: s.end }, clkOff)) : "—"}</td>}
                    <td style={cell}>{watts == null ? "—" : <span title={measuredW ? "measured" : "affinity-law estimate"}>{Math.round(watts)} W{measuredW ? "" : " ~"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ font: mono(10.5), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          <b>Driven off the active schedule</b> — the same data Daily Operation &amp; Costs use — plus the on-demand speeds (heat run, manual). Promoting a schedule on <b>What-If</b> updates this automatically, so it can't drift. To change the schedule, edit it on <b>Daily Operation</b> or <b>What-If</b>. Watts marked <b>~</b> are affinity-law estimates; the rest are measured. {clkOff ? "\"Runs (real)\" applies the IntelliFlo clock offset." : ""}
        </div>
      </Card>

      <Card title="Operating procedures">
        <div style={{ font: mono(10.5), marginBottom: 8, lineHeight: 1.5 }}>
          <a href="reference/IntelliFlo-VS-SVRS-Owners-Manual.pdf" target="_blank" rel="noopener" style={{ color: C.flow, fontWeight: 600 }}>↗ IntelliFlo VS+SVRS owner's manual (PDF)</a>
          <span style={{ color: C.faint }}> — the emulator's menu tree is built from it.</span>
        </div>
        <Proc title="1 · INSPECT (read-only, safe)" body={[
          "Menu opens the config menu — the running program keeps running while you browse (observed on the pad: menu navigation never interrupts it).",
          "Select (✗) drills in. Inside a speed it pages the parameter screens — Mode, then the RPM (shown as \"Set Reference\"), then the schedule times / egg time. Up/Down scroll; Escape (←) backs up.",
          "Enter only SAVES — never needed for viewing; pressing it where nothing can be saved gives a harmless \"Key Error! Key not in use!\".",
          "Photograph every settings screen — the photos ARE the verification stamp.",
        ]} />
        <Proc title="2 · CONTROL (daily operation, no settings touched)" body={[
          "Manual run: press a Speed button, then Start (Speed 3 self-stops via its 3:10 egg timer).",
          "Stop halts any run — it's the ONLY thing that stops the pump. Time Out = temporary pause with auto-resume. Quick Clean = temporary high-speed run (the pool guy's button).",
          "If you ever press Stop, remember to press Start again — a stopped pump runs NOTHING (no filtration, no freeze protection) until someone notices.",
        ]} />
        <Proc title="3 · UPDATE (settings changes)" warn body={[
          "Menu → navigate to a value → adjust it in place (▲▼ change the digit, ◀▶ move the cursor) → Enter to SAVE → Escape out. Editing does NOT stop the pump — the program keeps running throughout.",
          "Escape only navigates; it never starts or stops the pump. So a settings change doesn't need a re-arm — just confirm the display returned to \"Running Schedule\".",
          "Same session: update the table above to match, photograph the new screens, add a History entry (date/what/why/who). Clock changes only together with schedule promotion (R5).",
        ]} />
        <Proc title="4 · SET TIME (fix the clock — R5)" warn body={[
          "The pump clock is ~10 h behind, so the schedule runs at the wrong real time. Fixing it shifts the current schedule — do it TOGETHER with programming the new TOU schedule (R5), never alone.",
          "Menu → Select (opens Settings) → ▼ to 'Set Time' → Select (cursor lands in the time field) → ▲▼ change the digit, ◀▶ move the cursor → Enter to save → Escape out. Set 'Set AM/PM' too if it's wrong. The pump keeps running the whole time.",
          "Then zero the clock offsets on Commissioning (test 17 / R5) so every timeline reads real time and the banner clears.",
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
// A faithful IntelliFlo VS+SVRS keypad simulation. The menu tree below is taken
// from the owner's manual (linked above); Speed 1–8 is populated from the active
// schedule (same source as the register above), the other branches show the manual's factory defaults (the real
// pad's values differ — verify on inspection). Field-observed on this pump: menu
// navigation — browsing AND editing — does NOT interrupt the running program;
// only an explicit Stop stops it, and Escape never starts or stops it.

function Emulator({ config }) {
  const slots = deriveSlots(config);
  const slotByNum = (n) => slots.find((s) => s.slot === n);
  const modeWord = (s) => (s.mode === "Egg timer" ? "Egg Timer" : s.mode);
  // Each speed pages through its parameter screens (as observed on the real pad:
  // Mode, then the RPM shown as "Set Reference", then schedule times / egg time).
  const speedParams = (s) => {
    const rows = [{ label: "Mode", big: modeWord(s) }];
    if (s.mode === "Manual") rows.push({ label: "Set Reference", big: `${s.rpm} RPM` });
    else if (s.mode === "Egg timer") rows.push({ label: "Set Speed", big: `${s.rpm} RPM` }, { label: "Time", big: `${s.durationMin} min` });
    else if (s.mode === "Schedule") rows.push({ label: "Set Speed", big: `${s.rpm} RPM` }, { label: "Set Start", big: s.start }, { label: "Set Stop", big: s.end });
    return rows.map((r) => ({ name: r.label, kind: "speedParam", speedNum: s.slot, big: r.big }));
  };
  const speedChildren = slots.map((s) => ({
    name: `Speed ${s.slot}`, kind: "speed", modeWord: modeWord(s),
    value: s.mode === "Disabled" ? "Disabled" : s.mode === "Egg timer" ? `${s.rpm} · ${s.durationMin}m` : s.mode === "Manual" ? `${s.rpm} RPM` : `${s.rpm}  ${s.start}–${s.end}`,
    children: speedParams(s),
  }));
  const TREE = [
    { name: "Settings", children: [
      { name: "Pump Address", value: "1" }, { name: "Set Time", value: "12:00 AM" },
      { name: "Set AM/PM", value: "AM/PM" }, { name: "Temperature Unit", value: "°F" },
      { name: "Screen Contrast", value: "3" }, { name: "Language", value: "English" },
      { name: "Set Min Speed", value: "1100 RPM" }, { name: "Set Max Speed", value: "3450 RPM" },
      { name: "Password", value: "Disabled" },
    ] },
    { name: "Speed 1-8", children: speedChildren },
    { name: "Ext Control", children: [
      { name: "Program 1", value: "1100 RPM" }, { name: "Program 2", value: "1500 RPM" },
      { name: "Program 3", value: "2350 RPM" }, { name: "Program 4", value: "3110 RPM" },
    ] },
    { name: "Features", children: [
      { name: "Time Out", value: "3 hours" }, { name: "Quick Clean", value: "3450 RPM · 10 min" },
    ] },
    { name: "Priming", children: [
      { name: "Priming", value: "Enabled" }, { name: "Max Priming Time", value: "11 min" },
      { name: "Primed Sensitivity", value: "1%" }, { name: "Priming Delay", value: "20 sec" },
    ] },
    { name: "Anti Freeze", children: [
      { name: "Anti Freeze", value: "Enabled" }, { name: "Set Speed", value: "1100 RPM" },
      { name: "Pump Temperature", value: "40°F" },
    ] },
  ];

  const init = { running: true, label: "Running Schedule", stack: [], editing: false, saved: false, savedItem: "", visitedMenu: false, sawSpeedParam: false, msg: "" };
  const [st, setSt] = useState(init);
  const [drill, setDrill] = useState("free");
  const upd = (fn) => setSt((s) => { const n = { ...s, msg: "" }; fn(n); return n; });

  const press = (k) => {
    if (k === "reset") return setSt(init);
    // Menu does NOT stop the pump — you can browse while it runs (the green ✓ is a
    // power LED, not "running"). What stops it is EDITING a value (below); and
    // Escape only navigates — it never starts or stops the pump. Only Start/Stop
    // re-arms. So a pure look-around leaves it running; once you edit, it stays
    // stopped until Start/Stop. (Rick, this pump.)
    if (k === "menu") return upd((n) => { n.stack = [{ items: TREE, idx: 0 }]; n.editing = false; n.visitedMenu = true; });
    if (k === "startstop") return upd((n) => { if (n.running) { n.running = false; n.stack = []; n.editing = false; n.label = "— STOPPED —"; } else { n.running = true; n.stack = []; n.editing = false; n.label = "Running Schedule"; n.saved = false; } });
    if (k === "quick") return upd((n) => { n.running = true; n.stack = []; n.editing = false; n.label = "Quick Clean"; });
    if (k === "timeout") return upd((n) => { n.msg = "Time Out — paused, auto-resumes"; });
    if (k.startsWith("speed")) { const num = +k.slice(5); return upd((n) => { n.running = true; n.stack = []; n.editing = false; n.label = `Running Speed ${num}${num === 3 ? " · egg 3:10" : ""}`; }); }
    if (k === "up" || k === "down" || k === "left" || k === "right") {
      return upd((n) => {
        if (n.editing) { n.msg = "(▲▼ change digit · ◀▶ move cursor)"; return; }
        if (!n.stack.length) return;
        const lvl = n.stack[n.stack.length - 1]; const d = (k === "up" || k === "left") ? -1 : 1;
        n.stack = n.stack.slice(0, -1).concat({ ...lvl, idx: (lvl.idx + d + lvl.items.length) % lvl.items.length });
      });
    }
    if (k === "select") {
      return upd((n) => {
        if (!n.stack.length) return; const lvl = n.stack[n.stack.length - 1]; const c = lvl.items[lvl.idx];
        if (n.editing) return;
        if (c.children) { n.stack = n.stack.concat({ items: c.children, idx: 0 }); if (c.kind === "speed") n.sawSpeedParam = true; }
        else { n.editing = true; } // enter edit-in-place — the running program keeps running
      });
    }
    if (k === "escape") {
      // Escape only navigates — it never starts or stops the pump. Exiting the
      // menu returns to the run screen with the program still running (or still
      // stopped, if you had explicitly pressed Stop).
      return upd((n) => {
        if (n.editing) { n.editing = false; return; }
        if (n.stack.length) n.stack = n.stack.slice(0, -1);
      });
    }
    if (k === "enter") return upd((n) => { if (n.editing) { const lv = n.stack[n.stack.length - 1]; n.saved = true; n.savedItem = lv?.items[lv.idx]?.name || ""; n.editing = false; n.msg = "Saved."; } else n.msg = "Key Error! Key not in use!"; });
  };

  // pump-clock time (the pad clock is offset from real)
  const off = config.clocks?.intelliflo?.offsetMin || 0;
  const _now = new Date();
  const pcMin = (((_now.getHours() * 60 + _now.getMinutes()) + off) % 1440 + 1440) % 1440;
  const pcH = Math.floor(pcMin / 60), pcTime = `${(pcH % 12) || 12}:${String(pcMin % 60).padStart(2, "0")}${pcH < 12 ? "a" : "p"}`;
  const activeSched = () => slots.find((x) => x.mode === "Schedule" && spans({ start: x.start, end: x.end }).some(([a, b]) => pcMin >= a && pcMin < b))?.slot;

  const inMenu = st.stack.length > 0;
  // Menu use never stops the pump, so "armed" tracks the schedule, not the view —
  // it stays armed while you browse or edit. Only an explicit Stop disarms it.
  const armed = st.running && st.label === "Running Schedule";

  // Running-screen fields (manual layout: SVRS/time · RPM · countdown/Watts · feature)
  let rRpm = 0, rFeat = "";
  if (st.running && !inMenu) {
    const m = /Speed (\d)/.exec(st.label);
    if (m) { const n = +m[1]; rRpm = slotByNum(n)?.rpm || 0; rFeat = `Running Speed ${n}`; }
    else if (st.label.includes("Quick")) { rRpm = 3450; rFeat = "Quick Clean"; }
    else { const n = activeSched(); rRpm = slotByNum(n)?.rpm || (slots[0]?.rpm || 0); rFeat = n ? `Running Speed ${n}` : "Running Schedule"; }
  }
  const rWatts = rRpm ? Math.round(wattsAt(rRpm, config.pump)) : 0;

  // Menu-screen fields
  const lvl = inMenu ? st.stack[st.stack.length - 1] : null;
  const cur = lvl ? lvl.items[lvl.idx] : null;
  const crumb = st.stack.length > 1 ? st.stack[st.stack.length - 2].items[st.stack[st.stack.length - 2].idx].name : "MENU";

  const drills = {
    free: { label: "Free play" },
    inspect: { label: "Read a speed's Mode + RPM (no changes)", ok: (s) => s.sawSpeedParam && s.running && s.label === "Running Schedule", hint: "Menu → ▼ to 'Speed 1-8' → Select → pick a speed → Select → ▼ pages Mode / Set Reference (RPM). Viewing NEVER stops the schedule — that's the point." },
    heat: { label: "Start a Speed 3 heat run", ok: (s) => s.running && s.label.includes("Speed 3"), hint: "Press the Speed 3 button (it ramps up)." },
    settime: { label: "Set the clock (R5 rehearsal)", ok: (s) => s.savedItem === "Set Time" && s.running && !s.stack.length && s.label === "Running Schedule", hint: "Menu → Select (Settings) → ▼ to 'Set Time' → Select to edit → ▲▼ / ◀▶ set the time → Enter to save → Escape out. The program keeps running the whole time." },
    edit: { label: "Change a setting and save it", ok: (s) => s.saved && s.running && !s.stack.length && s.label === "Running Schedule", hint: "Menu → drill to a value → Select to edit → ▲▼ / ◀▶ adjust → Enter to save → Escape out. Editing does NOT stop the pump — the schedule runs throughout." },
  };
  const dr = drills[drill];
  const pass = dr.ok ? dr.ok(st) : null;

  const Sq = ({ k, children, h = 40 }) => (
    <button onClick={() => press(k)} style={{ font: mono(9.5, 600), height: h, borderRadius: 8, cursor: "pointer", lineHeight: 1.1, border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: "0 4px" }}>{children}</button>
  );
  const Arr = ({ k, children }) => (
    <button onClick={() => press(k)} style={{ width: 36, height: 32, borderRadius: 7, cursor: "pointer", font: mono(12, 600), border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: 0 }}>{children}</button>
  );
  const Circ = ({ k, children, tone }) => (
    <button onClick={() => press(k)} style={{ width: 60, height: 60, borderRadius: "50%", cursor: "pointer", font: mono(9.5, 600), lineHeight: 1.1, border: `1.5px solid ${tone || C.pipe}`, background: "#fff", color: tone || C.ink }}>{children}</button>
  );
  const Led = ({ on }) => <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#4ADE9E" : "#cdd6d3", boxShadow: on ? "0 0 5px #4ADE9E" : "none", display: "inline-block" }} />;

  return (
    <Card title="Practice emulator" right={<span style={{ font: mono(9.5), color: C.faint }}>sandbox — never touches config</span>}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 320, maxWidth: "100%", background: "#EDEFEE", border: `1px solid ${C.pipe}`, borderRadius: 14, padding: 12 }}>
          {/* LCD */}
          <div style={{ background: "#0E2A22", border: `2px solid ${C.valve}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'IBM Plex Mono', monospace", minHeight: 92 }}>
            {st.running && !inMenu ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", font: mono(11, 600), color: "#7fcaa8" }}><span>SVRS</span><span>{pcTime}</span></div>
                <div style={{ font: mono(24, 600), color: "#B8F5D8", lineHeight: 1.15, margin: "2px 0" }}>{rRpm} RPM</div>
                <div style={{ display: "flex", justifyContent: "space-between", font: mono(10), color: "#7fcaa8" }}><span>T 0.00</span><span>{rWatts} WATTS</span></div>
                <div style={{ font: mono(11, 600), color: "#B8F5D8" }}>{rFeat}</div>
              </>
            ) : inMenu ? (
              cur?.kind === "speed" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", font: mono(11, 600), color: "#7fcaa8" }}><span>{cur.name}</span><span>{pcTime}</span></div>
                  <div style={{ font: mono(24, 600), color: "#B8F5D8", lineHeight: 1.15, margin: "2px 0" }}>{cur.modeWord}</div>
                  <div style={{ font: mono(10), color: "#7fcaa8" }}>Mode · {cur.value} · Select ✗ to page</div>
                </>
              ) : cur?.kind === "speedParam" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", font: mono(11, 600), color: "#7fcaa8" }}><span>Speed {cur.speedNum}{st.editing ? "  [EDIT]" : ""}</span><span>{pcTime}</span></div>
                  <div style={{ font: mono(24, 600), color: "#B8F5D8", lineHeight: 1.15, margin: "2px 0" }}>{cur.big}</div>
                  <div style={{ font: mono(10), color: st.editing ? "#F3B04B" : "#7fcaa8" }}>{cur.name}{st.editing ? " ▸ ▲▼ change · Enter save" : ""}{st.msg ? `  ${st.msg}` : ""}</div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", font: mono(10, 600), color: "#7fcaa8" }}><span>{crumb}{st.editing ? "  [EDIT]" : ""}</span><span>{pcTime}</span></div>
                  <div style={{ font: mono(16, 600), color: "#B8F5D8", lineHeight: 1.2, margin: "3px 0" }}>{cur?.name}</div>
                  <div style={{ font: mono(11), color: st.editing ? "#F3B04B" : "#7fcaa8" }}>{cur?.value != null ? `${st.editing ? "▸ " : "= "}${cur.value}` : cur?.children ? "Select ✗ to open ▸" : ""}{st.msg ? `   ${st.msg}` : ""}</div>
                </>
              )
            ) : (
              <>
                <div style={{ font: mono(9, 600), color: "#F3B04B", letterSpacing: "0.08em", marginBottom: 6 }}>PUMP STOPPED</div>
                <div style={{ font: mono(20, 600), color: "#B8F5D8" }}>— STOPPED —</div>
                <div style={{ font: mono(11), color: "#F3B04B" }}>press Start/Stop to run</div>
              </>
            )}
          </div>

          {/* Speed row + LEDs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, justifyItems: "center" }}>
            {[1, 2, 3, 4].map((n) => <Led key={n} on={st.running && !inMenu && st.label.includes(`Speed ${n}`)} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 3 }}>
            {[1, 2, 3, 4].map((n) => <Sq key={n} k={`speed${n}`} h={44}>Speed<br />{n}</Sq>)}
          </div>

          {/* Select / Escape */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ width: 66 }}><Sq k="select" h={44}>Select<br />✗</Sq></span>
            <span style={{ width: 66 }}><Sq k="escape" h={44}>Escape<br />←</Sq></span>
          </div>

          {/* status LEDs · D-pad cross (Enter centered) · Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", font: mono(13) }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>✓ <Led on={st.running} /></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>! <Led on={false} /></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>🔔 <Led on={false} /></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 36px)", gridTemplateRows: "repeat(3, 32px)", gap: 5, justifyItems: "center", alignItems: "center" }}>
              <span /><Arr k="up">▲</Arr><span />
              <Arr k="left">◀</Arr><button onClick={() => press("enter")} title="Enter" style={{ width: 36, height: 32, borderRadius: 7, cursor: "pointer", font: mono(17, 600), border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.ink, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>⏎</button><Arr k="right">▶</Arr>
              <span /><Arr k="down">▼</Arr><span />
            </div>
            <span style={{ width: 56 }}><Sq k="menu" h={50}>☰<br />Menu</Sq></span>
          </div>

          {/* bottom circles + LEDs */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
            {[st.running && !inMenu && st.label.includes("Quick"), false, st.running, false].map((on, i) => <Led key={i} on={on} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <Circ k="quick">Quick<br />Clean</Circ>
            <Circ k="timeout">Time<br />Out</Circ>
            <Circ k="startstop" tone={st.running ? C.warn : C.ok}>
              <span style={{ display: "block", color: C.ok, font: mono(9, st.running ? 500 : 700) }}>Start</span>
              <span style={{ display: "block", color: C.warn, font: mono(12, st.running ? 700 : 500) }}>Stop</span>
            </Circ>
            <Circ k="reset">Reset</Circ>
          </div>
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ font: mono(11, 600), color: C.faint, marginBottom: 4 }}>Drill</div>
          <select value={drill} onChange={(e) => setDrill(e.target.value)} style={{ font: mono(12), padding: "6px 8px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink, width: "100%", boxSizing: "border-box" }}>
            {Object.entries(drills).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {dr.ok && (
            <div style={{ marginTop: 8, font: mono(11.5), lineHeight: 1.5 }}>
              <div style={{ color: C.faint }}>{dr.hint}</div>
              <div style={{ marginTop: 6, font: mono(12, 700), color: pass ? C.ok : C.faint }}>{pass ? "✓ PASS — display reads Running Schedule" : "…not complete"}</div>
            </div>
          )}
          <div style={{ marginTop: 10, font: mono(10.5), color: armed ? C.ok : C.warn, lineHeight: 1.5 }}>
            {armed ? "Armed: schedule is running (menu use doesn't stop it)." : "⚠ Pump stopped — press Start/Stop to run. Only an explicit Stop halts the pump; menu navigation and edits never do."}
          </div>
          <div style={{ marginTop: 10, font: mono(10), color: C.faint, lineHeight: 1.5 }}>
            Menu tree from the owner's manual (linked above). Speed 1–8 shows this pump's real register; other branches show the manual's factory defaults — the real pad's values differ, so verify on inspection. Firmware may vary; when the real pump diverges, photograph it.
          </div>
        </div>
      </div>
    </Card>
  );
}
