/* ---------------------------------------------------------------------------
   YouTube engine — streams a curated Pakistani nostalgia playlist.

   No API key required. YouTube IFrame Player API is free for embedding.
   The player lives in a 1×1 hidden div; youtube-nocookie.com reduces
   tracking. YouTube handles all licensing — nothing is downloaded.

   To enable: set  mode: "youtube"  in config.js, or add "youtube" to
   the auto chain in app.js (between "files" and "ambient").
--------------------------------------------------------------------------- */

window.EngineYouTube = (function () {
  "use strict";

  /* Hand-curated playlist: songs that hit the nostalgia for Pakistanis who
     grew up in the 2000s–early 2010s. Strings, Jal, Atif Aslam, Ali Zafar,
     Fuzon, Noori — the names you heard on PTV, at weddings, from a cousin's
     Nokia. Shuffled fresh every session so no two plays are the same.

     Video IDs verified from official / widely-archived uploads. The engine
     skips any that become unavailable and moves to the next one. */
  const PLAYLIST = [
    { id: "NgEQL8UOAG4", title: "Duur",                   artist: "Strings" },
    { id: "LxOqG2AHdxE", title: "Aankhain",               artist: "Strings" },
    { id: "yp_xs2vaxlM", title: "Sar Kiye Yeh Pahar",     artist: "Strings" },
    { id: "f_-OZwVkB88", title: "Anjane",                  artist: "Strings" },
    { id: "wJJBUtzjfgg", title: "Aadat",                   artist: "Jal" },
    { id: "FLKxnL7KwHw", title: "Woh Lamhe Woh Baatein",  artist: "Atif Aslam" },
    { id: "Kf6MsltI7lQ", title: "Jal Pari",               artist: "Atif Aslam" },
    { id: "B4-HoKdW6j0", title: "Jhoom",                  artist: "Ali Zafar" },
    { id: "BCV0shv9tx0", title: "Channo",                  artist: "Ali Zafar" },
    { id: "uMF8npZN5wE", title: "Mora Saiyaan",            artist: "Shafqat Amanat Ali" },
    { id: "W9WjniG1wQ4", title: "Tere Bina Jiya Nahi Jaye", artist: "Fuzon" },
    { id: "f2YKAcR1RbY", title: "Manwa Re",               artist: "Noori" },
  ];

  /* ---- Fisher-Yates shuffle ---- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  let ui       = null;
  let player   = null;
  let queue    = [];
  let cursor   = 0;
  let playing  = false;
  let apiReady = false;

  /* ---- public interface ---- */

  return {
    name: "youtube",

    /* available whenever the YouTube engine is explicitly requested or
       the auto-chain reaches it; the IFrame API itself has no key */
    available: function () {
      const cfg = window.CONFIG || {};
      if (cfg.mode === "youtube") return true;
      /* also available when mode is auto and no files/spotify are set up */
      return !cfg.clientId && !(window.TRACKS && window.TRACKS.length);
    },

    init: function (hooks) {
      ui = hooks;
      queue = shuffle(PLAYLIST);
      cursor = 0;

      ui.track(queue[cursor].title, queue[cursor].artist);
      ui.playing(false);

      return new Promise(function (resolve) {
        /* If the YT global is already loaded (e.g. Spotify page also loaded
           it), go straight to building the player */
        if (window.YT && window.YT.Player) {
          createPlayer(resolve);
          return;
        }

        /* Chain onto any existing callback so we don't clobber it */
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (prev) try { prev(); } catch (e) {}
          apiReady = true;
          createPlayer(resolve);
        };

        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      });
    },

    toggle: function () {
      if (!player) return;
      try {
        if (playing) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      } catch (e) {}
    },

    next: function () {
      cursor = (cursor + 1) % queue.length;
      loadTrack();
    },

    prev: function () {
      cursor = (cursor - 1 + queue.length) % queue.length;
      loadTrack();
    },
  };

  /* ---- internals ---- */

  function createPlayer(done) {
    /* A 1×1 invisible div: the IFrame API requires a real DOM node */
    const host = document.createElement("div");
    host.id = "yt-player-host";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;" +
      "bottom:0;left:0;z-index:-1;";
    document.body.appendChild(host);

    player = new window.YT.Player("yt-player-host", {
      height: "1",
      width: "1",
      videoId: queue[cursor].id,
      host: "https://www.youtube-nocookie.com",  /* reduced tracking */
      playerVars: {
        autoplay:        0,
        controls:        0,
        disablekb:       1,
        fs:              0,
        iv_load_policy:  3,   /* hide annotations */
        modestbranding:  1,
        rel:             0,
        origin:          window.location.origin || "http://127.0.0.1",
        enablejsapi:     1,
        playsinline:     1,
      },
      events: {
        onReady: function () {
          done();
        },
        onStateChange: onState,
        onError:       onError,
      },
    });
  }

  function onState(e) {
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      playing = true;
      ui.playing(true);
      /* Update meta from the actual video (handles any auto-advance) */
      ui.track(queue[cursor].title, queue[cursor].artist);
      /* Progress ring: poll while playing */
      pollProgress();
    } else if (e.data === S.PAUSED) {
      playing = false;
      ui.playing(false);
    } else if (e.data === S.ENDED) {
      cursor = (cursor + 1) % queue.length;
      loadTrack();
    }
  }

  function onError() {
    /* Video unavailable (geo-block, takedown, etc.) — skip silently */
    cursor = (cursor + 1) % queue.length;
    loadTrack();
  }

  function loadTrack() {
    if (!player) return;
    try {
      player.loadVideoById(queue[cursor].id);
      playing = true;
      ui.playing(true);
      ui.track(queue[cursor].title, queue[cursor].artist);
    } catch (e) {}
  }

  /* Drive the progress ring from the video's current time */
  let pollTimer = null;
  function pollProgress() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (!player || !playing) { clearInterval(pollTimer); pollTimer = null; return; }
      try {
        const dur = player.getDuration();
        const cur = player.getCurrentTime();
        if (dur > 0) ui.progress(cur / dur);
      } catch (e) {}
    }, 1000);
  }

})();
