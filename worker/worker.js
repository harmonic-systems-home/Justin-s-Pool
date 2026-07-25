// Cloudflare Worker — data proxy for Justin's Pool.
//
// Holds ONE fine-grained GitHub PAT (Contents-only, on the PRIVATE data repo) as
// a secret, so the public app never sees it and Justin never touches GitHub. The
// app calls GET/PUT `/data`; the Worker proxies the GitHub Contents API
// (fetch SHA → PUT with SHA). Auth is a shared passphrase header; CORS is locked
// to the Pages origin.
//
// Secrets (wrangler secret put):  GH_TOKEN, POOL_PASSPHRASE
// Vars (wrangler.toml):           OWNER, REPO, FILE_PATH, ALLOW_ORIGIN

const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));
const b64decode = (b64) => decodeURIComponent(escape(atob(b64)));

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Pool-Auth",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (body, status, env) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(env) } });

const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${env.OWNER}/${env.REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "justins-pool-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname !== "/data") return json({ error: "not found" }, 404, env);

    // Shared-passphrase auth. Justin types it once per device.
    if ((request.headers.get("X-Pool-Auth") || "") !== env.POOL_PASSPHRASE)
      return json({ error: "unauthorized" }, 401, env);

    const path = env.FILE_PATH || "results.json";

    if (request.method === "GET") {
      const res = await gh(env, path);
      if (res.status === 404) return json({ json: null, sha: null }, 200, env); // not created yet
      if (!res.ok) return json({ error: "github", status: res.status }, 502, env);
      const data = await res.json();
      return json({ json: JSON.parse(b64decode(data.content)), sha: data.sha }, 200, env);
    }

    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad body" }, 400, env); }
      const put = {
        message: `Update results${body.by ? ` (by ${body.by})` : ""}`,
        content: b64encode(JSON.stringify(body.json, null, 2)),
      };
      if (body.sha) put.sha = body.sha;
      const res = await gh(env, path, { method: "PUT", body: JSON.stringify(put) });
      if (res.status === 409 || res.status === 422)
        return json({ error: "conflict" }, 409, env); // stale sha → client refetches + merges
      if (!res.ok) return json({ error: "github", status: res.status }, 502, env);
      const data = await res.json();
      return json({ sha: data.content.sha }, 200, env);
    }

    return json({ error: "method" }, 405, env);
  },
};
