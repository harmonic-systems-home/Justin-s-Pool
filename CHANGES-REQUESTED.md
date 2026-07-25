# CHANGES-REQUESTED — Justin's Pool System Map
**Against:** https://harmonic-systems-home.github.io/Justin-s-Pool/ (reviewed from screenshots, July 25 2026)
**Reviewer:** Rick + Claude (chat session). Companion to POOL-SYSTEM-HANDOFF.md.

## Review verdict
Strong iteration. Series topology redraw ✓ (v3 bug fixed). Dual 24-h timeline views (current + proposed) ✓ — best feature on the page. Structured schedule editors w/ provenance checkbox ✓. Intermatic dial rendering with dogs/lever education ✓. Honest cost framing (flat-rate vs TOU footnote, DRAFT badge, amber verify-first interlock note) ✓ — keep all of this.

## Requested changes

### 1. Add volume & turnover data (post-handoff findings, 7/25)
- Pool ≈ **15,500 gal ±15%** (35'×15' bounding × 5' avg depth × ~0.8 freeform factor); ≈16,300 w/ spa at split.
- Current schedule ≈ 62,000 gal/day ≈ **4.0 turnovers**; proposed ≈ 36,000 ≈ **2.3 turnovers**; residential standard = 1.0.
- Efficiency framing: current ≈ **2,900 gal/kWh**, proposed ≈ **5,500 gal/kWh** (cube law).
- Suggested placement: add "Turnovers" and "Gal/kWh" columns to the existing pump-energy table + one footnote line ("4× is the fingerprint of the removed solar's flow needs, not a water-quality spec").
- Heating context now computable: ~129,000 lbs water → ~1.6 °F/hr (H250) to ~2.5 °F/hr (H400); 3:10 egg timer ≈ 5–8 °F/session. Show as "pending BTU rating" until heater ID confirmed (see §3).

### 2. Schedule editor: don't merge Speed 1 + Speed 2
Editor shows "Filtration #1: 7:00 AM–6:02 PM", collapsing Speed 1 (3250, 7:00–3:05) and Speed 2 (3000, 3:00–6:02) into one window. The timeline renders them correctly; the editor is the record — keep them as separate entries with per-window RPM fields (matches captured data incl. the 5-min overlap).

### 3. Gas cost model — visible placeholder
Energy section covers electric only. Add a "Gas (heater)" row/section marked **pending BTU rating** so the absence reads as known. Heater ID in progress (rating plate illegible/unfound; see handoff unknowns). When BTU lands: $/hr firing (BTU/100k × $/therm), $/session (×3.17 h), °F gained/session.

### 4. Verify persistence swap
Artifact used `window.storage` (claude.ai-only API). Confirm the deployed page uses `localStorage` (or equivalent) — test: edit a schedule field + notes, reload, confirm survival. If not yet swapped, this is a silent no-op bug.

### 5. Minor
- Waterfall procedure from resting SPLIT: ensure the "deck valves → POOL first" rule (spa drain-down hazard) appears wherever the waterfall egg-timer/button is described (handoff §6.5 has final wording incl. the partial-pad-valve single-valve alternative to test).
- New hazard rule for any warnings panel: **"any pad-valve diversion requires deck valves at POOL first."**

### 6. Rate table is the wrong utility — replace PG&E E-TOU-C with SMUD TOD (CRITICAL for cost credibility)
The timeline labels "E-TOU-C: 44¢/61¢" — that is a **PG&E** rate schedule. Fair Oaks electricity is **SMUD** (PG&E supplies only the gas). This inflates all $ figures ~2.8×: shown savings $214/mo, correct ≈ **$78–80/mo**. kWh math (21.4 → 6.4) is CORRECT — only the price multiplier is wrong.

Replace with SMUD Time-of-Day (5–8 p.m.) 2026 structure as an editable seasonal table (verify against Justin's actual bill; update annually):
| Season | Period | Hours | $/kWh |
|---|---|---|---|
| Summer (Jun 1–Sep 30) | Peak | Wkdy 5–8 PM | 0.3765 |
| Summer | Mid-peak | Wkdy noon–5 PM, 8 PM–midnight | 0.2139 |
| Summer | Off-peak | midnight–noon + weekends/holidays | 0.1550 |
| Winter (Oct–May) | Peak | Wkdy 5–8 PM | 0.1776 |
| Winter | Off-peak | all other hours | 0.1285 |
| **All year** | **EV discount band** | **midnight–6 AM** | **−0.015 on above** |

**Segregate the midnight–6 AM EV band as its own rate period in the model — it affects the calculus and is a target window:**
- It's the cheapest energy on the calendar (summer ≈ 14.0¢, winter ≈ 11.35¢) and coincides with Tesla charging hours.
- What-If should show per-window rate shading incl. this band, and the optimizer conversation becomes: how much of the daily gallon budget can live inside midnight–6 AM?
- Concrete lever to model: shifting the ~2600 RPM turnover run from 6:55 AM–noon into 1–6 AM saves the off-peak→EV delta (~$5–6/mo) BUT trades away daytime skimming under the trees — surface debris falls in daylight. Flag as a pool-guy question, not an automatic win. (Cube law still dominates: never raise RPM to cram gallons into the cheap band — the RPM³ penalty exceeds any rate delta. The band rewards *relocating* low-RPM hours, not compressing them.)
- Verify Justin's EV is registered at the SMUD service address (required for the discount).

Expected corrected figures at SMUD summer rates: current ≈ $3.40–3.60/day (~$105/mo, daytime block eats mid-peak), proposed ≈ $0.85/day (~$26/mo, mostly off-peak + EV band) → **savings ≈ $78–80/mo** — matching the handoff §6.5 estimate.

## Data still pending (do not block on these)
Hayward BTU (ID in progress), one high-RPM Watts reading, heater flow-switch test @1350/2600, left-timer load inventory, SunTouch AUX/lights test, spa-level test, partial-waterfall aesthetics test.
