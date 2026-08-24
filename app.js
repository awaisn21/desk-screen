/* ---------------------------------------------------------------------------
   Deskscreen — the shell.

   Shows one background — a still image or a looping clip — remembers which
   one you chose, wires the buttons and the keyboard, and hands playback to
   whichever engine is configured:

       config.js has a clientId  ->  Spotify
       music/ has files          ->  local files
       neither                   ->  a line telling you which to set up
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  /* ---- background --------------------------------------------------------

     Entries are either a still  { base, src }
     or a looping clip           { base, video, poster }

     Whichever one you pick is remembered in this browser, so the screen looks
     the same every morning. Until you pick, it opens on a random one.
  ------------------------------------------------------------------------- */

  const stage = document.getElementById("stage");
  const library = (Array.isArray(window.BACKGROUNDS) && window.BACKGROUNDS.length)
    ? window.BACKGROUNDS
    : [{ base: "#0b0b0f", src: "art/01-dusk.jpg" }];

  const CHOICE_KEY = "deskscreen:background";
  const OLD_CHOICE_KEY = "second-screen:background";   /* pre-rename */
  let clip = null;      /* the <video> element, made only when one is needed */
  let current = -1;

  function remembered() {
    let saved = null;
    try {
      saved = localStorage.getItem(CHOICE_KEY) || localStorage.getItem(OLD_CHOICE_KEY);
    } catch (e) {}
    if (!saved) return -1;
    /* stored by name, so reordering or adding files does not shuffle the pick */
    for (let i = 0; i < library.length; i++) {
      if ((library[i].name || library[i].src || library[i].video) === saved) return i;
    }
    return -1;
  }

  function remember(entry) {
    try {
      localStorage.setItem(CHOICE_KEY, entry.name || entry.src || entry.video);
    } catch (e) {}
  }

  function show(index) {
    const entry = library[((index % library.length) + library.length) % library.length];
    current = library.indexOf(entry);

    stage.style.backgroundColor = entry.base || "#0b0b0f";

    const stillOnly = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (entry.video && !stillOnly) {
      /* the poster fills the frame while the first frames arrive */
      stage.style.backgroundImage = entry.poster ? 'url("' + entry.poster + '")' : "none";

      if (!clip) {
        clip = document.createElement("video");
        clip.muted = true;
        clip.loop = true;
        clip.autoplay = true;
        clip.playsInline = true;
        clip.setAttribute("muted", "");
        clip.setAttribute("playsinline", "");
        clip.setAttribute("aria-hidden", "true");
        clip.className = "clip";
        stage.appendChild(clip);
      }
      clip.hidden = false;
      if (entry.poster) clip.poster = entry.poster;
      clip.src = entry.video;
      const attempt = clip.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    } else {
      if (clip) { clip.pause(); clip.removeAttribute("src"); clip.load(); clip.hidden = true; }
      const still = entry.src || entry.poster;
      if (!still) { stage.style.backgroundImage = "none"; }
      else {
        const img = new Image();
        img.onload = function () {
          if (library[current] === entry) stage.style.backgroundImage = 'url("' + still + '")';
        };
        img.src = still;
      }
    }

    if (background) {
      background.setAttribute(
        "title",
        entry.name ? entry.name + " — click for the next background" : "Change background"
      );
    }
  }

  const background = document.getElementById("background");

  function nextBackground() {
    const index = (current + 1) % library.length;
    show(index);
    remember(library[index]);
  }

  if (background) {
    background.addEventListener("click", nextBackground);
    if (library.length < 2) background.hidden = true;
  }

  /* a clip decoding behind a hidden window is pure waste */
  document.addEventListener("visibilitychange", function () {
    if (!clip || clip.hidden) return;
    if (document.hidden) clip.pause();
    else { const a = clip.play(); if (a && a.catch) a.catch(function () {}); }
  });

  const start = remembered();
  show(start >= 0 ? start : Math.floor(Math.random() * library.length));

  /* ---- the pill ---------------------------------------------------------- */

  const player = document.getElementById("player");
  const playBtn = document.getElementById("play");
  const playIcon = document.getElementById("play-icon");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const titleEl = document.getElementById("title");
  const artistEl = document.getElementById("artist");
  const ring = document.getElementById("ring");

  const CIRCUMFERENCE = 2 * Math.PI * 21.25;
  ring.setAttribute("stroke-dasharray", CIRCUMFERENCE.toFixed(2));
  ring.setAttribute("stroke-dashoffset", CIRCUMFERENCE.toFixed(2));

  const PLAY_PATH = "M7 4.6v14.8a.9.9 0 0 0 1.38.76l11.4-7.4a.9.9 0 0 0 0-1.52L8.38 3.84A.9.9 0 0 0 7 4.6z";
  const PAUSE_PATH = "M6.6 4h3.4v16H6.6zM14 4h3.4v16H14z";

  function text(title, artist) {
    titleEl.textContent = title;
    artistEl.textContent = artist;
    titleEl.title = title;
    artistEl.title = artist;
  }

  const ui = {
    track: function (title, artist) {
      player.setAttribute("data-state", "playing");
      text(title, artist);
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: title, artist: artist, album: "Deskscreen",
          });
        } catch (e) {}
      }
    },

    notice: function (title, detail) {
      player.setAttribute("data-state", "notice");
      text(title, detail);
    },

    playing: function (isPlaying) {
      playIcon.setAttribute("d", isPlaying ? PAUSE_PATH : PLAY_PATH);
      playBtn.setAttribute("data-state", isPlaying ? "playing" : "paused");
      playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    },

    progress: function (fraction) {
      const f = Math.max(0, Math.min(1, fraction || 0));
      ring.setAttribute("stroke-dashoffset", (CIRCUMFERENCE * (1 - f)).toFixed(2));
    },
  };

  /* ---- choose an engine --------------------------------------------------- */

  const engines = {
    spotify: window.EngineSpotify,
    files: window.EngineFiles,
    ambient: window.EngineAmbient,
  };

  function chooseEngine() {
    const wanted = ((window.CONFIG && window.CONFIG.mode) || "auto").toLowerCase();
    if (wanted !== "auto" && engines[wanted]) return engines[wanted];

    /* auto: your Spotify account, then your own files, then the built-in
       generative music, which always works and needs nothing */
    const order = ["spotify", "files", "ambient"];
    for (let i = 0; i < order.length; i++) {
      const engine = engines[order[i]];
      if (engine && engine.available()) return engine;
    }
    return null;
  }

  const engine = chooseEngine();

  if (!engine) {
    ui.notice("No music yet", "Add files to music/ or a Spotify client ID");
  } else {
    Promise.resolve(engine.init(ui)).catch(function () {
      ui.notice("Something went wrong", "Check the browser console");
    });
  }

  function call(method) {
    if (!engine) return;
    try { engine[method](); } catch (e) {}
  }

  playBtn.addEventListener("click", function () { call("toggle"); });
  nextBtn.addEventListener("click", function () { call("next"); });
  prevBtn.addEventListener("click", function () { call("prev"); });

  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); call("toggle"); }
    if (e.code === "ArrowRight") call("next");
    if (e.code === "ArrowLeft") call("prev");
    if (e.key === "b" || e.key === "B") nextBackground();
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    }
  });

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", function () { call("toggle"); });
      navigator.mediaSession.setActionHandler("pause", function () { call("toggle"); });
      navigator.mediaSession.setActionHandler("previoustrack", function () { call("prev"); });
      navigator.mediaSession.setActionHandler("nexttrack", function () { call("next"); });
    } catch (e) {}
  }
})();
