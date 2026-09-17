#!/usr/bin/env python3
"""
Desk Screen — folder sync.

Reads whatever is sitting in music/ and art/ and writes the two lists the
page reads at load time:

    music/  ->  tracks.js       window.TRACKS
    art/    ->  backgrounds.js  window.BACKGROUNDS
    art/    ->  sw.js           (bumps cache version + rewrites art list)

Run it whenever you add or remove files. start.command runs it for you.
A git pre-commit hook also runs it automatically before every commit.

NAMING CONVENTION
  art/pk-*.jpg / art/pk-*.webp  →  Pakistan theme
  art/*.jpg / art/*.webp         →  Abstract theme  (anything not pk-)

Track titles come from the file's own tags when ffprobe is installed
(it ships with ffmpeg). Without tags, the filename is used, and a name in
the form "Artist - Title.mp3" is split on the dash.

Background base colours — the flat tone shown for the instant before an
image decodes — come from ffmpeg when it is installed, and fall back to a
neutral dark otherwise.
"""

import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MUSIC_DIR = os.path.join(ROOT, "music")
ART_DIR      = os.path.join(ROOT, "art")
ART_ABSTRACT = os.path.join(ROOT, "art", "abstract")
ART_PAKISTAN = os.path.join(ROOT, "art", "pakistan")
VIDEO_DIR = os.path.join(ROOT, "video")
SW_PATH   = os.path.join(ROOT, "sw.js")
BG_PATH   = os.path.join(ROOT, "src", "backgrounds.js")

AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".weba"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif"}   # svg intentionally excluded
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}

FFPROBE = shutil.which("ffprobe")
FFMPEG  = shutil.which("ffmpeg")

BANNER = "/* Written by sync.py — your edits here are replaced on the next run. */\n"


# ── helpers ──────────────────────────────────────────────────────────────────

def listing(folder, extensions):
    if not os.path.isdir(folder):
        return []
    names = [
        n for n in os.listdir(folder)
        if not n.startswith(".")
        and os.path.isfile(os.path.join(folder, n))
        and os.path.splitext(n)[1].lower() in extensions
    ]
    return sorted(names, key=lambda n: n.lower())


def tags(path):
    """title, artist from the file's metadata, or (None, None)."""
    if not FFPROBE:
        return None, None
    try:
        raw = subprocess.run(
            [FFPROBE, "-v", "quiet", "-print_format", "json",
             "-show_entries", "format_tags=title,artist", path],
            capture_output=True, text=True, timeout=20,
        ).stdout
        found = json.loads(raw).get("format", {}).get("tags", {})
    except Exception:
        return None, None
    lower = {k.lower(): (v or "").strip() for k, v in found.items()}
    return lower.get("title") or None, lower.get("artist") or None


_NOISE_WORD = r"""(?:
    \d?\s*d\s*audio | audio | lyrics? | lyric\s*video | official(?:\s+\w+)? |
    video | visuali[sz]er | mv | hd | hq | 4k | full\s*song | free\s*download |
    remaster(?:ed)?(?:\s*\d{4})? | explicit | clean
)"""
NOISE = re.compile(
    r"[\(\[]\s*" + _NOISE_WORD + r"(?:[\s,/&\-–]+" + _NOISE_WORD + r")*\s*[\)\]]",
    re.IGNORECASE | re.VERBOSE,
)


def from_filename(name):
    stem = os.path.splitext(name)[0]
    stem = re.sub(r"^\d+[\s._-]+", "", stem)
    stem = re.sub(r"[-_ ]\d+$", "", stem)
    stem = NOISE.sub(" ", stem)
    stem = stem.replace("_", " ")
    stem = re.sub(r"\s{2,}", " ", stem).strip(" -")

    if " - " in stem:
        artist, title = stem.split(" - ", 1)
        return title.strip(), artist.strip()
    return stem, ""


def average_colour(path):
    if not FFMPEG:
        return "#0b0b0f"
    try:
        out = subprocess.run(
            [FFMPEG, "-v", "quiet", "-i", path,
             "-vf", "scale=1:1,format=rgb24",
             "-f", "rawvideo", "-frames:v", "1", "-"],
            capture_output=True, timeout=30,
        ).stdout
        if len(out) >= 3:
            r, g, b = out[0], out[1], out[2]
            return "#%02x%02x%02x" % (r, g, b)
    except Exception:
        pass
    return "#0b0b0f"


def remembered_bases():
    """Colours already written in backgrounds.js (preserved for next run)."""
    known = {}
    if not os.path.exists(BG_PATH):
        return known
    try:
        with open(BG_PATH, encoding="utf-8") as f:
            for line in f:
                src  = re.search(r'"(?:src|video)":\s*"([^"]+)"', line)
                base = re.search(r'"base":\s*"(#[0-9a-fA-F]{6})"', line)
                if src and base:
                    known[src.group(1)] = base.group(1)
    except Exception:
        pass
    return known


def pretty_name(stem):
    """Alpine-valley → Alpine Valley, 1a-volcanic-night → Volcanic Night."""
    stem = re.sub(r"^\d+[a-z]?[-_]", "", stem)    # strip leading 1a- / 2-
    words = re.sub(r"[-_]+", " ", stem).strip()
    words = re.sub(r"^\d+\s*", "", words)
    return " ".join(w[:1].upper() + w[1:] for w in words.split())


def pk_name(stem):
    """pk-01-J-ReK9-49vE → Lahore I, pk-02-... → Lahore II, etc."""
    m = re.match(r"pk-(\d+)", stem, re.IGNORECASE)
    if not m:
        return pretty_name(re.sub(r"^pk-\d+-?", "", stem, flags=re.IGNORECASE))
    n = int(m.group(1))
    numerals = ["I","II","III","IV","V","VI","VII","VIII","IX","X",
                "XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"]
    roman = numerals[n - 1] if 1 <= n <= len(numerals) else str(n)
    return "Lahore " + roman


