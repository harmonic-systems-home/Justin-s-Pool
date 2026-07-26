import React, { useState } from "react";
import { C, mono, Card } from "../ui.jsx";
import manifest from "../../photos/manifest.json";

// Gallery of survey + reference photography, served from photos/ (copied next to
// the single-file build). Grouped by category with the annotated system maps
// first — those are the operating references. Tap to zoom. All photos are EXIF-
// stripped before commit (pre-commit hook + CI guard); see scripts/.

const ORDER = ["Annotated system maps", "Equipment closeups", "Electrical", "Deck & valves", "Historical"];
const rank = (c) => { const i = ORDER.indexOf(c); return i === -1 ? 99 : i; };
const src = (file) => `photos/${encodeURIComponent(file)}`;

export default function Photos() {
  const [zoom, setZoom] = useState(null);
  const photos = manifest.photos || [];
  const cats = [...new Set(photos.map((p) => p.category))].sort((a, b) => rank(a) - rank(b));

  return (
    <div>
      {photos.length === 0 && <Card>No photos yet — drop images in <code>photos/</code>, run <code>scripts/strip-photo-exif.sh</code>, and add them to <code>manifest.json</code>.</Card>}

      {cats.map((cat) => (
        <Card key={cat} title={cat}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {photos.filter((p) => p.category === cat).map((p) => (
              <figure key={p.file} style={{ margin: 0, cursor: "zoom-in" }} onClick={() => setZoom(p)}>
                <img src={src(p.file)} alt={p.caption} loading="lazy"
                  style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.pipe}`, display: "block", background: C.pad }} />
                <figcaption style={{ font: mono(10.5), color: C.faint, marginTop: 4, lineHeight: 1.4 }}>
                  {p.caption}{p.date ? ` · ${p.date}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      ))}

      <div style={{ font: mono(10.5), color: C.faint, lineHeight: 1.5 }}>
        Every photo is stripped of location/EXIF metadata before it lands (a pre-commit hook plus a CI guard fail on any GPS tag). Tap a photo to zoom.
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,20,24,0.88)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={src(zoom.file)} alt={zoom.caption} style={{ maxWidth: "96%", maxHeight: "86%", objectFit: "contain", borderRadius: 6 }} />
          <div style={{ color: "#fff", font: mono(12), marginTop: 10, textAlign: "center", maxWidth: 700 }}>{zoom.caption}{zoom.date ? ` · ${zoom.date}` : ""}</div>
        </div>
      )}
    </div>
  );
}
