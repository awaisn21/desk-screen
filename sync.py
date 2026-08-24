#!/usr/bin/env python3
"""
Desk Screen — folder sync.

Reads whatever is sitting in music/ and art/ and writes the two lists the
page reads at load time:

    music/  ->  tracks.js       window.TRACKS
    art/    ->  backgrounds.js  window.BACKGROUNDS

Run it whenever you add or remove files. start.command runs it for you.

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
ART_DIR = os.path.join(ROOT, "art")
VIDEO_DIR = os.path.join(ROOT, "video")

AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".weba"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}

FFPROBE = shutil.which("ffprobe")
FFMPEG = shutil.which("ffmpeg")

BANNER = "/* Written by sync.py — your edits here are replaced on the next run. */\n"


def listing(folder, extensions):
    if not os.path.isdir(folder):
        return []
    names = [
        n for n in os.listdir(folder)
        if not n.startswith(".") and os.path.splitext(n)[1].lower() in extensions
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


# words that end up in downloaded filenames and are not part of the title
_NOISE_WORD = r"""(?:
    \d?\s*d\s*audio | audio | lyrics? | lyric\s*video | official(?:\s+\w+)? |
    video | visuali[sz]er | mv | hd | hq | 4k | full\s*song | free\s*download |
    remaster(?:ed)?(?:\s*\d{4})? | explicit | clean
)"""

# a bracketed group made up only of those words, however many of them
NOISE = re.compile(
    r"[\(\[]\s*" + _NOISE_WORD + r"(?:[\s,/&\-\u2013]+" + _NOISE_WORD + r")*\s*[\)\]]",
    re.IGNORECASE | re.VERBOSE,
)


def from_filename(name):
    stem = os.path.splitext(name)[0]
    stem = re.sub(r"^\d+[\s._-]+", "", stem)          # leading track numbers
    stem = re.sub(r"[-_ ]\d+$", "", stem)              # the "-1" a second download adds
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
            [FFMPEG, "-v", "quiet", "-i", path, "-vf", "scale=1:1",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-frames:v", "1", "-"],
            capture_output=True, timeout=30,
        ).stdout
        if len(out) >= 3:
            r, g, b = out[0], out[1], out[2]
            return "#%02x%02x%02x" % (r, g, b)
    except Exception:
        pass
    return "#0b0b0f"


def write_tracks():
    names = listing(MUSIC_DIR, AUDIO_EXT)
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


def pretty(stem):
    words = re.sub(r"[-_]+", " ", stem).strip()
    words = re.sub(r"^\d+\s*", "", words)
    return " ".join(w[:1].upper() + w[1:] for w in words.split())


def poster_for(name):
    """A still frame sitting next to the video, or one made on the spot."""
    stem = os.path.splitext(name)[0]
    for ext in (".jpg", ".jpeg", ".png"):
        if os.path.exists(os.path.join(VIDEO_DIR, stem + ext)):
            return "video/" + stem + ext
    if FFMPEG:
        made = os.path.join(VIDEO_DIR, stem + ".jpg")
        try:
            subprocess.run(
                [FFMPEG, "-v", "quiet", "-y", "-i", os.path.join(VIDEO_DIR, name),
                 "-frames:v", "1", "-q:v", "5", made],
                capture_output=True, timeout=60,
            )
            if os.path.exists(made):
                return "video/" + stem + ".jpg"
        except Exception:
            pass
    return None


def write_backgrounds():
    entries = []

    for n in listing(VIDEO_DIR, VIDEO_EXT):
        entries.append({
            "name": pretty(os.path.splitext(n)[0]),
            "base": average_colour(os.path.join(VIDEO_DIR, n)),
            "video": "video/" + n,
            "poster": poster_for(n),
        })

    for n in listing(ART_DIR, IMAGE_EXT):
        entries.append({
            "name": pretty(os.path.splitext(n)[0]),
            "base": average_colour(os.path.join(ART_DIR, n)),
            "src": "art/" + n,
        })

    lines = [BANNER, "window.BACKGROUNDS = [\n"]
    for e in entries:
        lines.append("  %s,\n" % json.dumps(e, ensure_ascii=False))
    lines.append("];\n")
    with open(os.path.join(ROOT, "backgrounds.js"), "w", encoding="utf-8") as f:
        f.write("".join(lines))
    return entries


def main():
    tracks = write_tracks()
    art = write_backgrounds()

    print("music/  %d song%s" % (len(tracks), "" if len(tracks) == 1 else "s"))
    for t in tracks:
        label = "%s — %s" % (t["artist"], t["title"]) if t["artist"] else t["title"]
        print("        %s" % label)
    if not tracks:
        print("        drop .mp3 / .m4a / .wav files into the music folder")

    videos = [b for b in art if b.get("video")]
    stills = [b for b in art if b.get("src")]
    print("video/  %d clip%s" % (len(videos), "" if len(videos) == 1 else "s"))
    for v in videos:
        print("        %s%s" % (v["name"], "" if v["poster"] else "   (no poster frame)"))
    print("art/    %d image%s" % (len(stills), "" if len(stills) == 1 else "s"))
    if not art:
        print("        drop images into art/ or looping .mp4 files into video/")

    if not FFPROBE:
        print("\nffmpeg is not installed, so song titles come from filenames.")
        print("Name files 'Artist - Title.mp3', or run: brew install ffmpeg")


if __name__ == "__main__":
    sys.exit(main())
