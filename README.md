# Justin's Pool — System Map

Interactive system map, simulator, and operating manual for the pool equipment pad
at a property in Fair Oaks, CA. Built for a non-technical owner: tap equipment and
valves to see what actually flows where, and follow the documented procedures for
heating the pool or spa.

Full equipment survey, hydraulic topology, control architecture, and the open
field-checklist live in [POOL-SYSTEM-HANDOFF.md](POOL-SYSTEM-HANDOFF.md).

## Developing

Requires Node 18+.

```sh
npm install
npm run dev      # hot-reloading dev server
```

## Building

```sh
npm run build
```

Produces **`dist/index.html`** — a single self-contained file with all JS and CSS
inlined. Nothing else from `dist/` is needed. You can open it directly in a
browser to check it, or drop it on the web server.

Deploy by copying that one file to harmonicsystems.com.

### Preview on GitHub Pages

Pushes to `main` build and publish automatically via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), to:

<https://harmonic-systems-home.github.io/Justin-s-Pool/>

This needs **Settings → Pages → Source: GitHub Actions** set once on the repo.
It's a staging preview — harmonicsystems.com remains the intended home.

### Two notes on opening the built file directly

- **State won't persist.** Safari blocks `localStorage` on `file://` URLs. The app
  detects this, falls back to in-memory storage, and shows a note in the footer.
  Served over https it saves normally.
- **Fonts fall back.** IBM Plex Mono and Barlow Semi Condensed load from Google
  Fonts, so offline you'll get system defaults. Layout is unaffected.

## Data & sync

Working state lives in `localStorage`; the **store of record** is a private repo,
written through a Cloudflare Worker so the GitHub token never reaches the browser.
Two tiers, one JSON contract — see [worker/README.md](worker/README.md) for the design.

**Live as of 2026-07-25:**

- **Data repo (private):** `harmonic-systems-home/Justin-s-Pool-data` → `results.json`
  (one commit per save, attributed to the app's "Recorded by" name).
- **Worker:** <https://justins-pool-data.popperbiz.workers.dev> — `GET/PUT /data`,
  passphrase-gated (`X-Pool-Auth`), CORS locked to the Pages origin.
- **Secrets** (`GH_TOKEN` = fine-grained PAT, Contents-only on the data repo;
  `POOL_PASSPHRASE`) live **only** as Worker secrets. The passphrase Justin types is
  cached only in his own device's `localStorage`. Rotate the PAT any time with
  `npx wrangler secret put GH_TOKEN` from `worker/` — nothing else changes.
- **In the app:** *Cloud sync → Settings*. Tier 1 (Justin) = Worker URL + passphrase;
  Tier 2 (Rick) = GitHub-direct fine-grained PAT, as a fallback.
- **Sensitive fields** (pool-guy fee, contract #) ship empty in the public bundle and
  arrive only via authenticated sync — so the URL is safe to share.

## Layout

| Path | What it is |
|---|---|
| `src/App.jsx` | Tab shell — config state, persistence, tab nav, JSON export/import |
| `src/config.js` | **Single source of truth** (schedules, rates, volumes, commissioning…) + provenance stamps |
| `src/tabs/` | The seven tabs: Daily Operation, Maintenance, Pool Design, Costs, What If, Commissioning, History |
| `src/tou.js`, `src/energy.js` | SMUD TOD cost model + pump physics (affinity law, measured-Watts override) |
| `src/simulate.js` | Hydraulic solver (active/heated edges, warnings) for the Daily schematic |
| `src/Timeline.jsx`, `src/IntermaticDial.jsx`, `src/ScheduleEditor.jsx`, `src/ui.jsx` | Shared components + design system |
| `src/sync.js`, `src/SyncPanel.jsx`, `src/storage.js` | Cloud-sync client + UI + `localStorage` fallback |
| `worker/` | Cloudflare Worker — private data-repo proxy |
| `pool-flow-v3.jsx` | Original claude.ai prototype, kept for reference |

## Roadmap

Pending field data (Commissioning tab captures results and flips EST/PENDING → MEASURED):

1. **Heater BTU** — clock the gas meter → populates the gas cost model + °F/session.
2. **Watts per configured speed** — measured points override the affinity-law estimates.
3. **SMUD rate + EV-discount verification** against Justin's bill.
4. **Split-fraction calibration** (drain-rate test) → pool-at-split turnover math.
5. **Volume refinement** (1-inch refill test) → measured surface area.
6. **Lighting reverse-engineering** (L-series) + remediation tasks (cap solar stub, etc.).
7. **Printable one-pager** for the garage wall; per-component photo attachments.
