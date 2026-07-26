import React, { useState } from "react";
import { C, mono, cond, Card, Badge, NumField, TimeField } from "../ui.jsx";
import { fmtWindow, toRealBand, spans, toMinutes } from "../schedule.js";
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
        <div style={{ font: mono(10.5), marginBottom: 8, lineHeight: 1.5 }}>
          <a href="reference/IntelliFlo-VS-SVRS-Owners-Manual.pdf" target="_blank" rel="noopener" style={{ color: C.flow, fontWeight: 600 }}>↗ IntelliFlo VS+SVRS owner's manual (PDF)</a>
          <span style={{ color: C.faint }}> — the emulator's menu tree is built from it.</span>
        </div>
        <Proc title="1 · INSPECT (read-only, safe)" body={[
          "Menu opens the config menu — a running SCHEDULE keeps running while you browse (observed on the pad: viewing never interrupts the program).",
          "Select (✗) drills in. Inside a speed it pages the parameter screens — Mode, then the RPM (shown as \"Set Reference\"), then the schedule times / egg time. Up/Down scroll; Escape (←) backs up.",
          "Enter only SAVES — never needed for viewing; pressing it where nothing can be saved gives a harmless \"Key Error! Key not in use!\".",
          "Photograph every settings screen — the photos ARE the verification stamp.",
        ]} />
        <Proc title="2 · CONTROL (daily operation, no settings touched)" body={[
          "Manual run: press a Speed button, then Start (Speed 3 self-stops via its 3:10 egg timer).",
          "Stop halts any run. Time Out = temporary pause with auto-resume. Quick Clean = temporary high-speed run (the pool guy's button).",
          "After ANY interaction, confirm the display shows \"Running Schedule\" or \"Running Speed N\" before walking away.",
        ]} />
        <Proc title="3 · UPDATE (settings changes)" warn body={[
          "Menu → navigate to a value → adjust it in place (▲▼ change the digit, ◀▶ move the cursor) → Enter to SAVE. Unlike viewing, EDITING stops the schedule.",
          "⚠ CRITICAL: after editing, press Start/Stop to RE-ARM the schedule. A pump left stopped after an edit runs NOTHING — no filtration, no freeze protection — until someone notices.",
          "Same session: update the table above to match, photograph the new screens, add a History entry (date/what/why/who). Clock changes only together with schedule promotion (R5).",
        ]} />
        <Proc title="4 · SET TIME (fix the clock — R5)" warn body={[
          "The pump clock is ~10 h behind, so the schedule runs at the wrong real time. Fixing it shifts the current schedule — do it TOGETHER with programming the new TOU schedule (R5), never alone.",
          "Menu → Select (opens Settings) → ▼ to 'Set Time' → Select (cursor lands in the time field) → ▲▼ change the digit, ◀▶ move the cursor → Enter to save. Set 'Set AM/PM' too if it's wrong.",
          "Editing STOPS the pump → press Start/Stop to RE-ARM. Then zero the clock offsets on Commissioning (test 17 / R5) so every timeline reads real time and the banner clears.",
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
// from the owner's manual (linked above); Speed 1–8 is populated from this pump's
// real register, the other branches show the manual's factory defaults (the real
// pad's values differ — verify on inspection). The point is to rehearse the
// re-arm habit (the mistake that actually costs) before touching the real pad.

function Emulator({ config }) {
  const slots = config.pump.slots || [];
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
    // Menu opens the config menu but does NOT interrupt a running SCHEDULE
    // (observed on the real pad — the schedule keeps running while you browse).
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
        else { n.editing = true; n.running = false; n.label = "— STOPPED —"; } // editing a value stops the schedule → must re-arm
      });
    }
    if (k === "escape") {
      return upd((n) => {
        if (n.editing) { n.editing = false; return; }
        if (n.stack.length) { n.stack = n.stack.slice(0, -1); if (!n.stack.length) { n.running = false; n.label = "— STOPPED —"; } }
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
  // The schedule keeps running while you browse the menu, so "armed" tracks the
  // schedule, not the view. Only an EDIT (which stops the pump) disarms it.
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
    settime: { label: "Set the clock (R5 rehearsal)", ok: (s) => s.savedItem === "Set Time" && s.running && !s.stack.length && s.label === "Running Schedule", hint: "Menu → Select (Settings) → ▼ to 'Set Time' → Select to edit → ▲▼ / ◀▶ set the time → Enter to save → Escape out → Start/Stop to re-arm." },
    edit: { label: "Change a setting, then re-arm (R5 habit)", ok: (s) => s.saved && s.running && !s.stack.length && s.label === "Running Schedule", hint: "Menu → drill to a value → Select to edit (this STOPS the schedule) → Enter to save → Escape out → Start/Stop to re-arm. The re-arm is the graded step." },
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
                <div style={{ font: mono(11), color: "#F3B04B" }}>press Start/Stop to re-arm</div>
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
            {armed ? "Armed: schedule is running." : "⚠ Not armed — the pump is stopped or mid-menu. On the real pad this means no filtration until re-armed (Start/Stop)."}
          </div>
          <div style={{ marginTop: 10, font: mono(10), color: C.faint, lineHeight: 1.5 }}>
            Menu tree from the owner's manual (linked above). Speed 1–8 shows this pump's real register; other branches show the manual's factory defaults — the real pad's values differ, so verify on inspection. Firmware may vary; when the real pump diverges, photograph it.
          </div>
        </div>
      </div>
    </Card>
  );
}
