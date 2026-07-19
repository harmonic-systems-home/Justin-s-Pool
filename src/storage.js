// Persistence for the pool app.
//
// The v3 prototype used claude.ai's `window.storage`, which doesn't exist in a
// normal browser — every call was wrapped in a silent try/catch, so state just
// quietly never saved. This replaces it with localStorage.
//
// localStorage is unavailable in a few real cases we care about: Safari blocks
// it on file:// URLs (opening dist/index.html by double-clicking), and private
// browsing / disabled-cookie modes can throw on access. Rather than let that
// break the page, fall back to an in-memory map: the app works normally, it
// just forgets between reloads. Served over https it persists as expected.

const memory = new Map();

let available;
function usable() {
  if (available === undefined) {
    try {
      const probe = "__pool_probe__";
      window.localStorage.setItem(probe, probe);
      window.localStorage.removeItem(probe);
      available = true;
    } catch {
      available = false;
    }
  }
  return available;
}

/** True when writes survive a page reload. */
export const isPersistent = () => usable();

export function load(key, fallback) {
  try {
    const raw = usable() ? window.localStorage.getItem(key) : memory.get(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    // Corrupt or hand-edited value — don't let it wedge the app on boot.
    return fallback;
  }
}

export function save(key, value) {
  const raw = JSON.stringify(value);
  try {
    if (usable()) window.localStorage.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    // Quota exceeded, or storage revoked mid-session.
    memory.set(key, raw);
  }
}
