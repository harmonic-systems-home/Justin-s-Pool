// Two-tier sync client. Same JSON contract both ways:
//   pull(cfg)              -> { json, sha }         (json null if not created yet)
//   push(cfg, json, sha)   -> newSha                (throws Conflict on stale sha)
//
// Tier 1 (mode 'worker'): app → Cloudflare Worker, passphrase header. Normal path.
// Tier 2 (mode 'github'): app → GitHub Contents API directly with a personal PAT.
// Secrets (passphrase / token) live in localStorage only — never in results.json.

export class Conflict extends Error {
  constructor() { super("conflict"); this.conflict = true; }
}

const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));
const b64decode = (b64) => decodeURIComponent(escape(atob(b64)));
const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});
const trim = (u) => (u || "").replace(/\/+$/, "");

export function isConfigured(cfg) {
  if (!cfg) return false;
  if (cfg.mode === "worker") return !!(cfg.workerUrl && cfg.passphrase);
  if (cfg.mode === "github") return !!(cfg.token && cfg.owner && cfg.repo && cfg.path);
  return false;
}

export async function pull(cfg) {
  if (cfg.mode === "worker") {
    const res = await fetch(`${trim(cfg.workerUrl)}/data`, { headers: { "X-Pool-Auth": cfg.passphrase } });
    if (res.status === 401) throw new Error("Wrong passphrase");
    if (!res.ok) throw new Error(`Worker GET ${res.status}`);
    return res.json(); // { json, sha }
  }
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const res = await fetch(url, { headers: ghHeaders(cfg.token) });
  if (res.status === 404) return { json: null, sha: null, role: "family" };
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data = await res.json();
  return { json: JSON.parse(b64decode(data.content)), sha: data.sha, role: "family" };
}

// Returns { sha, role }. role is "family" for GitHub-direct (full repo access)
// and for a legacy single-passphrase Worker that doesn't report one.
export async function push(cfg, json, sha, by) {
  if (cfg.mode === "worker") {
    const res = await fetch(`${trim(cfg.workerUrl)}/data`, {
      method: "PUT",
      headers: { "X-Pool-Auth": cfg.passphrase, "Content-Type": "application/json" },
      body: JSON.stringify({ json, sha, by }),
    });
    if (res.status === 409) throw new Conflict();
    if (res.status === 401) throw new Error("Wrong passphrase");
    if (!res.ok) throw new Error(`Worker PUT ${res.status}`);
    const out = await res.json();
    return { sha: out.sha, role: out.role || "family" };
  }
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const body = { message: `Update results${by ? ` (by ${by})` : ""}`, content: b64encode(JSON.stringify(json, null, 2)) };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(cfg.token), body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422) throw new Conflict();
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}`);
  return { sha: (await res.json()).content.sha, role: "family" };
}
