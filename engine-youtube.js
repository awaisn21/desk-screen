/* ---------------------------------------------------------------------------
   YouTube engine — two playlists keyed on window.DESK_THEME:
     "pakistan" → Pakistani nostalgia songs (Jal, Strings, Atif Aslam, etc.)
     "abstract" → 8D audio Western pop (Alan Walker, Billie Eilish, etc.)

   No API key required. YouTube IFrame Player API is free for embedding.
   The player lives in a 1×1 hidden div; youtube-nocookie.com reduces
   tracking. YouTube handles all licensing — nothing is downloaded.
--------------------------------------------------------------------------- */

window.EngineYouTube = (function () {
  "use strict";

  /* ---- Pakistan theme --------------------------------------------------- */
    const PLAYLIST_PAKISTAN = [
    { id: "WElwTD5GNTg", title: "Aadat",             artist: "Jal",                  start: 0  },
    { id: "q_6FJRdwpm4", title: "Woh Lamhey",        artist: "Jal",                  start: 0  },
    { id: "cdwm9Q7U02o", title: "Sajni",             artist: "Jal",                  start: 0  },
    { id: "IW7xwSVj7gw", title: "Hona Tha Pyaar",   artist: "Atif Aslam",           start: 0  },
    { id: "cAu4H8olnrs", title: "Sajni",             artist: "Strings",              start: 0  },
    { id: "f_-OZwVkB88", title: "Anjane",            artist: "Strings",              start: 0  },
    { id: "8367ETnagHo", title: "Tera Woh Pyar",     artist: "Momina & Asim",        start: 0  },
    { id: "kw4tT7SCmaY", title: "Afreen Afreen",     artist: "Rahat & Momina",       start: 4  },
    { id: "a18py61_F_w", title: "Tajdar-e-Haram",   artist: "Atif Aslam",           start: 3  },
    { id: "ZQMn5wIoAno", title: "Tu Kuja Man Kuja",  artist: "Shiraz Uppal",         start: 5  },
    { id: "T94PHkuydcw", title: "Kun Faya Kun",      artist: "A.R. Rahman",          start: 30 },
    { id: "7e1pL9iAe6o", title: "Mann Ki Lagan",     artist: "Rahat Fateh Ali Khan", start: 0  },
    { id: "VgbGdfCyx48", title: "Sanson Ki Mala",    artist: "Rahat Fateh Ali Khan", start: 0  },
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
    { id: "072lEafKN7k", title: "Serena",              artist: "Safari",                 start: 0 },
    { id: "C5Fvcb3KJfc", title: "Chemtrails",          artist: "Lana Del Rey",           start: 0 },
    { id: "GsYbkLNIo-4", title: "Die With A Smile",   artist: "Lady Gaga & Bruno Mars", start: 0 },
  ];

  /* Pick playlist based on active theme */
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
  let player      = null;
  let queue       = [];
  let cursor      = 0;
  let playing     = false;
  let apiReady    = false;
  let pendingPlay = false;   /* toggle() called before player was ready */

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
      ui.playing(false);

      return new Promise(function (resolve) {
        if (window.YT && window.YT.Player) {
          createPlayer(resolve);
          return;
        }

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
      if (!player) { pendingPlay = !pendingPlay; return; }
      try {
        if (playing) {
          player.pauseVideo();
          pendingPlay = false;
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
    const host = document.createElement("div");
    host.id = "yt-player-host";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;" +
      "bottom:0;left:0;z-index:-1;";
    document.body.appendChild(host);

    const track = queue[cursor];
    player = new window.YT.Player("yt-player-host", {
      height: "1",
      width: "1",
      videoId: track.id,
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay:        0,
        controls:        0,
        disablekb:       1,
        fs:              0,
        iv_load_policy:  3,
        modestbranding:  1,
        rel:             0,
        origin:          window.location.origin || "http://127.0.0.1",
        enablejsapi:     1,
        playsinline:     1,
        start:           track.start || 0,
      },
      events: {
        onReady: function () {
          done();
          if (pendingPlay) { try { player.playVideo(); } catch (e) {} }
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
      ui.track(queue[cursor].title, queue[cursor].artist);
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
    /* Video unavailable — skip silently */
    cursor = (cursor + 1) % queue.length;
    loadTrack();
  }

  function loadTrack() {
    if (!player) return;
    try {
      const track = queue[cursor];
      player.loadVideoById({ videoId: track.id, startSeconds: track.start || 0 });
      playing = true;
      ui.playing(true);
      ui.track(track.title, track.artist);
    } catch (e) {}
  }

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
