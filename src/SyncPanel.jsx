import React, { useState, useEffect, useRef } from "react";
import { load, save } from "./storage.js";
import { loadConfig, mergeConfigs } from "./config.js";
import { pull, push, isConfigured, Conflict } from "./sync.js";
import { C, mono, TextField } from "./ui.jsx";

// Cloud sync UI + logic. localStorage is the working copy; the private data repo
// (via Worker or direct PAT) is the store of record. Secrets stay in localStorage
// only, never in the synced JSON. Auto-save is debounced; conflicts (stale sha)
// refetch → merge → retry.

const KEY_SYNC = "pool-v4:sync";
// The Worker URL is public (not a secret) — baking it in lets EVERY visitor
// auto-load the redacted public view with no configuration.
const DEFAULT_WORKER_URL = "https://justins-pool-data.popperbiz.workers.dev";
const DEFAULT_SYNC = {
  mode: "worker", workerUrl: DEFAULT_WORKER_URL, passphrase: "",
  owner: "harmonic-systems-home", repo: "Justin-s-Pool-data", path: "results.json", token: "",
  by: "", autosync: true, sha: null, role: null,
};

// The password can arrive via the URL (#…&key=PASS) as well as Settings — a
// bookmarkable owner link, or a QR that logs the pool guy in as Service. Read it
// before the tab router strips the hash; which ROLE it grants is decided by the
// Worker, so the same param works for either.
function readUrlKey() {
  if (typeof location === "undefined") return "";
  const seg = location.hash.replace(/^#/, "").split("&").find((s) => s.startsWith("key="));
  return seg ? decodeURIComponent(seg.slice(4)) : "";
}

export default function SyncPanel({ config, setConfig, onAuthChange, onLevel }) {
  const bootKey = useRef(readUrlKey()).current; // captured on first render, before the hash is normalized
  const [sc, setSc] = useState(() => {
    const base = { ...DEFAULT_SYNC, ...load(KEY_SYNC, {}) };
    return bootKey ? { ...base, mode: "worker", workerUrl: base.workerUrl || DEFAULT_WORKER_URL, passphrase: bootKey } : base;
  });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({ state: "idle", msg: "" });
  const lastSynced = useRef(null); // JSON string last pushed/pulled — suppresses echo saves
  const hydrated = useRef(false);  // has THIS device pulled the record this session?
  const publicLoaded = useRef(false);
  const timer = useRef(null);

  // Only the FAMILY role unlocks sensitive fields. GitHub-direct = full access;
  // Worker role is learned from sync responses and persisted (sc.role). A
  // contractor passphrase never flips this true, and never receives the data.
  const familyAuthed = sc.mode === "github" ? !!sc.token : sc.role === "family";
  useEffect(() => { onAuthChange?.(familyAuthed); }, [familyAuthed]);

  // Privilege level for the header badge. Role is confirmed by the Worker (or the
  // GitHub PAT), so it shows View-Only until a login is verified.
  const roleNow = sc.mode === "github" ? (sc.token ? "family" : null) : sc.role;
  const level = roleNow === "family" ? "owner" : roleNow === "contractor" ? "service" : "view";
  useEffect(() => { onLevel?.(level); }, [level]);
  // Persist a URL-provided password on this device so it sticks after the hash is normalized.
  useEffect(() => { if (bootKey) save(KEY_SYNC, sc); }, []);

  const persist = (next) => { setSc(next); save(KEY_SYNC, next); };
  const setField = (k, v) => persist({ ...sc, [k]: v });
  const configured = isConfigured(sc);

  // PUBLIC auto-load: every visitor, no config, fetches the redacted public view
  // on mount so the page always shows the current published data. If the viewer
  // is family-configured, the authed hydrate below handles it instead (full view,
  // incl. private fields). If the Worker is unreachable, we silently fall back to
  // the built-in defaults.
  useEffect(() => {
    if (publicLoaded.current) return;
    publicLoaded.current = true;
    if (isConfigured(sc)) return; // family/contractor path handled by hydrate
    publicLoad();
  }, []);

  // Auto-pull the store of record on load (and the moment this device first
  // becomes configured). This is the guard against the overwrite trap: a device
  // must PULL the record before it's allowed to auto-save, so a stale local copy
  // can never clobber good cloud data. If the pull fails (offline / wrong
  // passphrase / blocked origin) we deliberately leave `hydrated` false, which
  // keeps auto-save disabled — better to not save than to overwrite.
  useEffect(() => {
    if (!configured || hydrated.current) return;
    hydrateFromCloud();
  }, [configured, sc.workerUrl, sc.passphrase, sc.token]);

  async function publicLoad() {
    const workerUrl = sc.workerUrl || DEFAULT_WORKER_URL;
    if (!workerUrl) return;
    setStatus({ state: "syncing", msg: "loading…" });
    try {
      const remote = await pull({ mode: "worker", workerUrl, passphrase: "" }); // no passphrase → public view
      if (remote.json) {
        setConfig(loadConfig(remote.json));
        setStatus({ state: "ok", msg: "showing published data (read-only)" });
      } else {
        setStatus({ state: "idle", msg: "" });
      }
    } catch {
      setStatus({ state: "idle", msg: "" }); // Worker down → built-in defaults
    }
  }

  // Debounced auto-save on config change — only AFTER a successful pull.
  useEffect(() => {
    if (!configured || !sc.autosync) return;
    if (!hydrated.current) return; // never auto-push before we've pulled the record
    const serial = JSON.stringify(config);
    if (serial === lastSynced.current) return; // echo of a pull/push, or nothing changed
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { doPush(); }, 3000);
    return () => clearTimeout(timer.current);
  }, [config, sc.autosync, sc.workerUrl, sc.passphrase, sc.token]);

  async function hydrateFromCloud() {
    setStatus({ state: "syncing", msg: "loading from cloud…" });
    try {
      const remote = await pull(sc);
      if (remote.json) {
        const full = loadConfig(remote.json);
        lastSynced.current = JSON.stringify(full);
        setConfig(full);
        persist({ ...sc, sha: remote.sha, role: remote.role });
        setStatus({ state: "ok", msg: `loaded from cloud ${clock()}` });
      } else {
        // Cloud is empty — this device will seed it. Safe to auto-save.
        lastSynced.current = JSON.stringify(config);
        persist({ ...sc, sha: remote.sha, role: remote.role });
        setStatus({ state: "ok", msg: "cloud empty — Sync now to seed it" });
      }
      hydrated.current = true; // auto-save now permitted
    } catch (e) {
      setStatus({ state: "error", msg: `couldn't load from cloud: ${String(e.message || e)} — auto-save paused` });
    }
  }

  async function doPush() {
    if (!hydrated.current) {
      setStatus({ state: "error", msg: "load the cloud copy first (Pull cloud) — protects the shared record" });
      return;
    }
    setStatus({ state: "syncing", msg: "saving…" });
    const snapshot = config;
    try {
      const { sha, role } = await push(sc, snapshot, sc.sha, sc.by);
      lastSynced.current = JSON.stringify(snapshot);
      persist({ ...sc, sha, role });
      setStatus({ state: "ok", msg: `saved ${clock()}${role === "contractor" ? " (visit log)" : ""}` });
    } catch (e) {
      if (e instanceof Conflict) return resolveConflict(snapshot);
      setStatus({ state: "error", msg: String(e.message || e) });
    }
  }

  async function resolveConflict(localSnapshot) {
    setStatus({ state: "syncing", msg: "merging…" });
    try {
      const remote = await pull(sc);
      const merged = mergeConfigs(remote.json || {}, localSnapshot); // local wins scalars, keyed objects union
      const full = loadConfig(merged);
      lastSynced.current = JSON.stringify(full);
      setConfig(full);
      const { sha, role } = await push(sc, full, remote.sha, sc.by);
      persist({ ...sc, sha, role });
      setStatus({ state: "ok", msg: `merged + saved ${clock()}` });
    } catch (e) {
      setStatus({ state: "error", msg: String(e.message || e) });
    }
  }

  async function doPull() {
    setStatus({ state: "syncing", msg: "loading…" });
    try {
      const remote = await pull(sc);
      if (!remote.json) { persist({ ...sc, sha: remote.sha, role: remote.role }); hydrated.current = true; setStatus({ state: "ok", msg: "cloud is empty — Sync now to seed it" }); return; }
      const full = loadConfig(remote.json);
      lastSynced.current = JSON.stringify(full);
      setConfig(full);
      persist({ ...sc, sha: remote.sha, role: remote.role });
      hydrated.current = true; // a manual pull is a valid hydration → auto-save on
      setStatus({ state: "ok", msg: `pulled ${clock()}${remote.role === "contractor" ? " (visit log — public view)" : ""}` });
    } catch (e) {
      setStatus({ state: "error", msg: String(e.message || e) });
    }
  }

  const dot = { idle: C.pipe, syncing: C.timer, ok: C.ok, error: C.warn, conflict: C.warn }[status.state];
  const tool = { font: mono(11, 600), padding: "6px 10px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.pipe}`, background: "#fff", color: C.faint };
  const field = { font: mono(11.5), padding: "6px 8px", border: `1.5px solid ${C.timer}`, borderRadius: 8, color: C.ink, background: "#fff", width: "100%", boxSizing: "border-box" };
  const lbl = { font: mono(10.5, 600), color: C.faint, display: "block", margin: "0 0 3px" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.pipe}`, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot, display: "inline-block" }} />
        <span style={{ font: mono(12, 600), color: C.ink }}>Cloud sync</span>
        <span style={{ font: mono(11), color: status.state === "error" ? C.warn : C.faint }}>
          {status.msg || (configured ? (sc.autosync ? "auto-save on" : "manual") : "read-only — enter the password in Settings to edit")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {configured && <button style={tool} onClick={doPush}>Sync now</button>}
          {configured && <button style={tool} onClick={doPull} title="overwrite local with the cloud copy">Pull cloud</button>}
          <button style={tool} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Settings"}</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.pad}`, paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", font: mono(11.5), marginBottom: 8 }}>
            <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
              <input type="radio" checked={sc.mode === "worker"} onChange={() => setField("mode", "worker")} /> Worker (Justin — passphrase)
            </label>
            <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
              <input type="radio" checked={sc.mode === "github"} onChange={() => setField("mode", "github")} /> GitHub direct (Rick — PAT)
            </label>
            <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer", color: C.faint }}>
              <input type="checkbox" checked={sc.autosync} onChange={(e) => setField("autosync", e.target.checked)} /> auto-save
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {sc.mode === "worker" ? (
              <>
                <div><span style={lbl}>Worker URL</span><input style={field} value={sc.workerUrl} placeholder="https://…workers.dev" onChange={(e) => setField("workerUrl", e.target.value)} /></div>
                <div><span style={lbl}>Passphrase</span><input style={field} type="password" value={sc.passphrase} placeholder="the pool password" onChange={(e) => setField("passphrase", e.target.value)} /></div>
              </>
            ) : (
              <>
                <div><span style={lbl}>Owner</span><input style={field} value={sc.owner} onChange={(e) => setField("owner", e.target.value)} /></div>
                <div><span style={lbl}>Repo (private)</span><input style={field} value={sc.repo} onChange={(e) => setField("repo", e.target.value)} /></div>
                <div><span style={lbl}>File path</span><input style={field} value={sc.path} onChange={(e) => setField("path", e.target.value)} /></div>
                <div><span style={lbl}>Fine-grained PAT</span><input style={field} type="password" value={sc.token} placeholder="github_pat_…" onChange={(e) => setField("token", e.target.value)} /></div>
              </>
            )}
            <div><span style={lbl}>Recorded by</span><input style={field} value={sc.by} placeholder="your name (commit attribution)" onChange={(e) => setField("by", e.target.value)} /></div>
          </div>

          <div style={{ font: mono(10), color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
            Secrets are stored on this device only (localStorage), never in the synced file. On load this device <b>pulls the cloud copy first</b>, and won't auto-save until it has — so a stale device can't overwrite the shared record. First time on an empty cloud: <b>Sync now</b> seeds it. See <code>worker/README.md</code> for deploy steps.
          </div>
        </div>
      )}
    </div>
  );
}

function clock() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
