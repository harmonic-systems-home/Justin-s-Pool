# TABBED-REDESIGN-SPEC — Justin's Pool System Map
**Target:** https://harmonic-systems-home.github.io/Justin-s-Pool/
**Companion docs:** POOL-SYSTEM-HANDOFF.md (system facts), CHANGES-REQUESTED.md (still applies; fold into relevant tabs)
**Date:** July 25, 2026

## Motivation
Single-page layout is saturated. Reorganize into a tabbed interface where each tab serves a distinct reader mode: operating (daily), servicing (maintenance), understanding (design/history), deciding (costs/what-if), and verifying (commissioning).

## Architecture notes (read first)
- **Single source of truth:** one config object (schedules, rates, volumes, valve settings, measured values). All tabs render from it. Commissioning results WRITE INTO it — e.g., a measured Watts@RPM overrides the affinity-law estimate everywhere; a measured BTU populates the gas model; measured split-f updates turnover math.
- **Estimated vs measured provenance:** every number carries a badge (EST / MEASURED + date). Commissioning is the mechanism that flips badges. This is the app's core discipline.
- **Persistence architecture (two tiers, same JSON contract):**
  - **Storage of record:** a separate PRIVATE repo (`Justin-s-Pool-data`) holding `results.json` — keeps commissioning data private while the app repo/Pages stay public+free (private-repo Pages would require a paid plan). Every save = a commit → history, diffs, attribution ("recorded by" name field goes in the commit message).
  - **Tier 1 (Justin, zero-GitHub):** Cloudflare Worker (free tier) holds ONE fine-grained PAT (Contents-only, data repo) as a secret; endpoints GET/PUT `/data` proxy the GitHub Contents API (fetch SHA → merge → PUT); CORS locked to the Pages origin; auth = shared passphrase header, entered once per device, remembered in localStorage. Justin's onboarding: "type the pool password." Annual token rotation happens once, at the Worker, by Rick.
  - **Tier 2 (Rick, direct/admin):** same JSON contract straight to the GitHub API with a personal fine-grained PAT pasted into a settings field (localStorage). Fallback if the Worker is ever down.
  - localStorage remains the working copy; Sync is semi-automatic (debounced auto-save after each commissioning result + manual Sync button). Conflict handling: stale SHA → 409 → refetch, merge (results are per-test, so merges are disjoint), retry.
- **Active vs proposed schedule:** Costs tab reads the ACTIVE schedule; What-If holds the draft. A "promote to active" action (with confirmation + History log entry) formalizes a reprogram.

## Tabs

### 1. Daily Operation
The current page's operating core: live schematic (tap valves/equipment), current-schedule 24-h timeline with now-marker, keypad button guide (1=Heat pool, 2=Heat spa, 3=Waterfall, 4=Manual), dial/lever state, procedure checklists, warnings panel (incl. "any pad-valve diversion requires deck valves at POOL first"). This is Justin's daily tab — everything else is reference.

### 2. Maintenance
- Robot skimmer: model TBD, charging/cleaning cadence, notes field
- Robot underwater scrubber: model TBD, cadence, notes
- Polaris booster + hose cleaner: seasonal dogs-in/dogs-out ritual, 9:30–11:30 window, lever location, dead-head warning
- Filter (suction-side cartridge): cleaning indicator (pressure gauge delta from clean baseline), last-cleaned date field
- Floating chlorine dispenser: tablet type, refill cadence, CYA-accumulation awareness note
- Pool guy: visit schedule, known activities, questions queue (running list feeds from other tabs)
- **Drain & fill:** cartridge-filter system → NO backwash/waste port on the pad; draining requires a submersible utility pump in the deep end, discharging to a **sanitary sewer cleanout** (CA rule: pool water to sewer, never storm drain/gutter — Sacramento-area districts enforce). Main pump cannot pump the pool down (loses prime below skimmer). **Never fully drain casually** — empty gunite shells can float/crack from groundwater (hydrostatic pop-out); full drains are deliberate, pro-supervised events. Realistic use: partial drain-and-refill (1–2 ft) for CYA management — pool-guy territory. Filling: hose over coping or the dedicated fill line (see Commissioning test 13); watched, no autofill installed.

### 3. Pool Design
- Component inventory (from handoff §1): pump, filter, heater, booster, cleaners, timers, SunTouch, lights
- Switch list: house wall switches (kitchen pair, master pair → floods + lanterns), timer levers, keypad buttons
- Controller list: IntelliFlo (active), Hayward thermostat (active), Intermatics (manual switches), SunTouch (abandoned; AIR Error + wrong clock; capabilities if revived)
- Water volumes: pool ~15,500 gal ±15%, spa ~800, total at split ~16,300
- Plumbing topology diagram (static, annotated — the series return path, under-deck trunk, waterfall line, booster branch, orphan solar stub w/ cap status)
- Lighting: TBD section — niche lights (pool + spa, no known switch, SunTouch AUX hypothesis), waterfall CL115s (flooded, 12V, transformer missing?), cut lamp cord (removed)

