// Cloudflare Worker — data proxy for Justin's Pool.
//
// Holds the fine-grained GitHub PAT (Contents-only, PRIVATE data repo) as a
// secret so the public app never sees it. The app calls GET/PUT `/data`.
//
// TWO ROLES, scoped here at the Worker (branch on which passphrase authenticated):
//   FAMILY     (FAMILY_PASSPHRASE, or legacy POOL_PASSPHRASE) — full: writes the
//              whole document, reads sensitive fields.
//   CONTRACTOR (CONTRACTOR_PASSPHRASE) — writes ONLY the `visitLog` namespace
//              (read-modify-write, can't touch anything else) and reads PUBLIC
//              only: the sensitive `private` bucket is stripped from its reads,
//              so the pool guy can log work without ever seeing the fee.
//
// Secrets: GH_TOKEN, FAMILY_PASSPHRASE (or POOL_PASSPHRASE), CONTRACTOR_PASSPHRASE
// Vars (wrangler.toml): OWNER, REPO, FILE_PATH, ALLOW_ORIGIN

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

// Which role does this passphrase grant? null = unauthorized.
function roleFor(pass, env) {
  const family = env.FAMILY_PASSPHRASE || env.POOL_PASSPHRASE;
  if (family && pass === family) return "family";
  if (env.CONTRACTOR_PASSPHRASE && pass === env.CONTRACTOR_PASSPHRASE) return "contractor";
  return null;
}

// Contractors never receive the sensitive bucket (redaction by absence).
const publicView = (doc) => {
  if (doc && typeof doc === "object" && "private" in doc) {
    const { private: _omit, ...rest } = doc;
    return rest;
  }
  return doc;
};

async function readDoc(env, path) {
  const res = await gh(env, path);
  if (res.status === 404) return { doc: null, sha: null };
  if (!res.ok) throw new Error(`github ${res.status}`);
  const data = await res.json();
  return { doc: JSON.parse(b64decode(data.content)), sha: data.sha };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname !== "/data") return json({ error: "not found" }, 404, env);

    const role = roleFor(request.headers.get("X-Pool-Auth") || "", env);
    if (!role) return json({ error: "unauthorized" }, 401, env);

    const path = env.FILE_PATH || "results.json";

    try {
      if (request.method === "GET") {
        const { doc, sha } = await readDoc(env, path);
        const out = role === "contractor" ? publicView(doc) : doc;
        return json({ json: out, sha, role }, 200, env);
      }

      if (request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad body" }, 400, env); }

        if (role === "contractor") {
          // Read-modify-write ONLY the visitLog namespace. Nothing the contractor
          // sends can alter (or reveal) any other field, including `private`.
          const { doc, sha } = await readDoc(env, path);
          const merged = { ...(doc || {}), visitLog: (body.json && body.json.visitLog) || (doc && doc.visitLog) || [] };
          const put = { message: `Update visit log (by ${body.by || "contractor"})`, content: b64encode(JSON.stringify(merged, null, 2)) };
          if (sha) put.sha = sha;
          const res = await gh(env, path, { method: "PUT", body: JSON.stringify(put) });
          if (res.status === 409 || res.status === 422) return json({ error: "conflict" }, 409, env);
          if (!res.ok) return json({ error: "github", status: res.status }, 502, env);
          return json({ sha: (await res.json()).content.sha, role }, 200, env);
        }

        // family: full write, sha-guarded (client resolves 409).
        const put = {
          message: `Update results${body.by ? ` (by ${body.by})` : ""}`,
          content: b64encode(JSON.stringify(body.json, null, 2)),
        };
        if (body.sha) put.sha = body.sha;
        const res = await gh(env, path, { method: "PUT", body: JSON.stringify(put) });
        if (res.status === 409 || res.status === 422) return json({ error: "conflict" }, 409, env);
        if (!res.ok) return json({ error: "github", status: res.status }, 502, env);
        return json({ sha: (await res.json()).content.sha, role }, 200, env);
      }
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, env);
    }

    return json({ error: "method" }, 405, env);
  },
};
