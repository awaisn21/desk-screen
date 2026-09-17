/* ---------------------------------------------------------------------------
   YouTube engine — two playlists keyed on window.DESK_THEME:
     "pakistan" → Pakistani nostalgia songs (Jal, Strings, Atif Aslam, etc.)
     "abstract" → 8D audio Western pop (Alan Walker, Billie Eilish, etc.)

   Crossfade: two hidden YT players alternate. When XFADE_SECS remain on the
   current track, the warm player starts the next track at volume 0 and the
   two volumes cross-fade over XFADE_SECS seconds — Spotify-style.

   Playlist entries may include:
     start  – startSeconds (skip silent/studio intro)
     end    – endSeconds   (begin crossfade early, e.g. skip silent outro)
--------------------------------------------------------------------------- */

window.EngineYouTube = (function () {
  "use strict";

  const XFADE_SECS = 8;   /* seconds of overlap between songs */

  /* ---- Pakistan theme --------------------------------------------------- */
  const PLAYLIST_PAKISTAN = [
    { id: "AKUk1v3rBvc", title: "Aadat",             artist: "Atif Aslam",            start: 0  },
    { id: "1DBhic8SSKs", title: "Woh Lamhey",        artist: "Atif Aslam",           start: 0  },
    { id: "cdwm9Q7U02o", title: "Sajni",             artist: "Jal",                  start: 0  },
    { id: "IW7xwSVj7gw", title: "Hona Tha Pyaar",   artist: "Atif Aslam",           start: 0  },
    { id: "enV1lDLyvN8", title: "Sajni",             artist: "Strings",              start: 0  },
    { id: "cp3Va5mwEhM", title: "Tu Mera Nahin",     artist: "Rizwan Anwar",         start: 0  },
    { id: "6iRMk921AiU", title: "Tera Woh Pyar",     artist: "Momina & Asim",        start: 0  },
    { id: "_F2jV6BQuJ8", title: "Afreen Afreen",     artist: "Rahat & Momina",       start: 0  },
    { id: "a18py61_F_w", title: "Tajdar-e-Haram",   artist: "Atif Aslam",           start: 3  },
    { id: "ZQMn5wIoAno", title: "Tu Kuja Man Kuja",  artist: "Shiraz Uppal",         start: 5  },
    { id: "T94PHkuydcw", title: "Kun Faya Kun",      artist: "A.R. Rahman",          start: 30 },
    { id: "tuxzfwUVSlE", title: "Mann Ki Lagan",     artist: "Rahat Fateh Ali Khan", start: 0  },
    { id: "5ScNf7xaBXc", title: "Sanson Ki Mala",    artist: "Rahat Fateh Ali Khan", start: 0  },
  ];

  /* ---- Abstract theme (8D audio) --------------------------------------- */
  const PLAYLIST_ABSTRACT = [
    { id: "_sdh5h_zkkk", title: "Faded",               artist: "Alan Walker",            start: 0 },
    { id: "OjGKoT7d8PM", title: "Lovely",              artist: "Billie Eilish & Khalid", start: 0 },
    { id: "t46IgVjkcSY", title: "Counting Stars",      artist: "OneRepublic",            start: 0 },
    { id: "ofL4z-W5H-4", title: "Love Me Like You Do", artist: "Ellie Goulding",         start: 0 },
    { id: "_s512A0l3no", title: "Let Me Love You",     artist: "DJ Snake & Bieber",      start: 0 },
    { id: "YzLmxxYuCiY", title: "Shape of You",        artist: "Ed Sheeran",             start: 0 },
    { id: "DJp6YadRfs4", title: "Señorita",            artist: "Shawn Mendes",           start: 0 },
    { id: "uJVNZUVo8aw", title: "The Nights",          artist: "Avicii",                 start: 0 },
    { id: "CMAM0byHa3s", title: "Payphone",            artist: "Maroon 5",               start: 0 },
    { id: "H48EIJVfMD4", title: "Take Me There",       artist: "Rascal Flatts",          start: 0 },
    { id: "7hsF6oa-29o", title: "Belong Together",     artist: "Mark Ambor",             start: 0 },
    { id: "oPORJdD1A9g", title: "Calm Down",           artist: "Rema & Selena Gomez",    start: 0 },
    { id: "JR892mrNXRM", title: "Sailor Song",         artist: "Gigi Perez",             start: 0 },
    { id: "WaYFtIY5oEw", title: "Sweater Weather",     artist: "The Neighbourhood",      start: 0 },
    { id: "AZDNyw5xfO0", title: "Closer",              artist: "The Chainsmokers",        start: 0 },
    { id: "tAIwQaLoi6I", title: "Chemtrails",          artist: "Lana Del Rey",           start: 0 },
    { id: "GsYbkLNIo-4", title: "Die With A Smile",   artist: "Lady Gaga & Bruno Mars", start: 0 },
  ];

  const PLAYLIST = (window.DESK_THEME === "pakistan")
    ? PLAYLIST_PAKISTAN
    : PLAYLIST_ABSTRACT;

  /* ---- Fisher-Yates shuffle ---- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  let ui          = null;
  let players     = [null, null];  /* [a, b] — two hidden YT players */
  let active      = 0;             /* which players[] slot is audible */
  let queue       = [];
  let cursor      = 0;
  let playing     = false;
  let pendingPlay = true;
  let xfading     = false;
  let xfadeTimer  = null;
  let pollTimer   = null;

  function ap() { return players[active]; }
  function wp() { return players[1 - active]; }

  /* ---- public interface ---- */
  return {
    name: "youtube",

    available: function () {
      const cfg = window.CONFIG || {};
      if (cfg.mode === "youtube") return true;
      return !cfg.clientId && !(window.TRACKS && window.TRACKS.length);
    },

    init: function (hooks) {
      ui = hooks;
      queue = shuffle(PLAYLIST);
      cursor = 0;
      ui.track(queue[cursor].title, queue[cursor].artist);
      if (ui.loading) ui.loading();

      return new Promise(function (resolve) {
        if (window.YT && window.YT.Player) {
          createPlayer(0, resolve);
          return;
        }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (prev) try { prev(); } catch (e) {}
          createPlayer(0, resolve);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      });
    },

    toggle: function () {
      if (!ap()) { pendingPlay = !pendingPlay; return; }
      try {
        if (playing) {
          ap().pauseVideo();
          pendingPlay = false;
        } else {
          if (ui && ui.loading) ui.loading();
          ap().playVideo();
        }
      } catch (e) {}
    },

    next: function () {
      clearXfade();
      cursor = (cursor + 1) % queue.length;
      loadTrack();
    },

    prev: function () {
      clearXfade();
      cursor = (cursor - 1 + queue.length) % queue.length;
      loadTrack();
    },
  };

  /* ---- crossfade helpers ---- */

  function clearXfade() {
    if (xfadeTimer) { clearInterval(xfadeTimer); xfadeTimer = null; }
    xfading = false;
    try { if (ap()) ap().setVolume(100); } catch (e) {}
    try { if (wp()) { wp().pauseVideo(); wp().setVolume(100); } } catch (e) {}
  }

  function startCrossfade() {
    xfading = true;
    const nextCursor = (cursor + 1) % queue.length;
    const next = queue[nextCursor];

    /* Ensure warm player exists, then load next track into it silently */
    ensureWarmPlayer(function () {
      try {
        wp().setVolume(0);
        wp().loadVideoById({ videoId: next.id, startSeconds: next.start || 0 });
      } catch (e) {}
    });

    /* Volume ramp: 100ms ticks over XFADE_SECS */
    const total = XFADE_SECS * 10;
    let step = 0;

    xfadeTimer = setInterval(function () {
      step++;
      const t    = Math.min(1, step / total);
      const vol  = Math.max(0, Math.round(100 * (1 - t)));
      const nvol = Math.min(100, Math.round(100 * t));

      try { if (ap()) ap().setVolume(vol);  } catch (e) {}
      try { if (wp()) wp().setVolume(nvol); } catch (e) {}

      /* Show next track name halfway through */
      if (step === Math.floor(total / 2)) {
        ui.track(next.title, next.artist);
      }

      if (step >= total) {
        clearInterval(xfadeTimer);
        xfadeTimer = null;

        /* Complete swap */
        cursor = nextCursor;
        active = 1 - active;

        try { ap().setVolume(100); } catch (e) {}
        try { wp().pauseVideo(); wp().setVolume(100); } catch (e) {}

        xfading = false;
        playing = true;
        ui.playing(true);
        ui.track(next.title, next.artist);
      }
    }, 100);
  }

  /* ---- player creation ---- */

  function playerVars(track) {
    return {
      autoplay:       0,
      controls:       0,
      disablekb:      1,
      fs:             0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel:            0,
      origin:         window.location.origin || "http://127.0.0.1",
      enablejsapi:    1,
      playsinline:    1,
      start:          track.start || 0,
    };
  }

  function makeHost(idx) {
    const div = document.createElement("div");
    div.id = "yt-player-" + idx;
    div.setAttribute("aria-hidden", "true");
    div.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;" +
      "bottom:0;left:0;z-index:-1;";
    document.body.appendChild(div);
    return div;
  }

  function createPlayer(idx, done) {
    makeHost(idx);
    const track = queue[cursor];
    players[idx] = new window.YT.Player("yt-player-" + idx, {
      height: "1", width: "1",
      videoId: track.id,
      host: "https://www.youtube-nocookie.com",
      playerVars: playerVars(track),
      events: {
        onReady: function () {
          if (done) done();
          if (idx === active && pendingPlay) {
            try { ap().playVideo(); } catch (e) {}
          }
        },
        onStateChange: function (e) { onState(e, idx); },
        onError:       function ()  { onError(idx);    },
      },
    });
  }

  function ensureWarmPlayer(cb) {
    const wIdx = 1 - active;
    if (players[wIdx]) { cb(); return; }

    makeHost(wIdx);
    const next = queue[(cursor + 1) % queue.length];
    players[wIdx] = new window.YT.Player("yt-player-" + wIdx, {
      height: "1", width: "1",
      videoId: next.id,
      host: "https://www.youtube-nocookie.com",
      playerVars: playerVars(next),
      events: {
        onReady: function () { cb(); },
        onStateChange: function (e) { onState(e, wIdx); },
        onError:       function ()  { /* warm player errors are silent */ },
      },
    });
  }

  /* ---- state / error ---- */

  function onState(e, idx) {
    const S = window.YT.PlayerState;

    if (idx !== active) {
      /* Warm player: just let it buffer/play silently during crossfade */
      return;
    }

    if (e.data === S.PLAYING) {
      playing = true;
      ui.playing(true);
      ui.track(queue[cursor].title, queue[cursor].artist);
      if (!pollTimer) pollProgress();
    } else if (e.data === S.BUFFERING) {
      if (ui.loading) ui.loading();
    } else if (e.data === S.PAUSED) {
      if (!xfading) { playing = false; ui.playing(false); }
    } else if (e.data === S.ENDED) {
      if (!xfading) {
        cursor = (cursor + 1) % queue.length;
        loadTrack();
      }
    }
  }

  function onError(idx) {
    if (idx !== active) return;
    cursor = (cursor + 1) % queue.length;
    loadTrack();
  }

  function loadTrack() {
    if (!ap()) return;
    clearXfade();
    try {
      const track = queue[cursor];
      ap().setVolume(100);
      ap().loadVideoById({ videoId: track.id, startSeconds: track.start || 0 });
      playing = true;
      ui.playing(true);
      ui.track(track.title, track.artist);
    } catch (e) {}
  }

  /* ---- progress polling + crossfade trigger ---- */

  function pollProgress() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (!playing) { clearInterval(pollTimer); pollTimer = null; return; }
      try {
        const p = ap();
        if (!p) return;
        const dur = p.getDuration();
        const cur = p.getCurrentTime();
        if (dur <= 0) return;

        ui.progress(cur / dur);

        /* Crossfade trigger */
        if (!xfading) {
          const entry   = queue[cursor];
          const endAt   = (entry.end && entry.end > 0) ? entry.end : dur;
          const remaining = endAt - cur;
          if (remaining > 0 && remaining <= XFADE_SECS) {
            startCrossfade();
          }
        }
      } catch (e) {}
    }, 500);
  }

})();
