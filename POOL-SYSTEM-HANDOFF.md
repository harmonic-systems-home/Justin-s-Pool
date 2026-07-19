# Justin's Pool — System Documentation & App Handoff

**Location:** Fair Oaks, CA (Sacramento area; SMUD electric, PG&E gas)
**Surveyed:** July 17–18, 2026, by Rick (site photos + owner interview with Justin)
**Deliverable so far:** `pool-flow-v3.jsx` — single-file React artifact, interactive system map / simulator / operating manual
**This doc:** everything learned, everything still unknown, and the app description for the next dev iteration.

---

## 1. Equipment inventory (verified from photos)

| Item | Model / notes |
|---|---|
| Main pump | Pentair **IntelliFlo variable-speed**. Local control panel ("white box"): Speed 1–4 buttons, Start/Stop, Time Out, Quick Clean. Has **internal schedule** ("Running Schedule" on LCD). Speed 3 ≈ 3500 RPM used for heating runs. |
| Filter | Waterway **Crystal Water** cartridge filter. Currently dirty → primary system complaint. Pressure gauge on top. |
| Heater | Hayward **H-Series** gas. Front panel: MODE cycles STANDBY → SPA → POOL, separate setpoints. No internal clock — fires whenever mode ≠ standby AND flow present. BTU rating **unread** (need photo of rating plate). |
| Booster pump | Polaris **PB4-60** ¾ HP — drives pressure-side hose cleaner. Seasonal use ("dirty season" when trees drop debris). |
| Cleaners | Polaris hose cleaner (seasonal, booster-driven), robot underwater cleaner, robot surface skimmer (both independent of pad). |
| Automation (legacy) | Pentair **SunTouch** pool/spa controller. Powered but effectively abandoned: clock 10 h wrong, shows **"AIR Error"** (failed/disconnected air temp sensor). Wiring label shows hookups for intake/return valve actuators, heater fireman's switch, IntelliFlo com, booster relay. |
| Timers | Two **Intermatic T104-style** mechanical timers in a "Timing Control Center" box. Right timer: clock correct — believed to run the **Polaris booster** (window ≈ noon–2 PM). Left timer: clock was **12 h off** (set to 12 midnight at 12:30 PM) — load uncertain, possibly feeds SunTouch and/or lights. |
| Lights | Three deck junction boxes on conduit risers near pad = underwater/feature light circuits. One fixture identified: Intermatic **CL115** 12 V 20 W submersible (waterfall light, dated 4/2002). |
| Solar (defunct) | Roof solar loop decommissioned; panels appear to be the black mats rolled up beside the pad. SunTouch was likely installed for solar control originally. |
| Misc | Galvanized riser w/ red-handled valve behind heater = believed **gas shutoff**. White flex hoses at pad = cleaner/aux lines. |

## 2. Hydraulic topology (verified w/ owner + annotated photo)

Series loop, one circulation pump:

```
POOL (skimmer+drain) ─┐
                      ├─ DECK VALVE PAIR ── IntelliFlo ── Filter ── Heater ── PAD VALVE ─┬─ POOL RETURNS
SPA (drain)          ─┘   (in-ground,                                        (to-pool/   └─ WATERFALL
        ▲                  suction+return       │                             to-waterfall,
        └── spa return ────select, at spa) ◄────┘ (spa hot return             normally POOL/up)
                                                   via deck pair)
Booster branch: filter-output tap → Polaris PB4-60 → dedicated cleaner line → hose cleaner
```

- **Deck valve pair** (two in-ground valves in deck sleeves near spa): handles **parallel to side of house = POOL mode**; rotated **180° = SPA mode**. One is suction select, one is return select (which-is-which not yet labeled).
- **Pad valve**: selects pool returns vs waterfall on the heater output. Normal = POOL (handle up).
- Waterfall is **downstream of the heater** — a return destination, not a heat path.
- Series-loop consequence: dirty filter reduces GPM everywhere; heater flow switch (~40 GPM class) is first to complain.

