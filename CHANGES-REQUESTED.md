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

## Data still pending (do not block on these)
Hayward BTU (ID in progress), one high-RPM Watts reading, heater flow-switch test @1350/2600, left-timer load inventory, SunTouch AUX/lights test, spa-level test, partial-waterfall aesthetics test.
