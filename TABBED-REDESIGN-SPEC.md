# TABBED-REDESIGN-SPEC — Justin's Pool System Map
**Target:** https://harmonic-systems-home.github.io/Justin-s-Pool/
**Companion docs:** POOL-SYSTEM-HANDOFF.md (system facts), CHANGES-REQUESTED.md (still applies; fold into relevant tabs)
**Date:** July 25, 2026

## Motivation
Single-page layout is saturated. Reorganize into a tabbed interface where each tab serves a distinct reader mode: operating (daily), servicing (maintenance), understanding (design/history), deciding (costs/what-if), and verifying (commissioning).

## Architecture notes (read first)
- **Single source of truth:** one config object (schedules, rates, volumes, valve settings, measured values). All tabs render from it. Commissioning results WRITE INTO it — e.g., a measured Watts@RPM overrides the affinity-law estimate everywhere; a measured BTU populates the gas model; measured split-f updates turnover math.
- **Estimated vs measured provenance:** every number carries a badge (EST / MEASURED + date). Commissioning is the mechanism that flips badges. This is the app's core discipline.
- **Persistence:** localStorage for working state + **JSON export/import** so commissioning results survive devices (Rick's iPad, Justin's phone) and can be committed to the repo as the canonical record.
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
3. **Watts per speed** — IntelliFlo display at each RPM → power curve
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
    - Refinement paths (optional, flips badge to MEASURED): trace plan area from the satellite photo at known scale; or clock the water meter during a level-restoring refill of a measured drawdown (1" pool-wide ≈ area ft² × 0.62 gal)

### 7. History
- Original construction era: solar rooftop heater, 4-turnover schedule rationale, CL115 waterfall lights (2002)
- Pass-through controller era: SunTouch installed (solar control + spa button + egg timers + booster interlock + light AUX), later abandoned in place; air sensor cut during solar demolition; left timer became tripper-less power bus
- Timeline of known changes: solar removal (date TBD from Justin), domain of pool-guy practices (dogs ritual), balloon-tool line clearing (date, which lines TBD), lamp-cord removal (7/2026), this documentation project (7/2026)
- **Schedule change log:** auto-appended by What-If "promote" + manual entries (date, what, why, who)

## Migration notes
- CHANGES-REQUESTED items map: #1 volume/turnover → Costs + What-If; #2 unmerged windows → Daily + What-If editors; #3 gas placeholder → Costs; #4 persistence → architecture above; #5 waterfall rule → Daily warnings + Commissioning test 8.
- Keep the visual language (field-instrument aesthetic, dial renderings, EST/MEASURED honesty).
