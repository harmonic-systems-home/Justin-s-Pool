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
const DEFAULT_SYNC = {
  mode: "worker", workerUrl: "", passphrase: "",
  owner: "harmonic-systems-home", repo: "Justin-s-Pool-data", path: "results.json", token: "",
  by: "", autosync: true, sha: null,
};

export default function SyncPanel({ config, setConfig, onAuthChange }) {
  const [sc, setSc] = useState(() => ({ ...DEFAULT_SYNC, ...load(KEY_SYNC, {}) }));
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({ state: "idle", msg: "" });
  const lastSynced = useRef(null); // JSON string last pushed/pulled — suppresses echo saves
  const timer = useRef(null);

  // "Authed" = a secret is present on this device → sensitive fields may be shown/edited.
  const authed = sc.mode === "worker" ? !!sc.passphrase : !!sc.token;
  useEffect(() => { onAuthChange?.(authed); }, [authed]);

  const persist = (next) => { setSc(next); save(KEY_SYNC, next); };
  const setField = (k, v) => persist({ ...sc, [k]: v });
  const configured = isConfigured(sc);

  // Debounced auto-save on config change.
  useEffect(() => {
    if (!configured || !sc.autosync) return;
    const serial = JSON.stringify(config);
    if (serial === lastSynced.current) return; // echo of a pull/push, or nothing changed
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { doPush(); }, 3000);
    return () => clearTimeout(timer.current);
  }, [config, sc.autosync, sc.workerUrl, sc.passphrase, sc.token]);

  async function doPush() {
    setStatus({ state: "syncing", msg: "saving…" });
    const snapshot = config;
    try {
      const sha = await push(sc, snapshot, sc.sha, sc.by);
      lastSynced.current = JSON.stringify(snapshot);
      persist({ ...sc, sha });
      setStatus({ state: "ok", msg: `saved ${clock()}` });
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
      const sha = await push(sc, full, remote.sha, sc.by);
      persist({ ...sc, sha });
      setStatus({ state: "ok", msg: `merged + saved ${clock()}` });
    } catch (e) {
      setStatus({ state: "error", msg: String(e.message || e) });
    }
  }

  async function doPull() {
    setStatus({ state: "syncing", msg: "loading…" });
    try {
      const remote = await pull(sc);
      if (!remote.json) { persist({ ...sc, sha: remote.sha }); setStatus({ state: "ok", msg: "cloud is empty — Sync now to seed it" }); return; }
      const full = loadConfig(remote.json);
      lastSynced.current = JSON.stringify(full);
      setConfig(full);
      persist({ ...sc, sha: remote.sha });
      setStatus({ state: "ok", msg: `pulled ${clock()}` });
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
          {configured ? (status.msg || (sc.autosync ? "auto-save on" : "manual")) : "not configured"}
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
            Secrets are stored on this device only (localStorage), never in the synced file. First time: <b>Sync now</b> seeds the data repo from this device. See <code>worker/README.md</code> for deploy steps.
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
