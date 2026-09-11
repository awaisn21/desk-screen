# Desk Screen

A full-screen focus environment for a second monitor. One piece of artwork edge to edge, a glass player with three buttons, and a daily intention you set each morning. Open it, drag it across, press F, and leave it alone.

Live at [desk-screen.vercel.app](https://desk-screen.vercel.app).

---

## What it does

**Art** fills the screen. Seven SVGs — all 1920×1080 viewBox vector, sharp at any resolution. The background button cycles through them; your pick is remembered by name so adding or reordering artwork never scrambles what you chose. If you haven't chosen yet, it opens on an artwork that matches the time of day. Every 8-12 minutes it quietly drifts to the next one on its own — so the screen is never exactly the same as when you left it.

**Music** picks its source automatically in this order:

1. **Spotify** — a `clientId` in `config.js` makes the page a Spotify Connect device.
2. **Local files** — drop audio into `music/` and `sync.py` builds the track list.
3. **YouTube** — a curated stream of Pakistani nostalgia songs (Strings, Jal, Atif Aslam, Ali Zafar, Fuzon, Noori). No API key required; youtube-nocookie.com handles licensing and tracking. Shuffled fresh every session.
4. **Generative ambient** — seven original pieces synthesised entirely in the browser, no files and no network. The starting piece is chosen by the hour: Old House in the morning, Glass Bay mid-day, Long Dusk at golden hour, Harbour in the evening, Nightfloor deep at night.

**Intention** is the third thing. On the first open of each day, a prompt appears: *What are you working on?* You type something, press Enter, and it shows up as a faint italic line above the player for the rest of the day. It resets at midnight. Press **I** to change it. It is stored only in your browser and sent nowhere.

---

## Engineering decisions

### Artwork: GPU canvas pre-rasterisation

Each SVG gets its own `<canvas>`. On load, all artwork is drawn into its canvas during idle time — one at a time across `requestIdleCallback` slots — so nothing blocks. After that, switching artwork is a compositor flip: toggling `opacity` on the right canvas, not a draw call.

This matters because the artwork is detailed. `hill-town.svg` is 3.2 MB of paths and takes ~2.5 s to rasterise. Without pre-rasterisation, clicking the background button produced 600–2700 ms stalls. After: **31 ms median, 131 ms worst case** while clicking as fast as possible.

Each canvas is promoted to its own GPU layer via `will-change: opacity; transform: translateZ(0)`, so the reveal never triggers layout or paint.

### Audio: dual-buffer prefetch

The files engine runs two `Audio` elements in rotation. One plays; the other has already fetched the next track. Pressing next swaps them — zero network wait. The freed element then fetches the track after that.

Switch time before: ~60 ms. After: ~19 ms. The difference is small in absolute terms but noticeable on a second monitor where you glance across just to skip.

### Generative music: Web Audio, no files

The ambient engine synthesises everything from scratch. Six pieces, each defined by a scale, a register, note gap ranges, harmonic partials, a filter envelope, and a slow chord cycle measured in minutes. Notes are chosen randomly within those rules each time they fire — the music never repeats and never ends.

Reverb is a synthesised impulse response built from shaped exponential noise. The whole engine — six endless compositions — is 13 KB of JavaScript and downloads nothing. No audio files, no CDN, no licensing questions.

### A seventh piece: Old House

The ambient engine now has seven pieces. The newest, *Old House*, sits in the childhood register — C5, major pentatonic, short struck attacks that decay quickly, partials tuned to read like a toy piano rather than a bell. It opens each morning session when the hour is between 5 and 10.

The piece runs the same synthesis path as the others: oscillators, envelope, filter, reverb send. No samples, no files. The nostalgic quality comes entirely from the scale choice and the short attack-to-decay ratio.

### Engine abstraction

All three sources expose the same interface:

```js
{ name, available(), init(ui), toggle(), next(), prev() }
```

`app.js` picks one at startup and never knows which it got. Adding a fourth source means writing one more file of that shape and registering it in the `engines` map.

---


### PWA — installable, offline-first

`manifest.json` and `sw.js` make Desk Screen installable as a native-looking app from any browser. The service worker caches the shell (HTML, CSS, JS, fonts) on first load so the screen opens instantly even on slow Wi-Fi, and works fully offline for the generative and local-files engines. Art and video are fetched network-first so newly dropped files show up without clearing the cache.

The install prompt appears automatically on supported browsers. On desktop Chrome, an icon appears in the address bar.

## Running locally

```
cd ~/Projects/desk-screen
./start.command
```

Refreshes the track and background lists, serves on `http://127.0.0.1:8080`, and opens the browser. The address must be `127.0.0.1` — Spotify's redirect URI is registered against that exact string and rejects `localhost`.

Install `ffmpeg` (`brew install ffmpeg`) to read song tags from audio metadata and measure average base colours from raster artwork.

## Building for the web

```
python3 build-public.py
cd dist && npx vercel --prod
```

The public build uses the generative engine only — local files cannot be hosted publicly and the Spotify SDK requires Premium and registered redirect URIs.

---

## Controls

| Key | Action |
|---|---|
| Space | Play / pause |
| ← → | Previous / next track or piece |
| B | Change background (also auto-drifts every 8-12 min) |
| F | Fullscreen |
| I | Set or change today's intention |
| Y | Switch to YouTube engine (if configured) |

macOS media keys and the Now Playing widget work via the Media Session API.

---

## File map

```
index.html          markup only
style.css           every visual decision
app.js              artwork, buttons, keyboard — knows nothing about music
intention.js        daily focus intention — prompt, display, localStorage
engine-spotify.js   Spotify Web Playback SDK + PKCE flow
engine-files.js     files in music/ with dual-buffer prefetch
engine-youtube.js   curated Pakistani nostalgia playlist via YouTube IFrame API
engine-ambient.js   seven generative pieces, synthesised entirely in the browser
config.js           your settings (clientId, playlist, mode) — not in git
sync.py             reads music/ art/ video/, writes tracks.js + backgrounds.js
tracks.js           generated — window.TRACKS — not in git
backgrounds.js      generated — window.BACKGROUNDS
sw.js               service worker — offline shell cache, network-first for art
manifest.json       PWA manifest — name, icons, display mode
build-public.py     writes dist/ for hosting
start.command       sync → serve → open
vercel.json         cache headers
```

---

## Notes

- Background choice is stored by **name**, not index — reordering artwork keeps your pick.
- Track order is shuffled fresh on every visit.
- Autoplay fires on load; browsers that block it arm a one-time listener on the first interaction.
- Video backgrounds pause when the tab is hidden.
- `prefers-reduced-motion` swaps video for the poster frame.
- `sync.py` reads only the top level of `art/`, `video/` and `music/` — subfolders are a safe parking space.
