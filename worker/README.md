# Data-sync backend

Keeps commissioning data **private** while the app repo + GitHub Pages stay public and free. Two moving parts:

1. **Private data repo** — `Justin-s-Pool-data`, holding a single `results.json` (the app's config). Every save is a commit → history, diffs, and attribution (the "recorded by" name lands in the commit message).
2. **This Cloudflare Worker** — proxies GitHub's Contents API so the fine-grained token never reaches the browser. The app talks to the Worker; the Worker talks to GitHub.

The app is a two-tier client (see the in-app **Sync** panel):

- **Tier 1 — Justin (zero-GitHub):** app → Worker, authed by a shared passphrase entered once per device. This is the normal path.
- **Tier 2 — Rick (admin/fallback):** app → GitHub API directly with a personal fine-grained PAT pasted into the Sync panel. Use if the Worker is ever down.

`localStorage` is always the working copy; Sync is the store of record.

## One-time setup

1. **Create the private repo** (empty is fine — the app creates `results.json` on first push):
   ```
   gh repo create harmonic-systems-home/Justin-s-Pool-data --private
   ```
2. **Create a fine-grained PAT** (github.com → Settings → Developer settings → Fine-grained tokens):
   - Resource owner: `harmonic-systems-home`
   - Repository access: **Only** `Justin-s-Pool-data`
   - Permissions: **Contents → Read and write** (nothing else)
   - Copy the token.
3. **Deploy the Worker** (from this `worker/` dir):
   ```
   npm i -g wrangler        # if needed
   wrangler login
   wrangler deploy
   wrangler secret put GH_TOKEN          # paste the PAT
   wrangler secret put POOL_PASSPHRASE   # choose the "pool password"
   ```
   Note the deployed URL (e.g. `https://justins-pool-data.<subdomain>.workers.dev`).
4. **In the app** → Sync panel → mode **Worker**, paste the Worker URL + passphrase, hit **Sync now**.
   - Confirm `ALLOW_ORIGIN` in `wrangler.toml` matches the Pages origin exactly, then re-`wrangler deploy` if you change it.

## Maintenance

- **Token rotation** (annual): regenerate the PAT, `wrangler secret put GH_TOKEN` again. Nothing else changes; Justin's devices keep working.
- **Endpoints:** `GET /data` → `{ json, sha }`; `PUT /data` `{ json, sha, by }` → `{ sha }` (409 on stale sha, which the app resolves by refetch + merge + retry).