# ── writers ──────────────────────────────────────────────────────────────────

def write_tracks():
    names   = listing(MUSIC_DIR, AUDIO_EXT)
    entries = []
    for name in names:
        title, artist = tags(os.path.join(MUSIC_DIR, name))
        if not title:
            title, guessed = from_filename(name)
            artist = artist or guessed
        entries.append({"title": title, "artist": artist or "", "src": "music/" + name})

    lines = [BANNER, "window.TRACKS = [\n"]
    for e in entries:
        lines.append("  %s,\n" % json.dumps(e, ensure_ascii=False))
    lines.append("];\n")
    with open(os.path.join(ROOT, "tracks.js"), "w", encoding="utf-8") as f:
        f.write("".join(lines))
    return entries


def dedupe_by_stem(names, prefer_ext):
    """Keep one file per image stem, preferring prefer_ext; fallback to first found."""
    by_stem = {}
    for n in names:
        stem = os.path.splitext(n)[0].lower()
        ext  = os.path.splitext(n)[1].lower()
        if stem not in by_stem:
            by_stem[stem] = n
        elif ext == prefer_ext:
            by_stem[stem] = n
    return [by_stem[s] for s in sorted(by_stem)]


def clean_name(stem):
    """Remove Unsplash / download-junk suffixes: hashes, -unsplash, etc.
    A hash looks like -cWr9DucW88o: mixed case + digits, no pure-English word."""
    stem = re.sub(r"-unsplash$", "", stem, flags=re.IGNORECASE)
    # Hash: has uppercase AND digit, 8+ chars — unlikely to be a real word
    stem = re.sub(r"-(?=[A-Za-z0-9_]{8,}$)(?=[^-]*[A-Z])(?=[^-]*\d)[A-Za-z0-9_]+$", "", stem)
    # Strip photographer credit: "firstname-lastname-HASH" → keep only last meaningful part
    # If after cleaning we still have 2+ segments that look like names, strip all but last
    return stem


def write_backgrounds():
    known    = remembered_bases()
    abstract = []
    pakistan = []

    # Abstract: art/abstract/ (prefer .jpg)
    ab_names = dedupe_by_stem(listing(ART_ABSTRACT, IMAGE_EXT), ".jpg")
    for n in ab_names:
        key  = "art/abstract/" + n
        path = os.path.join(ART_ABSTRACT, n)
        stem = os.path.splitext(n)[0]
        measured = average_colour(path)
        base     = known.get(key, measured) if measured == "#0b0b0f" else measured
        abstract.append({"name": pretty_name(clean_name(stem)), "base": base, "src": key})

    # Pakistan: art/pakistan/ (prefer .webp)
    pk_names = dedupe_by_stem(listing(ART_PAKISTAN, IMAGE_EXT), ".webp")
    for n in pk_names:
        key  = "art/pakistan/" + n
        path = os.path.join(ART_PAKISTAN, n)
        stem = os.path.splitext(n)[0]
        measured = average_colour(path)
        base     = known.get(key, measured) if measured == "#0b0b0f" else measured
        pakistan.append({"name": "pk-" + pk_name(stem), "base": base, "src": key})

    lines = [
        BANNER,
        "window.BACKGROUNDS = [\n",
        "\n  /* ---- Abstract: vector art ---- */\n",
    ]
    for e in abstract:
        lines.append("  %s,\n" % json.dumps(e, ensure_ascii=False))

    lines.append("\n  /* ---- Pakistan: cinematic photography ---- */\n")
    for e in pakistan:
        lines.append("  %s,\n" % json.dumps(e, ensure_ascii=False))

    lines.append("];\n")
    with open(BG_PATH, "w", encoding="utf-8") as f:
        f.write("".join(lines))

    return abstract, pakistan


def bump_sw(abstract, pakistan):
    """Rewrite the art pre-cache list in sw.js and bump the cache version."""
    if not os.path.exists(SW_PATH):
        print("sw.js not found — skipping")
        return

    with open(SW_PATH, encoding="utf-8") as f:
        text = f.read()

    # ── bump cache version ────────────────────────────────────────────────
    def increment(m):
        return 'const CACHE = "desk-screen-v%d";' % (int(m.group(1)) + 1)

    new_text = re.sub(
        r'const CACHE = "desk-screen-v(\d+)";',
        increment, text, count=1,
    )

    # ── rebuild art lines ─────────────────────────────────────────────────
    all_art = [e["src"] for e in abstract] + [e["src"] for e in pakistan]
    art_lines = "".join('  "/%s",\n' % s for s in all_art)
    art_block = "  /* Art — pre-cached on install so repeat visits (and offline) are instant */\n" + art_lines

    # Replace everything between the marker comment and the closing ];
    new_text = re.sub(
        r"(/\* Art — pre-cached.*?\*/\n).*?(?=\];)",
        art_block,
        new_text,
        flags=re.DOTALL,
    )

    with open(SW_PATH, "w", encoding="utf-8") as f:
        f.write(new_text)


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    tracks           = write_tracks()
    abstract, pak    = write_backgrounds()
    bump_sw(abstract, pak)

    print("music/  %d track%s" % (len(tracks), "" if len(tracks) == 1 else "s"))
    print("art/    %d abstract  +  %d pakistan" % (len(abstract), len(pak)))

    if not FFPROBE:
        print("\nTip: install ffmpeg for better colour extraction and tag reading.")
        print("     brew install ffmpeg")


if __name__ == "__main__":
    sys.exit(main())