## 3. Control architecture (the real story)

Four clocks exist; only some matter:

| Authority | Controls | Status |
|---|---|---|
| IntelliFlo internal schedule | Filtration runs ("after midnight" per Justin; likely also a midday window covering the booster — **verify in menu**) | ACTIVE — the real filtration boss |
| IntelliFlo manual (ON + Speed 3) | Heating runs, ~5 h auto **Time Out** | ACTIVE — Justin's procedure |
| Hayward thermostat | Burner firing when flow present | ACTIVE — no clock, hence standby discipline |
| Right Intermatic | Polaris booster window (~noon–2 PM, dirty season) | ACTIVE, clock correct |
| Left Intermatic | Unknown (SunTouch feed? lights?) | Clock was 12 h off — loads may have been running at night |
| SunTouch | Nothing believed | ABANDONED IN PLACE — but possibly still in heater fireman's-switch path and/or booster relay path (see unknowns) |

**Wiring observed from behind fence:** three runs from SunTouch — power feed, one toward heater (likely low-voltage fireman's/remote pair), one toward a pump (likely RS-485 com to IntelliFlo or 120 V to booster). Breaker panel → timers → loads for line power.

## 4. Owner procedures (verbatim intent, from Justin)

**Heat the pool:** deck valves → POOL (parallel to house); heater MODE → POOL; pad valve → POOL (up, normal); IntelliFlo ON + Speed 3 (3500 RPM); self-stops ~5 h. **Then heater back to STANDBY** (else it re-fires on the overnight filter run — confirmed failure mode).
**Clogged-filter workaround:** same, but pad valve → WATERFALL. Lower backpressure ⇒ enough flow for the heater flow switch. (Explains "heat only works via waterfall" complaint.)
**Heat the spa:** both deck valves rotated 180° → SPA; heater MODE → SPA; IntelliFlo ON + Speed 3; ~5 h; restore afterwards.
**Normal day:** IntelliFlo schedule filters after midnight; hose cleaner runs ~noon–2 PM in season; robots self-manage; heater STANDBY.

## 5. Known failure modes / traps

1. **Heater left on POOL** → fires unattended during scheduled filter runs (gas $).
2. **Dirty filter** → GPM below heater flow switch → no heat without waterfall workaround.
   **Confirmed by Justin, July 2026:** with heater on POOL and the main pump
   started, the burner attempts ignition, fails, and the panel shows **"Service"**
   — the flow-switch lockout. Switching the pad valve to WATERFALL passes enough
   flow for it to light and stay lit. This is the observed symptom behind the
   "heat only works via waterfall" complaint, and it matches the simulator's
   flow-switch model.
3. **Booster vs pump clocks**: booster must run only inside an IntelliFlo run window; nothing enforces this. Left-timer 12 h error historically may have run loads overnight.
4. **Mode/valve mismatch**: heater SPA mode with valves on POOL (or vice versa) heats the wrong body against the wrong setpoint.
5. **Spa drain-down**: suction from spa while returning to pool.
6. **Freeze protection**: SunTouch air sensor dead ⇒ no controller-driven freeze protection. Mitigations: overnight schedule + IntelliFlo internal freeze logic (verify enabled).

## 6. Remaining unknowns (field checklist)

- [ ] IntelliFlo menu: exact schedule windows + speeds; freeze-protection setting; Watts at each speed (for cost model).
- [ ] Hayward rating plate: BTU input (for gas cost model); model number.
- [ ] Pool volume (gallons) — for heat-rise time estimates.
- [ ] Left Intermatic: what load(s)? Tripper positions on both timers (photo dials up close).
- [ ] SunTouch breaker-off test: does heater still fire? (Proves fireman's-switch bypass.) Does anything else die (booster? lights?)
- [ ] SunTouch deadfront photos: which terminals actually have field wiring (actuators? booster relay? IntelliFlo com?).
- [ ] Valve actuator seen in pad photos: attached to which valve, functional or frozen, cable landed where?
- [ ] Deck pair: which valve is suction vs return; label both.
- [ ] Light circuits: which timer/switch controls each of the three J-boxes.
- [ ] Waterfall: any dedicated pump, or purely a return leg? (Assumed return leg.)

## 7. Future option (documented, not yet decided)

Replace both Intermatics + SunTouch with WiFi control, **no downstream changes**:
- **Pentair IntelliConnect** (~$600): 2 relays (booster, lights) + IntelliFlo over com cable + heater via fireman's switch. No valve actuators — spa stays manual-lever. Note: pump schedules are written INTO the IntelliFlo (pump keeps working if controller dies); freeze protect is cloud-weather-based.
- **Pentair IntelliCenter Lite i5PS** (~$2.5k installed class): adds valve actuator outputs → push-button spa mode; local air sensor → offline freeze protection; becomes the load center.
- DIY Home Assistant/ESP32 path possible (IntelliFlo RS-485 protocol is community-documented) but commercial box preferred for owner-maintainability.

---

## 8. App description (current prototype: `pool-flow-v3.jsx`)

Single-file React artifact. No external state; persists via `window.storage` (keys `pool-v3:state`, `pool-v3:notes`). Fonts: IBM Plex Mono + Barlow Semi Condensed via Google Fonts import.

**Purpose:** interactive system map + simulator + operating manual for a non-technical owner. Design language: "equipment-pad field instrument" — light concrete background, white panel cards, monospace labels.

**Schematic (SVG, viewBox 1000×500):**
- Nodes: POOL, SPA, INTELLIFLO, FILTER, HAYWARD, POOL RETURNS, WATERFALL, POLARIS BOOST, HOSE CLEANER. Tap to change state (pump cycles off→sched-idle→sched-running→manual3; filter toggles clean/dirty; heater cycles standby/pool/spa; booster toggles).
- Valves: DECK PAIR (pool/spa, animated 180° handle) and PAD VALVE (pool/waterfall), tappable.
- Timer badges (tan): IntelliFlo schedule + right-Intermatic booster window; times are editable text inputs (persisted) pending real values.
- **Flow encoding (orthogonal):** color = temperature (blue cold; red ONLY downstream of a firing heater); dash pattern = flow rate (dashes normal; sparse dots ONLY downstream of a dirty filter). Hot animation runs ~2.3× slower than cold. Four combos all meaningful; red dots = "heated but choked" = today's waterfall-workaround state.

**Simulation (`solve()`):** derives active/heated edge sets, rough GPM (base by pump mode, ×0.55 dirty filter, +12 waterfall open), heater status vs ~40 GPM flow-switch threshold, ~$8.8/hr gas when firing (placeholder pending BTU rating).

**Procedures:** four buttons apply Justin's documented states AND display his numbered step lists (incl. "return to STANDBY" closing steps).

**Warnings (red banners):** low-flow no-fire; heater-on-during-schedule (the gas trap); mode/valve mismatches; booster dead-head; dirty-filter notice.

**"Who controls what" card:** prose control-chain summary, reads live from editable timer strings.

### Next-iteration ideas (for Claude Code)
1. **Cost model**: real BTU + measured Watts/speed + SMUD/PG&E rates → live $/hr and per-procedure estimates ("Heat pool: ~$38 gas + $2 electric"). Data slots already anticipated in §6.
2. **Printable one-pager** export (garage-wall operating manual).
3. **Timeline view**: 24 h strip showing IntelliFlo windows, booster window, manual heat runs — makes clock-agreement visible.
4. Replace editable time strings with structured schedule objects once real values are read.
5. Photo attachments per component (survey photos as reference).
6. Possibly promote from artifact to a small hosted page (Rick's standard Vue/GitHub Pages stack) if Justin wants it on his phone.
