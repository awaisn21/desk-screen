#!/bin/bash
# Run once from your terminal to remove all redundant files.
# After running, git push.

set -e
cd "$(dirname "$0")"
echo "Cleaning desk-screen..."

# ── art/ root: flat files now live in art/abstract/ and art/pakistan/ ────────
rm -f art/*.jpg art/*.webp art/*.svg art/.DS_Store
echo "  removed flat art/ root files (kept subdirs)"

# ── old cruft directories ─────────────────────────────────────────────────────
rm -rf art/webp_out art/placeholders art/video
echo "  removed art/webp_out/, art/placeholders/, art/video/"

# ── root: stale loose JS copies (index.html loads from src/) ─────────────────
rm -f app.js backgrounds.js engine-ambient.js engine-files.js \
      engine-spotify.js engine-youtube.js intention.js themes.js
echo "  removed stale root-level JS copies"

# ── misc junk ─────────────────────────────────────────────────────────────────
rm -f .DS_Store
echo "  removed .DS_Store"

# ── stage and commit ─────────────────────────────────────────────────────────
git add -A
git commit -m "Clean: remove all redundant art/ root files

Files now live exclusively in art/abstract/ and art/pakistan/.
Removed SVGs, duplicate JPG/WebP originals, webp_out/, placeholders/,
art/video/, and stale root-level JS copies."

echo ""
echo "Done. Run: git push"
