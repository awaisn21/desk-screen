#!/bin/bash
# Run this once from your terminal to remove all redundant files.
# After running: git add -A && git commit -m "Clean art/ — remove redundant formats"
# then git push.

set -e
cd "$(dirname "$0")"

echo "Cleaning desk-screen..."

# ── art/: remove SVG originals (converted to JPG) ────────────────────────────
rm -f art/*.svg
echo "  removed SVGs"

# ── art/: remove last abstract webp straggler ────────────────────────────────
rm -f art/1a-volcanic-night.webp
echo "  removed abstract webp"

# ── art/: remove huge Pakistan JPG originals (keeping the small webps) ───────
rm -f art/pk-01-J-ReK9-49vE.jpg
rm -f art/pk-02-4dz8IdRLILA.jpg
rm -f art/pk-03-ZWqyPO3bAbI.jpg
rm -f art/pk-04-safak-FnLaZ0yK19I.jpg
rm -f art/pk-05-safak-NT3oIjHbegU.jpg
rm -f art/pk-06-Li-NSmPsFBk.jpg
rm -f art/pk-07-l_lGkl0M6r8.jpg
echo "  removed Pakistan jpg originals"

# ── art/: remove new Unsplash JPGs (converted to pk-08/09/10.webp already) ──
rm -f "art/huzaifa-waheed-cWr9DucW88o-unsplash.jpg"
rm -f "art/kehkishan-sabir-BDbBlJBdBi4-unsplash.jpg"
rm -f "art/muhammad-hussam-ud-din-6y70tkORY38-unsplash.jpg"
echo "  removed Unsplash jpg originals"

# ── art/webp_out/: duplicate of pk webps ─────────────────────────────────────
rm -rf art/webp_out
echo "  removed art/webp_out/"

# ── art/placeholders/: empty ──────────────────────────────────────────────────
rm -rf art/placeholders
echo "  removed art/placeholders/"

# ── art/video/: unused MP4s (removed from backgrounds.js) ────────────────────
rm -rf art/video
echo "  removed art/video/"

# ── root: stale loose JS copies (index.html loads from src/) ─────────────────
rm -f app.js backgrounds.js engine-ambient.js engine-files.js \
      engine-spotify.js engine-youtube.js intention.js themes.js
echo "  removed stale root-level JS copies"

# ── misc junk ─────────────────────────────────────────────────────────────────
rm -f art/.DS_Store .DS_Store
echo "  removed .DS_Store files"

# ── regenerate backgrounds.js + sw.js ────────────────────────────────────────
python3 sync.py
echo ""

# ── stage and commit ─────────────────────────────────────────────────────────
git add -A
git commit -m "Clean: remove redundant formats, add pk-08/09/10

- Deleted: 7 SVG originals (superseded by JPG)
- Deleted: abstract .webp stragglers
- Deleted: pk-01 through pk-07 .jpg originals (keeping .webp, 90% smaller)
- Deleted: art/webp_out/ (duplicate pk webps)
- Deleted: art/placeholders/ (empty)
- Deleted: art/video/ (4 unused MP4s)
- Deleted: root-level stale JS copies (index.html loads from src/)
- Added:   pk-08-huzaifa.webp, pk-09-kehkishan.webp, pk-10-muhammad-hussam.webp
- sw.js bumped to v$(grep -o 'desk-screen-v[0-9]*' sw.js | grep -o '[0-9]*$')"

echo ""
echo "Done. Run: git push"