### 4. Costs
Reads ACTIVE schedule. Electric: per-window kWh from Watts curve (measured points override affinity estimates), SMUD TOU rates (editable rate table), $/day and $/mo. Gas: heater BTU (badge EST until commissioned), $/therm (editable), $/hr firing, $/session (egg-timer durations), °F-per-session. Booster + misc loads. Total monthly picture.

### 5. What If
The proposal sandbox: adjustable draft schedule (windows + RPM), live-computed deltas vs active — turnovers (pool at (1−f)×turnover using measured split-f), kWh, $/mo, gal/kWh. Ships preloaded with the §6.5 TOU proposal. "Promote to active" writes History.

### 6. Commissioning
Each test = procedure card + recordable result fields (value, date, who) that write into config with MEASURED badges:
1. **Gas meter clocking** — heater BTU input: all other gas off, time test-dial rev; BTU/hr = 3600/sec × dial-ft³ × ~1,030. → gas model
2. **Heater cabinet measurement** — width vs BTU ladder (~21"=150k … 36"=400k) as cross-check; also check inside front access door + gas valve label for plates
3. **Watts per configured speed** — read live Watts off the IntelliFlo display at each programmed RPM (start the speed, let it stabilize ~30 s, record). Table to fill: **1350 = 136 W (MEASURED 7/20/26)** · 2600 (proposed turnover) · 3000 (Speed 2) · 3030 (Speed 4 manual) · 3250 (Speed 1) · 3450 (Speed 3 heat run). Measured points override the affinity-law (P ∝ RPM³) estimates everywhere in Costs/What-If; two or three points also validate the curve shape itself. Bonus while cycling speeds: note filter-gauge PSI at each RPM → free flow-restriction baseline (pairs with FlowVis if ever installed).
4. **Heater flow-switch test** — MODE=POOL at 1350 then 2600: fires? → documents the accidental interlock
5. **Switch-position mapping** — deck valve suction-vs-return ID + calibrated split positions, paint-pen marks photographed
6. **Spa drain-rate test** — return valve to full POOL, time level drop (1" ≈ 24 gal on ~38 ft² spa) → measured split-f
7. **Dye test** (optional) — return-side f cross-check via half-fade time τ ≈ 800/(f×Q)
8. **Waterfall+split drain verification** — from resting SPLIT, pad valve → WATERFALL briefly: does spa level fall? Confirms series topology + the POOL-valves-first rule (STOP test at first measurable drop; restore valves)
9. **SunTouch AUX/lights test** — press AUX 1/2/3, listen for relays, meter deck J-boxes → niche-light circuit hypothesis
10. **Left-timer load inventory** — SunTouch-breaker-off test + what dies with left lever (careful: master disconnect)
11. **Spa-level stability** (24 h at calibrated split) — ongoing monitor baseline
12. **Volume estimation** — record the inputs, factors, and derivation, not just the answer:
    - Pool inputs (per Justin, 7/25/26): 35' max length × 15' max width × 5' avg depth; bounding box 2,625 ft³
    - Freeform plan-area factor: 0.78–0.85 (chosen 0.80) for rock-cut corners/tapered ends → ~420 ft² × 5' × 7.48 gal/ft³ ≈ **15,500 gal (±15%)** — EST
    - Spa inputs: diameter + seat depth TBD (measure) → currently assumed **~800 gal** — EST
    - Total at split ≈ 16,300 gal
    - Editable fields for all inputs + factor so revised measurements recompute downstream (turnover, heat-rise, split-f targets)
    - Refinement path (flips badge to MEASURED) — **the 1-inch refill test:** mark the water line on a tile with painter's tape; let the level fall 1" (evaporation over a few summer days, or briefly run the submersible pump); shut off all other household water; read the house water meter; refill via hose/fill line exactly to the mark; read the meter again. **Gallons added ÷ 0.62 = true surface area (ft²)**; area × 1" ≈ gallons-per-inch (the constant every other level-based test uses); area × avg depth = volume. Note: this measures AREA precisely — avg depth (Justin's 5') remains the soft input, so quote volume as measured-area × estimated-depth. Alternative: trace plan area from the satellite photo at known scale.
13. **Fill-line trace** — the white PVC riser w/ brass valve by the fence (near heater) is believed a dedicated domestic fill line. Open briefly, find where water emerges at the pool; label the valve. (The rusty galvanized bib at the house wall = ordinary hose bib.)
14. **SMUD rate & EV-discount verification** — confirm the cost model's rate inputs against reality: (a) from Justin's SMUD bill, record the actual rate schedule name (TOD 5–8 p.m. expected) and the current $/kWh for each period — enter into the editable rate table with a MEASURED badge + bill date; (b) confirm the **EV discount is active**: the Tesla must be DMV-registered at the SMUD service address — check the bill for the midnight–6 AM discount line item, or verify via Justin's SMUD account; if absent, registering it is a free ~1.5¢/kWh on all overnight usage (pool + car); (c) note the rate season boundaries (Jun 1 / Oct 1) so the Costs tab can switch seasonally. Result: every $ figure in Costs/What-If traces to a dated bill, not a web lookup.

**Lighting reverse-engineering (L-series — one metering session, helper + multimeter):**
- L0. **Map the pad subpanel** (Square D HOM612L100RB, recently installed; fed by main panel's 40A "POOL EQUIP" Challenger pair): 30A 2-pole = believed 240V feed to timer box → pump chain; 15A 1-pole = the pad's ONLY 120V circuit — prime suspect for SunTouch supply and/or lights. Flip each, observe what dies, label. Positions 4–6 empty = future capacity (IntelliConnect, new light transformer). Side note for Justin: Challenger breakers in the main panel have a known failure history — someday-replace item, independent of this project.
- L1. **Prove/disprove main-panel #8 "lights"**: flip it, check house lights vs anything poolside.
- L2. **Meter the 3 riser J-boxes** (black→white, orange→white in the opened box; repeat per box) while helper cycles candidates one at a time: SunTouch AUX 1/2/3 (= test 9), subpanel 15A, main #8. Build the circuit→box→fixture map. Note which conductors are line voltage vs low voltage.
- L3. **GFCI audit** (NON-NEGOTIABLE before any niche light is used): find the GFCI device protecting any 120V underwater circuit — GFCI breaker or feed-through receptacle. If 120V niche lights have NO GFCI: do not energize; add a GFCI breaker first (subpanel has room).
- L4. **Find the 12V transformer or confirm it's gone**: eaves, boxes near waterfall, behind/inside SunTouch enclosure. Inventory the wires inside the SunTouch while there — identify any that land on AUX relays and head toward the risers.
- L5. **Waterfall circuit continuity**: locate the pad end of the old round CL115 cable; meter continuity/resistance toward the waterfall fixtures. All four fixtures are flooded → plan = new 12V LED fountain lights + new outdoor smart transformer (~60W covers 4× LED), direct-burial LV cable. Record whether the old cable is reusable as the run.
- L6. **Niche fixture service (pool + spa)**: breaker OFF + GFCI verified → one screw on trim ring, tilt fixture out, lift onto deck on its coiled cord. Inspect: water inside = replace fixture (don't relamp); dry = relamp (verify lamp type/voltage against fixture label), NEW lens gasket regardless, reseat. Never energize a 120V niche lamp out of water for more than a moment (water-cooled). Modern option: color LED retrofit lamps if fixtures prove dry and circuits healthy.
- Results recorded per L-step (measured voltages, circuit map, transformer status, fixture condition) — feeds the Pool Design tab's lighting section from TBD → documented.

**Remediation tasks (same tab, separate section — fixes rather than tests, each with done-date + photo field):**
- R1. **Cap the orphan solar stub** (glued PVC cap): defuses the open-pipe dump hazard on the old solar diverter — until capped, any rotation of that valve (bumped override lever, stray SunTouch valve command) discharges pool water at 45+ GPM unattended.
- R2. **Verify + lock solar diverter in bypass**; disable actuator (unplug at SunTouch and/or actuator toggle). Photo of final state.
- R3. **Paint-pen the pad**: pipe labels at confusion points, calibrated split marks on deck collars (after tests 5/6), "POOL VALVES FIRST" at the pad valve.
- R4. **Reconnect SunTouch air sensor** (clears flashing AIR Error): meter the salvaged probe (~10 kΩ @ ~77 °F = good) and splice with gel-filled connectors, or fit a new Pentair 10 kΩ sensor (~$15–25); two-wire non-polarized on AIR terminals behind deadfront, POWER OFF first; mount in shade. Set the SunTouch clock while in there. Turns the abandoned controller into a quiet, credible fallback + working pad thermometer.

### 7. History
- Original construction era: solar rooftop heater, 4-turnover schedule rationale, CL115 waterfall lights (2002)
- Pass-through controller era: SunTouch installed (solar control + spa button + egg timers + booster interlock + light AUX), later abandoned in place; air sensor cut during solar demolition; left timer became tripper-less power bus
- Timeline of known changes: solar removal (date TBD from Justin), domain of pool-guy practices (dogs ritual), balloon-tool line clearing (date, which lines TBD), lamp-cord removal (7/2026), this documentation project (7/2026)
- **Schedule change log:** auto-appended by What-If "promote" + manual entries (date, what, why, who)

## Migration notes
- CHANGES-REQUESTED items map: #1 volume/turnover → Costs + What-If; #2 unmerged windows → Daily + What-If editors; #3 gas placeholder → Costs; #4 persistence → architecture above; #5 waterfall rule → Daily warnings + Commissioning test 8.
- Keep the visual language (field-instrument aesthetic, dial renderings, EST/MEASURED honesty).
