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

- **Deck valve pair** (two in-ground valves in deck sleeves near spa): handles **parallel to side of house = POOL mode**; rotated **180° = SPA mode**; **intermediate SPLIT position = default** — this was the valves' position when Justin bought the house (original design intent). At split, every pump run circulates BOTH bodies, giving the spa routine filtration/turnover so it doesn't stagnate between uses. Requirement: both valves at comparable splits so spa-in ≈ spa-out (verify spa level holds for a day after setting). One is suction select, one is return select (which-is-which not yet labeled).
- **Pad valve**: selects pool returns vs waterfall on the heater output. Normal = POOL (handle up).
- **Booster branch (corrected 7/25, empirical):** tees off the HEATED return leg downstream of the Hayward — not the filter output. Evidence: heater firing + booster OFF → heated water felt at the vacuum wall socket (idle centrifugal booster passes flow). Cleaner port is thus a small always-open return whenever the trunk is pressurized.
- Waterfall is **downstream of the heater** — a return destination, not a heat path.
- **Series return topology (refined 7/20):** heater out → PAD VALVE → {waterfall's own dedicated line} OR {under-deck return trunk → DECK RETURN VALVE → pool floor returns or spa jets}. The deck valves are IN-LINE for all main-pool circulation — 100% of daily flow passes through them; the spa legs are the switched branch. Spa procedures never touch the pad valve because it must already be on POOL for water to reach the deck valve.
- **Pool floor returns:** two (deep end + shallow end), manifolded as the pool branch — believed to go quiet together in full SPA mode (verify: 10-min spa-level test + hand over each floor return).
- **HAZARD:** pad valve on WATERFALL while suction draws any spa fraction (full SPA **or the resting SPLIT**) pumps the spa out through the waterfall → spa drain-down (slow at split, fast at full spa). Rule: **any pad-valve diversion requires deck valves at POOL first.** No documented procedure produces the bad state; a casual "turn on the waterfall" from rest would.
- **v3 app topology bug (next iteration):** schematic draws the spa return parallel to the pad valve; reality is series (pad valve → deck valve). Redraw and add the spa+waterfall warning.
- Series-loop consequence: dirty filter reduces GPM everywhere; heater flow switch (~40 GPM class) is first to complain.

## 3. Control architecture (the real story)

Four clocks exist; only some matter:

| Authority | Controls | Status |
|---|---|---|
| IntelliFlo internal schedule | **CAPTURED 7/20/26:** Speed 1 @3250 RPM 7:00a–3:05p · Speed 2 @3000 3:00p–6:02p · Speed 5 @1350 6:50p–6:55a. Pump runs ~23 h/day; only idle window 6:02–6:50 PM. Speed 3 = egg timer 3450 RPM, 3 h 10 m (the heating run — Justin's "~5 hours" was this). Speed 4 = manual 3030. Overlap 3:00–3:05 harmless (higher RPM wins). | ACTIVE — the real filtration boss |
| IntelliFlo manual (ON + Speed 3) | Heating runs, ~5 h auto **Time Out** | ACTIVE — Justin's procedure |
| Hayward thermostat | Burner firing when flow present | ACTIVE — no clock, hence standby discipline |
| Right Intermatic | Polaris booster — **manual seasonal switch**: no trippers installed; pool guy adds/removes "dogs" seasonally. Currently lever OFF, cleaner out of pool | CONFIRMED — no off-season waste while OFF |
| Left Intermatic | **Main power bus** (lever ON, no trippers, runs continuously): feeds SunTouch and believed pump/heater side. Effectively the pad's master disconnect — do NOT flip off casually (kills filtration schedule, freeze protection, heater) | CONFIRMED tripper-less; exact load list still to verify |
| SunTouch | Nothing believed | ABANDONED IN PLACE — but possibly still in heater fireman's-switch path (see unknowns) |

**Wiring observed from behind fence:** three runs from SunTouch — power feed, one toward heater (likely low-voltage fireman's/remote pair), one toward a pump (likely RS-485 com to IntelliFlo or 120 V to booster). Breaker panel → timers → loads for line power.

## 4. Owner procedures (verbatim intent, from Justin)

**Heat the pool:** deck valves → POOL (parallel to house); heater MODE → POOL; pad valve → POOL (up, normal); IntelliFlo ON + Speed 3 (3500 RPM); self-stops ~5 h. **Then heater back to STANDBY** (else it re-fires on the overnight filter run — confirmed failure mode).
**Clogged-filter workaround:** same, but pad valve → WATERFALL. Lower backpressure ⇒ enough flow for the heater flow switch. (Explains "heat only works via waterfall" complaint.)
**Heat the spa:** both deck valves rotated 180° → SPA; heater MODE → SPA; IntelliFlo ON + Speed 3; ~5 h; restore afterwards.
**Normal day:** IntelliFlo schedule filters after midnight; hose cleaner runs ~noon–2 PM in season; robots self-manage; heater STANDBY.

## 5. Known failure modes / traps

1. **Heater left on POOL** → fires unattended during scheduled filter runs (gas $).
2. **Dirty filter** → GPM below heater flow switch → no heat without waterfall workaround.
3. **Booster vs pump clocks**: booster must run only inside an IntelliFlo run window; nothing enforces this. Left-timer 12 h error historically may have run loads overnight.
4. **Mode/valve mismatch**: heater SPA mode with valves on POOL (or vice versa) heats the wrong body against the wrong setpoint.
5. **Spa drain-down**: suction from spa while returning to pool.
6. **Freeze protection**: SunTouch air sensor dead ⇒ no controller-driven freeze protection. Mitigations: overnight schedule + IntelliFlo internal freeze logic (verify enabled).

## 6. Remaining unknowns (field checklist)

**Remediation tasks (fixes, not tests — do these):**
- [ ] **Cap the orphan solar stub** on the old solar diverter valve (glued PVC cap + primer/cement, ~$2). Until capped, anything that rotates that valve — bumped manual override lever or a confused SunTouch valve command — dumps pressurized pool water out the open pipe at 45+ GPM, unattended. Capping makes the worst case a harmless dead-head.
- [ ] **Verify + lock the solar diverter position**: confirm current position = bypass (it must be, since pump→heater flows today), then disable the actuator — unplug its cable at the SunTouch end and/or use the actuator's manual toggle. Photograph final state.
- [ ] **Paint-pen the pad**: label pipes at confusion points ("to waterfall", "spa return", "cleaner line"), mark calibrated deck-valve split positions (after commissioning test 5/6), and write "POOL VALVES FIRST" at the pad valve.
- [ ] **Reconnect the SunTouch air sensor** — clears the flashing AIR Error. The salvaged cut probe (in parts pile) may still work: meter it, ~10 kΩ across the leads at ~77 °F = good thermistor. If good, splice to the cut cable with waterproof (gel-filled) connectors; if not, any Pentair 10 kΩ air/water sensor (~$15–25) replaces it — two-wire, no polarity, lands on the AIR terminals behind the deadfront (POWER OFF first). Mount the probe in shade near the enclosure. While in there: set the SunTouch clock. Result: the abandoned controller becomes a quiet, sane-looking fallback instead of a flashing mystery — and a working outdoor thermometer at the pad as a bonus.

- [x] IntelliFlo menu: schedule captured 7/20/26 (see control table). Still to read: **Watts at each speed** (for cost model) and freeze-protection setting.
- [x] **Chlorination: ANSWERED 7/20/26** — trichlor floating dispenser + pool guy's weekly dosing; no inline chlorinator or salt cell at pad (confirmed by inspection). Sanitation is therefore independent of pump run-hours → **no chlorine constraint on the TOU schedule redesign**. Awareness: trichlor floaters accumulate cyanuric acid over years (standard serviced-pool issue; pool guy's domain — occasional partial drain/refill).
- [ ] **Schedule cost review (biggest $ lever):** 11 h/day at 3000–3250 RPM ≈ 18–22 kWh/day ≈ $80–100/mo SMUD. A long-low profile (more hours at 1350–1800) could cut this 3–4×. Ask pool guy about skimming needs under the trees before changing (chlorine constraint now cleared). Evening 48-min gap (6:02–6:50p) — intentional or oversight?
- [ ] **Standby trap is worse than assumed:** pump flows ~23 h/day, so a heater left on POOL fires nearly continuously — potentially $100+/day of gas, not just an overnight run.
- [ ] Hayward rating plate: BTU input (for gas cost model); model number.
- [x] **Pool volume: ESTIMATED 7/25/26** — 35' × 15' bounding, 5' avg depth, freeform factor ~0.8 → **~15,500 gal pool (±15%), ~16,300 with spa at split**. Turnover check on proposed TOU schedule: ~34–38k gal/day ≈ **2.2–2.4 turnovers** vs 1.0 standard → schedule validated with 2× margin (could trim further later). Heating: ~129k lbs water → ~1.6 °F/hr (H250) to ~2.5 °F/hr (H400); the 3:10 egg timer ≈ 5–8 °F per session pending BTU plate.
- [ ] Left Intermatic: confirm full load list (SunTouch + pump + heater? lights?) — it is the de facto master disconnect. Both timers CONFIRMED tripper-less (manual-lever operation; pool guy installs dogs seasonally for the booster).
- [ ] Cleaner-season question for Justin/pool guy: when dogs go in, what window do they set, and does the IntelliFlo midday schedule cover it?
- [ ] SunTouch breaker-off test: does heater still fire? (Proves fireman's-switch bypass.) Does anything else die (booster? lights?)
- [ ] SunTouch deadfront photos: which terminals actually have field wiring (actuators? booster relay? IntelliFlo com?).
- [ ] Valve actuator seen in pad photos: attached to which valve, functional or frozen, cable landed where?
- [ ] **Split-fraction calibration (deck valves at SPLIT):** target f ≈ 10–15% of flow to spa (over-proportional to volume is CORRECT — small warm bodies need faster turnover; spa gets 4–6 turnovers/day, pool keeps (1−f)×2.3 ≈ 2.0× at f=0.15; compensation with extra pump hours only needed if f drifts past ~0.5). Handle angle: small crack toward spa (~10–15°), not 45°.
  - **Drain-rate test (quantifies suction-side f, ~10 min):** suction valve at its split setting, rotate ONLY the return valve to full POOL. Spa drains at f×Q. Spa surface ≈ 38 ft² → **1 inch of level ≈ 24 gal**. Example: 1" drop in 5 min = 4.8 GPM; vs ~60 GPM total → f ≈ 8%. Restore return valve after.
  - **Dye test (return side, optional):** food coloring in spa; half-fade time τ ≈ 800/(f×Q) cross-checks return share.
  - **Set + mark:** adjust both handles until suction-f ≈ return-f (spa level stable over a day), then PAINT-PEN the calibrated positions on the deck collars. Ongoing monitor is free: a moving spa level = the split has drifted.
  - Side effect: this test also IDENTIFIES which deck valve is suction vs return (rotate one to full POOL: spa level DROPS → you moved the return valve; RISES → you moved the suction valve). Label both while marking.
- [ ] **Lighting reverse-engineering — full L-series plan in TABBED-REDESIGN-SPEC (Commissioning):** map pad subpanel (Square D HOM612L100RB: 30A 2-pole = pump-chain feed?, 15A 1-pole = only 120V circuit, suspect for SunTouch/lights; slots 4–6 empty = future capacity), test main-panel #8 "lights", meter the 3 riser J-boxes against SunTouch AUX / subpanel 15A / main #8, GFCI audit before energizing any niche light, find-or-confirm-gone the 12V transformer, waterfall cable continuity (all 4 CL115s flooded → LED + new transformer plan), niche fixture service w/ gasket replacement. Note: main-panel "POOL EQUIP" pair are Challenger breakers (known failure history — someday-replace, flag to Justin).
- [ ] Waterfall: any dedicated pump, or purely a return leg? (Assumed return leg.)

## 7. Future option (documented, not yet decided)

### 6.5 Proposed IntelliFlo reprogram (draft — pending pool-guy sign-off, gallons, chlorination answer)

**Rationale:** current high-RPM daytime profile is believed to be a vestige of the decommissioned rooftop solar (high flow needed to lift to roof during sun hours). Solar is gone; household is on SMUD TOU (Tesla EV plan) → shift volume off-peak. Measured: 136 W @ 1350 RPM; cube-law estimates: ~1.0 kW @ 2600, ~1.49 kW @ 3000, ~1.9 kW @ 3250, ~2.27 kW @ 3450.

**Current vs proposed (the one-paragraph case):** The current schedule moves ~62,000 gal/day ≈ **4.0 turnovers** — 4× the residential standard — for ~21 kWh (~$105/mo), i.e. ~2,900 gal/kWh. The proposed schedule moves ~36,000 gal/day ≈ **2.2–2.4 turnovers** — still >2× standard — for ~6.5 kWh (~$25/mo), i.e. ~5,500 gal/kWh: nearly double the water per unit of energy (cube law — flow scales with RPM, power with RPM³), shifted entirely off-peak. Nobody specs 4 turnovers for water quality; that number is the fingerprint of the old solar design goal (hours of high flow across a hot roof). The panels left; the schedule stayed. Proposed change trims luxury margin, not adequacy.

**Scheduled speeds (see button/menu reassignment below):**
| Slot | Time | RPM | Purpose |
|---|---|---|---|
| menu slot | 6:55 AM – 12:00 PM | ~2600 | Main turnover + skimming (trees), ends at mid-peak start |
| menu slot | 8:00 PM – 6:55 AM | 1350 (136 W) | Overnight low: turnover + freeze coverage |
| — | 12:00 PM – 8:00 PM | off | Peak/mid-peak avoidance (robot skimmer covers surface) |

Est. ~6.5 kWh/day ≈ $25/mo vs current ~21 kWh/day ≈ $105/mo → **~$80/mo savings.** Must-verify before adopting: total turnover vs pool gallons; any chlorinator/salt-cell flow-hour requirements (none yet found at pad — open question).

**On-demand egg timers — assigned to KEYPAD BUTTONS (Speeds 1–4 have physical keys; scheduled speeds move to menu-only slots 5–7). Buttons = verbs, menu = background jobs. Manual valve/heater steps remain and are accepted:**
| Speed btn | Action | RPM | Duration | Notes |
|---|---|---|---|---|
| 1 | **Heat pool** | 3450 | 3:10 | Deck valves POOL, heater MODE→POOL, pad valve per filter state. Pump self-stops; heater STANDBY return is manual |
| 2 | **Heat spa** | ~2800 | ~1:00 | Deck valves→SPA, heater MODE→SPA. Restore valves + standby after |
| 3 | **Waterfall show** | ~2800 | ~2:00 | **Deck valves → POOL first** (at split, the waterfall slowly drains the spa: pad valve starves the return trunk while split suction keeps drawing from spa). Then pad valve→WATERFALL. Only the suction deck valve strictly must move (return valve is on a dead leg once pad diverts) — rotate both until suction/return are labeled. Alternative to test: PARTIAL pad-valve position feeds waterfall + trunk simultaneously, keeping spa balanced from split — single-valve show if the falls look OK at reduced flow. Restore valves after; auto-stop ends the show |
| 4 | Manual utility speed (as-is, 3030) | — | — | Override/testing |

**Scheduled slots (menu-only):** Speed 5 = 6:55 AM–12:00 PM @ ~2600 (turnover/skimming, off-peak); Speed 6 = 8:00 PM–6:55 AM @ 1350/136 W (overnight + freeze). 12 PM–8 PM off.

**Accidental heater interlock (verify empirically):** Hayward pressure switch needs ~25+ GPM class flow. At 1350 RPM the switch may stay OPEN → the 11 h overnight leg could be inherently heater-proof even if MODE is left on POOL — a valuable damage limiter (caps a forgotten heater at the ~5 h morning run instead of ~16 h). It is NOT a guarantee: threshold shifts with filter state and pad-valve position, and marginal flow risks short-cycling. TEST: heater on POOL, run 1350 then 2600, record whether it fires at each. Do not tune schedule RPMs specifically to sit near the switch threshold.

**Booster window (dogs in, dirty season): 9:30–11:30 AM** — inside Speed 1 flow (interlock margin), neighbor-friendly hours, off-peak, ends before mid-peak. ~25¢/run.

Caveat that motivates the controller retrofit: pump egg timers auto-stop the PUMP only — heater standby and valve restoration remain human steps until a controller owns them.


Replace both Intermatics + SunTouch with WiFi control, **no downstream changes**:
- **Pentair IntelliConnect** (~$600): 2 relays (booster, lights) + IntelliFlo over com cable + heater via fireman's switch. No valve actuators — spa stays manual-lever. Note: pump schedules are written INTO the IntelliFlo (pump keeps working if controller dies); freeze protect is cloud-weather-based. **Synergy with split-default valves:** since the deck pair rests at SPLIT, "heat the pool" needs no valve change → becomes a fully remote two-tap action. Also mitigates the pad-access problem (IntelliFlo keypad is awkward to reach behind pipe runs): app control makes keypad visits maintenance-only. Remaining walk-to-pad actions: spa mode, waterfall valve, filter service, seasonal booster dogs.
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
