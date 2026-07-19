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

## Layout

| Path | What it is |
|---|---|
| `src/PoolSystem.jsx` | The whole app — schematic, simulation, procedures, warnings |
| `src/storage.js` | `localStorage` persistence with in-memory fallback |
| `src/main.jsx` | React entry point |
| `pool-flow-v3.jsx` | Original claude.ai prototype, kept for reference |

## Roadmap

From §8 of the handoff doc, pending field data:

1. **Cost model** — real BTU rating + measured Watts per pump speed + SMUD/PG&E
   rates, for live $/hr and per-procedure estimates. The current `$8.8/hr` gas
   figure in `solve()` is a placeholder.
2. **Printable one-pager** for the garage wall.
3. **Timeline view** — 24 h strip showing IntelliFlo windows, booster window, and
   manual heat runs, making clock disagreements visible.
4. Replace the editable time strings with structured schedule objects once the
   real IntelliFlo menu values are read.
5. Photo attachments per component.
