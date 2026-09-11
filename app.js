/* ---------------------------------------------------------------------------
   Desk Screen — the shell.

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

  const CHOICE_KEY = "desk-screen:background";
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

  /* Each artwork gets a canvas of its own, drawn once while the page is idle.
     A canvas keeps its pixels whether or not it is visible, so after that
     first draw, changing artwork is only a change of which canvas is on top —
     no vector work left at the moment you click.

     Drawing costs real time for detailed art (Hill Town is 3 MB of paths), so
     it happens up front, spread across idle moments, never on the click. */

  const canvases = library.map(makeCanvas);
  const drawn = library.map(function () { return false; });

  function makeCanvas() {
    const c = document.createElement("canvas");
    c.className = "plate";
    c.setAttribute("aria-hidden", "true");
    stage.appendChild(c);
    return c;
  }

  function wrapIndex(i) {
    return ((i % library.length) + library.length) % library.length;
  }

  function targetSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cap = 2560;                       /* enough for any laptop display */
    let w = Math.round(window.innerWidth * dpr);
    let h = Math.round(window.innerHeight * dpr);
    if (w > cap) { h = Math.round(h * (cap / w)); w = cap; }
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  /* draw one artwork into its canvas, cropped like background-size: cover */
  function paint(i) {
    const entry = library[i];
    const src = entry.src || entry.poster;
    const canvas = canvases[i];
    if (!src || !canvas) return Promise.resolve(false);

    const size = targetSize();
    return new Promise(function (done) {
      const img = new Image();
      img.decoding = "async";
      img.onload = function () {
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext("2d", { alpha: false });
        const iw = img.naturalWidth || size.w;
        const ih = img.naturalHeight || size.h;
        const scale = Math.max(size.w / iw, size.h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = entry.base || "#0b0b0f";
        ctx.fillRect(0, 0, size.w, size.h);
        ctx.drawImage(img, (size.w - dw) / 2, (size.h - dh) / 2, dw, dh);
        drawn[i] = true;
        done(true);
      };
      img.onerror = function () { done(false); };
      img.src = src;
    });
  }

  function reveal(i) {
    canvases.forEach(function (c, n) { c.classList.toggle("on", n === i); });
  }

  /* draw everything that is not drawn yet, one at a time, while idle */
  function warmArtwork() {
    const queue = [];
    for (let n = 1; n <= library.length; n++) {
      const i = wrapIndex(current + n);
      if (!drawn[i] && !library[i].video) queue.push(i);
    }
    (function step() {
      const i = queue.shift();
      if (i === undefined) return;
      paint(i).then(function () {
        if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 900 });
        else setTimeout(step, 60);
      });
    })();
  }

  function show(index) {
    const want = wrapIndex(index);
    const entry = library[want];
    current = want;

    stage.style.backgroundColor = entry.base || "#0b0b0f";

    const stillOnly = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (entry.video && !stillOnly) {
      canvases.forEach(function (c) { c.classList.remove("on"); });
      if (!clip) {
        clip = document.createElement("video");
        clip.muted = true; clip.loop = true; clip.autoplay = true; clip.playsInline = true;
        clip.setAttribute("muted", ""); clip.setAttribute("playsinline", "");
        clip.setAttribute("aria-hidden", "true");
        clip.className = "clip";
        stage.appendChild(clip);
      }
      clip.hidden = false;
      clip.src = entry.video;
      const attempt = clip.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
      label(entry);
      return;
    }

    if (clip) { clip.pause(); clip.removeAttribute("src"); clip.load(); clip.hidden = true; }

    if (drawn[want]) {
      reveal(want);                       /* the common case: instant */
    } else {
      paint(want).then(function () { if (current === want) reveal(want); });
    }
    label(entry);
  }

  function label(entry) {
    if (!background) return;
    background.setAttribute(
      "title",
      entry.name ? entry.name + " — click for the next background" : "Change background"
    );
  }

  /* a resized window means every canvas is the wrong size now */
  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const size = targetSize();
      const c = canvases[current];
      if (c && c.width === size.w && c.height === size.h) return;
      for (let i = 0; i < drawn.length; i++) drawn[i] = false;
      paint(current).then(function () { reveal(current); warmArtwork(); });
    }, 300);
  });

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


  /* Pick an artwork that matches the time of day when no preference is saved.
     Names are substrings of the 'name' field in backgrounds.js. */
  function timeBasedArtIndex() {
    var h = new Date().getHours();
    var sets;
    if      (h >= 5  && h < 11) sets = ["ocean-shore", "alpine-valley"];
    else if (h >= 11 && h < 17) sets = ["focus-landscape", "hill-town"];
    else if (h >= 17 && h < 21) sets = ["sunset-bay", "crimson-eclipse"];
    else                         sets = ["aurora-watch", "nightfloor"];

    for (var s = 0; s < sets.length; s++) {
      for (var k = 0; k < library.length; k++) {
        var name = library[k].name || library[k].src || "";
        if (name.indexOf(sets[s]) !== -1) return k;
      }
    }
    return Math.floor(Math.random() * library.length);
  }

  const start = remembered();
  show(start >= 0 ? start : timeBasedArtIndex());

  /* fetch the rest once the first one is on screen */
  if (window.requestIdleCallback) requestIdleCallback(warmArtwork, { timeout: 1500 });
  else setTimeout(warmArtwork, 300);

  /* ---- the pill ---------------------------------------------------------- */

  const player = document.getElementById("player");
  const playBtn = document.getElementById("play");
  const playIcon = document.getElementById("play-icon");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const titleEl = document.getElementById("title");
  const artistEl = document.getElementById("artist");
  const ring = document.getElementById("ring");

  let sounding = false;     /* is anything actually audible right now */

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
            title: title, artist: artist, album: "Desk Screen",
          });
        } catch (e) {}
      }
    },

    notice: function (title, detail) {
      player.setAttribute("data-state", "notice");
      text(title, detail);
    },

    playing: function (isPlaying) {
      sounding = isPlaying;
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
    youtube: window.EngineYouTube,
    ambient: window.EngineAmbient,
  };

  function chooseEngine() {
    const wanted = ((window.CONFIG && window.CONFIG.mode) || "auto").toLowerCase();
    if (wanted !== "auto" && engines[wanted]) return engines[wanted];

    /* auto: your Spotify account, then your own files, then the built-in
       generative music, which always works and needs nothing */
    const order = ["spotify", "files", "youtube", "ambient"];
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

  function autostart() {
    if (!engine) return;
    call("toggle");                       /* allowed in some browsers */

    setTimeout(function () {
      if (sounding) return;               /* it worked, nothing to arm */
      const kick = function () {
        if (sounding) { release(); return; }
        call("toggle");
        release();
      };
      const release = function () {
        ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (e) {
          window.removeEventListener(e, kick, true);
        });
      };
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (e) {
        window.addEventListener(e, kick, { capture: true, once: false });
      });
    }, 500);
  }

  autostart();

  /* Auto-drift: change the background every 8-12 minutes so the screen
     feels alive. Uses nextBackground() which also saves the pick. */
  (function scheduleDrift() {
    var delay = (8 + Math.random() * 4) * 60 * 1000;
    setTimeout(function () { nextBackground(); scheduleDrift(); }, delay);
  })();

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
