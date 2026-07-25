# Pool Pump Schedule — Pentair IntelliFlo VS

**Captured:** July 20, 2026, ~10:15 PM (read-only, no settings changed)
**Controller:** Pentair IntelliFlo VS (4-speed keypad)

## Speed Settings

| Speed | Mode | RPM | Start | Stop |
|-------|----------|------|----------|----------|
| 1 | Schedule | 3250 | 7:00 AM | 3:05 PM |
| 2 | Schedule | 3000 | 3:00 PM | 6:02 PM |
| 3 | Egg-timer | 3450 | — | 3:10 duration |
| 4 | Manual | 3030 | — | — |
| 5 | Schedule | 1350 | 6:50 PM | 6:55 AM |
| 6 | Disabled | — | — | — |
| 7 | Disabled | — | — | — |
| 8 | Disabled | — | — | — |

## Daily Cycle

- **7:00 AM – 3:05 PM** — Speed 1 at 3250 RPM (high; main daytime turnover, ~8 hrs)
- **3:00 PM – 6:02 PM** — Speed 2 at 3000 RPM (afternoon)
- **6:50 PM – 6:55 AM** — Speed 5 at 1350 RPM (overnight low, ~12 hrs)

## Notes

- **Evening gap:** No schedule covers ~6:02 PM–6:50 PM (about 48 min idle each evening). May be intentional or an oversight.
- **Overlap 3:00–3:05 PM:** Speeds 1 and 2 overlap for 5 min. Per the pump's priority rule, the higher RPM wins, so Speed 1 (3250) runs those minutes, then Speed 2 takes over. Harmless.
- **Speed 3 (Egg-timer, 3450 RPM):** On-demand only — runs for a 3 hr 10 min duration when triggered, not tied to the clock.
- **Speed 4 (Manual, 3030 RPM):** On-demand button, not scheduled.

## Reference — Read-Only Navigation

- **Menu** opens the menu (pump must be stopped; pressing Menu stops it).
- **Select (✗)** drills into an item. **Escape (←)** backs up / cancels. **Enter** only *saves* — never needed for viewing; pressing it where nothing can be saved gives a harmless "Key Error! Key not in use!"
- **Exit:** press **Start/Stop** to leave the menu and re-arm the schedule (display returns to "Running Schedule" / "Running Speed X").
