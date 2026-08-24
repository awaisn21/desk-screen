# Connecting Spotify

Five minutes, done once. You need **Spotify Premium** — Spotify restricts
in-browser playback to Premium accounts, and there is no way around it.

## 1. Create an app

Go to <https://developer.spotify.com/dashboard> and sign in with your normal
Spotify account. Click **Create app** and fill in:

| Field | Value |
|---|---|
| App name | Deskscreen |
| App description | Personal ambient player |
| Redirect URI | `http://127.0.0.1:8080/` |
| Which API/SDKs | tick **Web Playback SDK** and **Web API** |

The Redirect URI has to be typed exactly, trailing slash included. Spotify
rejects `localhost` — it must be the numeric `127.0.0.1`.

Save, then open the app's **Settings** and copy the **Client ID**. There is
also a Client Secret; you do not need it and should not paste it anywhere.

## 2. Put the Client ID in config.js

Open `config.js` and fill in the two lines:

```js
clientId: "paste-your-client-id-here",
playlist: "https://open.spotify.com/playlist/....",
```

For the playlist, open any playlist in Spotify → **Share** → **Copy link to
playlist**, and paste it in. That is your library — make one with your
hundred songs and point at it. Leave `playlist` empty and the player just
resumes whatever you were last listening to instead.

## 3. Run it

Double-click **start.command**. The first time you press play, a Spotify
page asks you to authorise the app; say yes and you land back on the player,
signed in. It stays signed in after that.

Press **F** for fullscreen and drag the window to your second screen.

---

## If something goes wrong

**"INVALID_CLIENT: Invalid redirect URI"** — the URI in the dashboard does
not match. It must be `http://127.0.0.1:8080/` with the trailing slash, and
`PORT` in `start.command` must be 8080 too.

**"Premium required"** — the account signed in is not Premium. The SDK will
not play audio without it.

**"Open Spotify once, then retry"** — Spotify sometimes needs the desktop or
phone app opened once before it will hand playback to a new device.

**Playback stops after a few hours** — press play again. Spotify drops idle
Connect devices; the sign-in itself is still good.

**Sign-in expired** — press play to re-authorise. Rare, but access can be
revoked from your Spotify account page.

## What this does and does not do

The page becomes a Spotify Connect device, like a speaker. Audio streams from
Spotify to this browser tab, and your play counts and history work normally.
Nothing is downloaded and nothing is stored except the sign-in token, which
sits in your browser's local storage on this machine only.

Spotify limits apps in development mode to five authorised accounts, which is
plenty for one desk.
