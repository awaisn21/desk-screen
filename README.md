# Second Screen

A still image, edge to edge, with a small glass player over it. Three buttons.
Nothing else. Made to be opened fullscreen on a second monitor and left there.

## Run it

Double-click **start.command**. It refreshes the image list, serves the folder
on `http://127.0.0.1:8080`, and opens it. Press **F** for fullscreen and drag
the window across. Leave the Terminal window open — closing it stops the server.

It runs from a local server rather than opening the file directly, because
Spotify sign-in only works from `127.0.0.1`.

## Music

Three ways, and the player picks whichever is set up.

**Spotify** — a `clientId` in `config.js` switches it on. The page becomes a
Spotify Connect device and the three buttons drive your own account, shuffling
a playlist you choose. Needs Premium. Setup is in **SPOTIFY-SETUP.md**, about
five minutes, once.

**Local files** — drop audio into `music/` (`.mp3`, `.m4a`, `.wav`, `.flac`,
`.ogg`, `.opus`) and run `start.command`. Titles come from each file's tags;
with no tags the filename is used, and `Artist - Title.mp3` is split on the
dash. Used automatically whenever `clientId` is empty.

**Generative** — six original ambient pieces composed in the browser as they
play. No files, no accounts, no network. Each piece is a scale, a register, a
density and a slow chord cycle; the notes are chosen fresh every time, so it
never repeats and never ends. Used when neither of the above is configured,
and the only mode in the public build. Prev/next move between pieces, and the
ring shows where you are in the current chord cycle.

Set `mode` in `config.js` to `"spotify"`, `"files"` or `"ambient"` to force
one. `"auto"` is the default and picks in that order.

With Spotify or local files, the order is shuffled fresh on every visit.

Files must be files — a Spotify or YouTube *link* dropped in `music/` will not
play. DRM-protected downloads from Apple Music or Spotify will not play either;
that is what the Spotify mode above is for.

## Backgrounds

Two kinds, mixed freely in one list:

- **Stills** — drop images into `art/` (`.jpg`, `.png`, `.webp`, `.avif`).
- **Clips** — drop looping video into `video/` (`.mp4`, `.webm`). Muted,
  looping, no controls. `sync.py` pulls a poster frame out of each one so the
  screen is filled instantly while the video buffers.

Then run `start.command`.

The button in the bottom-right corner moves to the next background, and
**your choice sticks** — the same one opens every time, on that browser. Until
you choose, it opens on a random one. Press **B** for the same thing from the
keyboard.

The choice is stored by name, so adding or reordering files will not shuffle
what you picked.

Clips pause when the window is hidden, and anyone whose system asks for
reduced motion gets the poster frame instead of the video.

Landscape at 1920×1080 or larger looks best. For video, 30–60 seconds that
loops cleanly beats anything longer — nobody watches it, they just want the
room to feel alive.

## Controls

| | |
|---|---|
| click | previous · play/pause · next |
| space | play / pause |
| ← → | previous / next |
| F | fullscreen |

Your Mac's media keys and the Now Playing widget work too. The ring around the
play button is the progress of the current song.

## How it fits together

```
index.html          markup only
style.css           every visual decision lives here
app.js              background, buttons, keyboard — knows nothing about music
engine-spotify.js   sign-in and the Web Playback SDK
engine-files.js     the music/ folder
engine-ambient.js   the generative pieces
config.js           your Spotify client ID and playlist  ← you edit this
sync.py             reads music/, art/ and video/, writes the two lists below
tracks.js           generated — window.TRACKS
backgrounds.js      generated — window.BACKGROUNDS (stills and clips)
start.command       sync, serve, open
build-public.py     writes dist/ for hosting — see DEPLOY.md
```

All three engines expose the same four calls — `available`, `init`, `toggle`,
`next`, `prev` — so `app.js` never knows which one it is driving. Adding a
fourth source means writing one more file of that shape.

`sync.py` uses `ffprobe` and `ffmpeg` when installed (`brew install ffmpeg`)
to read song tags and each image's average tone. Without them it falls back to
filenames and a neutral dark, and everything still works.
