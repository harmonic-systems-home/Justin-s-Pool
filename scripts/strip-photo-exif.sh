#!/usr/bin/env bash
# Strip identifying metadata from every image in photos/.
#
# This is a PUBLIC repo. Camera EXIF can carry GPS coordinates, capture times,
# and device serials — none of which belong on a public map of someone's home.
# Run this after adding or replacing any photo (it's also the "ingest" step the
# pre-commit hook expects you to have run). Keeps image Orientation only.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v exiftool >/dev/null 2>&1; then
  echo "exiftool not found — install it (brew install exiftool) and re-run." >&2
  exit 1
fi

shopt -s nullglob nocaseglob
files=(photos/*.jpg photos/*.jpeg photos/*.png photos/*.heic photos/*.webp)
if [ ${#files[@]} -eq 0 ]; then echo "no photos to strip."; exit 0; fi

exiftool -all= -tagsfromfile @ -Orientation -overwrite_original "${files[@]}" >/dev/null
echo "stripped ${#files[@]} file(s); verifying no GPS remains…"
if exiftool -gps:all -a -s "${files[@]}" | grep -qi gps; then
  echo "GPS STILL PRESENT after strip — aborting." >&2
  exit 1
fi
echo "clean."
