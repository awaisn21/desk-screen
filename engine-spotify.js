/* ---------------------------------------------------------------------------
   Spotify engine.

   Signs in with the PKCE flow (no client secret, nothing to keep private),
   registers this page as a Spotify Connect device through the Web Playback
   SDK, and drives it with the same three buttons.

   Needs Spotify Premium — that is Spotify's rule for the SDK, not ours.
--------------------------------------------------------------------------- */

window.EngineSpotify = (function () {
  "use strict";

  const API = "https://api.spotify.com/v1";
  const ACCOUNTS = "https://accounts.spotify.com";
  const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
  ].join(" ");

  const STORE = "desk-screen:spotify";
  const OLD_STORE = "second-screen:spotify";   /* pre-rename, read once */

  const cfg = window.CONFIG || {};
  let ui = null;
  let player = null;
  let deviceId = null;
  let token = null;
  let expiresAt = 0;
  let refreshToken = null;
  let started = false;      /* has playback been kicked off this session */
  let sdkReady = false;
  let lastState = null;
  let tick = null;

  /* ---- tiny storage helpers, safe when storage is blocked ---------------- */

  function save(data) {
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE);
      return JSON.parse(raw || "null");
    } catch (e) { return null; }
  }

  function forget() {
    try { localStorage.removeItem(STORE); } catch (e) {}
    token = null; refreshToken = null; expiresAt = 0;
  }

  /* ---- PKCE ------------------------------------------------------------- */

  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (b) { return chars[b % chars.length]; }).join("");
  }

  function base64url(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64url(digest);
  }

  function redirectUri() {
    /* Register this exact string in the Spotify dashboard.
       Spotify rejects "localhost" — the loopback IP must be spelled out. */
    return window.location.origin + "/";
  }

  async function signIn() {
    const verifier = randomString(96);
    const state = randomString(16);
    try {
      sessionStorage.setItem("desk-screen:verifier", verifier);
      sessionStorage.setItem("desk-screen:state", state);
    } catch (e) {
      ui.notice("Storage is blocked", "Sign-in needs session storage");
      return;
    }

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      code_challenge_method: "S256",
      code_challenge: await challengeFor(verifier),
      state: state,
      scope: SCOPES,
    });
    window.location.href = ACCOUNTS + "/authorize?" + params.toString();
  }

  async function exchange(code) {
    let verifier = null, expected = null;
    try {
      verifier = sessionStorage.getItem("desk-screen:verifier");
      expected = sessionStorage.getItem("desk-screen:state");
    } catch (e) {}

    const url = new URL(window.location.href);
    if (expected && url.searchParams.get("state") !== expected) {
      throw new Error("state mismatch");
    }

    const res = await fetch(ACCOUNTS + "/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri(),
        code_verifier: verifier || "",
      }),
    });
    if (!res.ok) throw new Error("token exchange failed: " + res.status);
    keep(await res.json());
  }

  async function refresh() {
    if (!refreshToken) return false;
    const res = await fetch(ACCOUNTS + "/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) { forget(); return false; }
    keep(await res.json());
    return true;
  }

  function keep(data) {
    token = data.access_token;
    if (data.refresh_token) refreshToken = data.refresh_token;
    expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    save({ refreshToken: refreshToken, token: token, expiresAt: expiresAt });
  }

  async function freshToken() {
    if (token && Date.now() < expiresAt - 60000) return token;
    const ok = await refresh();
    return ok ? token : null;
  }

  /* ---- Web API ---------------------------------------------------------- */

  async function api(path, options) {
    const access = await freshToken();
    if (!access) throw new Error("no token");
    const opts = options || {};
    const res = await fetch(API + path, {
      method: opts.method || "GET",
      headers: Object.assign(
        { Authorization: "Bearer " + access },
        opts.body ? { "Content-Type": "application/json" } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return null;
    if (!res.ok) {
      const err = new Error("spotify " + res.status + " on " + path);
      err.status = res.status;
      throw err;
    }
    return res.json().catch(function () { return null; });
  }

  function playlistContext() {
    const raw = (cfg.playlist || "").trim();
    if (!raw) return null;
    if (raw.indexOf("spotify:playlist:") === 0) return raw;
    const match = raw.match(/playlist\/([A-Za-z0-9]+)/);
    return match ? "spotify:playlist:" + match[1] : null;
  }

  async function beginPlayback() {
    await api("/me/player", { method: "PUT", body: { device_ids: [deviceId], play: false } });

    const context = playlistContext();
    if (!context) {
      /* no playlist configured — just resume whatever was last playing */
      await player.resume();
      return;
    }

    /* shuffle first, then start; Spotify does not guarantee ordering between
       player calls, so give the shuffle a moment to land */
    try {
      await api("/me/player/shuffle?state=true&device_id=" + deviceId, { method: "PUT" });
    } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 250); });

    await api("/me/player/play?device_id=" + deviceId, {
      method: "PUT",
      body: { context_uri: context, offset: { position: Math.floor(Math.random() * 50) } },
    });
  }

  /* ---- the SDK ---------------------------------------------------------- */

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const tag = document.createElement("script");
      tag.src = "https://sdk.scdn.co/spotify-player.js";
      tag.onerror = function () { reject(new Error("sdk blocked")); };
      document.head.appendChild(tag);
    });
  }

  function paint(state) {
    lastState = state;
    if (!state) return;
    const track = state.track_window && state.track_window.current_track;
    if (track) {
      const artists = (track.artists || []).map(function (a) { return a.name; }).join(", ");
      ui.track(track.name, artists);
    }
    ui.playing(!state.paused);
    if (state.duration) ui.progress(state.position / state.duration);
  }

  function startTicker() {
    if (tick) clearInterval(tick);
    tick = setInterval(function () {
      if (!lastState || lastState.paused || !lastState.duration) return;
      lastState.position = Math.min(lastState.position + 1000, lastState.duration);
      ui.progress(lastState.position / lastState.duration);
    }, 1000);
  }

  async function connect() {
    ui.notice("Connecting", "Spotify");
    await loadSdk();

    player = new Spotify.Player({
      name: "Desk Screen",
      volume: typeof cfg.volume === "number" ? cfg.volume : 0.6,
      getOAuthToken: function (cb) { freshToken().then(function (t) { if (t) cb(t); }); },
    });

    player.addListener("ready", function (e) {
      deviceId = e.device_id;
      sdkReady = true;
      ui.notice("Ready", "Press play");
    });

    player.addListener("not_ready", function () {
      sdkReady = false;
      ui.notice("Reconnecting", "Spotify");
    });

    player.addListener("player_state_changed", paint);

    player.addListener("initialization_error", function (e) {
      ui.notice("Browser cannot play Spotify", e.message || "Try Chrome");
    });
    player.addListener("account_error", function () {
      ui.notice("Premium required", "Spotify limits playback to Premium");
    });
    player.addListener("authentication_error", function () {
      forget();
      ui.notice("Sign-in expired", "Press play to reconnect");
    });
    player.addListener("playback_error", function (e) {
      ui.notice("Playback stopped", e.message || "Press play to retry");
    });

    await player.connect();
    startTicker();
  }

  /* ---- the interface app.js talks to ------------------------------------ */

  return {
    name: "spotify",

    available: function () {
      return !!(cfg.clientId && String(cfg.clientId).trim());
    },

    async init(hooks) {
      ui = hooks;

      const stored = load();
      if (stored) {
        refreshToken = stored.refreshToken || null;
        token = stored.token || null;
        expiresAt = stored.expiresAt || 0;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        history.replaceState({}, "", url.pathname);
        ui.notice("Sign-in cancelled", "Press play to try again");
        return;
      }

      if (code) {
        ui.notice("Signing in", "Spotify");
        try {
          await exchange(code);
        } catch (e) {
          history.replaceState({}, "", url.pathname);
          ui.notice("Sign-in failed", "Check the Redirect URI");
          return;
        }
        history.replaceState({}, "", url.pathname);
      }

      const access = await freshToken();
      if (!access) {
        ui.notice("Spotify", "Press play to sign in");
        return;
      }

      try {
        await connect();
      } catch (e) {
        ui.notice("Could not reach Spotify", "Check your connection");
      }
    },

    async toggle() {
      const access = await freshToken();
      if (!access) { signIn(); return; }
      if (!player) { await connect().catch(function () {}); return; }

      /* satisfies the browser's autoplay rules — must run inside the click */
      if (player.activateElement) { try { player.activateElement(); } catch (e) {} }

      if (!sdkReady) { ui.notice("Still connecting", "One moment"); return; }

      if (!started) {
        started = true;
        try {
          await beginPlayback();
        } catch (e) {
          started = false;
          ui.notice(
            e.status === 403 ? "Premium required" : "Could not start playback",
            e.status === 404 ? "Open Spotify once, then retry" : "Press play to retry"
          );
        }
        return;
      }
      player.togglePlay();
    },

    next: function () { if (player && started) player.nextTrack(); },
    prev: function () {
      if (!player || !started) return;
      if (lastState && lastState.position > 3000) { player.seek(0); return; }
      player.previousTrack();
    },
  };
})();
