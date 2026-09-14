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
  const _allBackgrounds = (Array.isArray(window.BACKGROUNDS) && window.BACKGROUNDS.length)
    ? window.BACKGROUNDS
    : [{ base: "#0b0b0f", src: "art/01-dusk.jpg" }];

  /* Filter to the current theme's art set — Abstract (vector SVGs) or
     Pakistan (pk-* photos). DeskThemes.filter() falls back to all entries
     when the theme's art hasn't been added yet. */
  const library = window.DeskThemes ? window.DeskThemes.filter(_allBackgrounds) : _allBackgrounds;

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

  function makeCanvas(entry) {
    const div = document.createElement("div");
    div.className = "plate";
    div.style.backgroundColor = entry.base || "#0b0b0f";
    div.setAttribute("aria-hidden", "true");
    stage.appendChild(div);
    return div;
  }

  function wrapIndex(i) {
    return ((i % library.length) + library.length) % library.length;
  }

  /* paint: set CSS background-image on the div immediately.
     The browser renders progressively — base colour shows at once,
     image pixels appear as network bytes arrive. No promise needed. */
  function paint(i) {
    const entry = library[i];
    const src = entry.src || entry.poster;
    const plate = canvases[i];
    if (!plate || drawn[i]) return;
    plate.style.backgroundColor = entry.base || "#0b0b0f";
    if (src) plate.style.backgroundImage = "url('" + src + "')";
    drawn[i] = true;
  }

  function reveal(i) {
    canvases.forEach(function (c, n) { c.classList.toggle("on", n === i); });
  }

  /* Pre-warm the 3 backgrounds adjacent to the current one.
     paint() is now synchronous (CSS background-image), so this is cheap — 
     it just sets a URL; the browser fetches in the background. */
  function warmArtwork() {
    for (let n = 1; n <= 3; n++) {
      const i = wrapIndex(current + n);
      if (!drawn[i] && !library[i].video) paint(i);
    }
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

    if (!drawn[want]) paint(want);
    reveal(want);                         /* instant: base colour → image */
    label(entry);
  }

  function label(entry) {
    if (!background) return;
    background.setAttribute(
      "title",
      entry.name ? entry.name + " — click for the next background" : "Change background"
    );
  }

  /* No resize handler needed — CSS background-size: cover scales automatically. */

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
    if      (h >= 5  && h < 11) sets = ["Arctic Dawn", "Alpine Valley", "Ocean Shore"];
    else if (h >= 11 && h < 17) sets = ["Focus Landscape", "Hill Town"];
    else if (h >= 17 && h < 21) sets = ["Sunset Bay", "Salt Flat Dusk"];
    else                         sets = ["Volcanic Night", "Sunset Valley"];

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

  /* prime the next 3 backgrounds after the first paint settles */
  setTimeout(warmArtwork, 200);

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

  function applyMarquee(el) {
    el.classList.remove("marquee");
    el.style.animationDuration = "";
    var probe = el.cloneNode(true);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;overflow:visible;width:auto;animation:none;";
    document.body.appendChild(probe);
    var textWidth = probe.scrollWidth;
    document.body.removeChild(probe);
    var slotWidth = el.parentElement ? el.parentElement.offsetWidth : 160;
    if (textWidth > slotWidth) {
      el.textContent = el.textContent + "      " + el.textContent;
      el.classList.add("marquee");
      el.style.animationDuration = Math.round(textWidth / 45) + "s";
    }
  }

  function text(title, artist) {
    titleEl.textContent = title;
    artistEl.textContent = artist;
    titleEl.title = title;
    artistEl.title = artist;
    applyMarquee(titleEl);
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

    loading: function () {
      player.setAttribute("data-state", "loading");
      playBtn.setAttribute("data-state", "loading");
      playIcon.setAttribute("d", PLAY_PATH);
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
    ui.loading();
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

  /* ---- theme toggle ---- */
  (function () {
    var btn   = document.getElementById("theme-toggle");
    var label = document.getElementById("theme-label");
    if (!btn || !window.DeskThemes) return;

    var cur  = window.DeskThemes.current;
    var next = cur === "abstract" ? "Pakistan" : "Abstract";
    if (label) label.textContent = next;
    btn.setAttribute("aria-label", "Switch to " + next + " theme");
    btn.setAttribute("title",
      "Now: " + (cur === "abstract" ? "Abstract" : "Pakistan") +
      " • click for " + next
    );

    btn.addEventListener("click", function () {
      window.DeskThemes.cycle();
    });
  })();

    if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", function () { call("toggle"); });
      navigator.mediaSession.setActionHandler("pause", function () { call("toggle"); });
      navigator.mediaSession.setActionHandler("previoustrack", function () { call("prev"); });
      navigator.mediaSession.setActionHandler("nexttrack", function () { call("next"); });
    } catch (e) {}
  }

  /* ---- PWA install button (always visible) ---- */
  (function () {
    var installBtn = document.getElementById("install-btn");
    if (!installBtn) return;
    var deferred = null;
    var installed = false;

    /* Capture native install prompt when browser offers it */
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
    });

    /* Hide only if actually installed as a PWA */
    window.addEventListener("appinstalled", function () {
      installed = true;
      installBtn.hidden = true;
      deferred = null;
    });

    /* Detect already-running as standalone (PWA) */
    if (window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true) {
      installed = true;
      installBtn.hidden = true;
    }

    installBtn.addEventListener("click", function () {
      if (installed) return;

      if (deferred) {
        /* Chrome / Edge / Android — native prompt */
        deferred.prompt();
        deferred.userChoice.then(function (result) {
          if (result.outcome === "accepted") {
            installBtn.hidden = true;
            installed = true;
          }
          deferred = null;
        }).catch(function () {});
        return;
      }

      /* iOS Safari or already-installed without prompt — show tooltip */
      var tip = document.getElementById("install-tip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "install-tip";
        tip.setAttribute("role", "tooltip");
        tip.style.cssText = [
          "position:fixed",
          "left:44px",
          "bottom:156px",
          "max-width:240px",
          "padding:10px 14px",
          "border-radius:12px",
          "background:rgba(20,20,20,0.92)",
          "-webkit-backdrop-filter:blur(20px)",
          "backdrop-filter:blur(20px)",
          "color:#f8f6f2",
          "font-size:12px",
          "line-height:1.5",
          "z-index:9999",
          "pointer-events:none",
          "box-shadow:0 8px 32px rgba(0,0,0,0.5)",
        ].join(";");

        var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        tip.textContent = isIOS
          ? "Tap the Share button, then \"Add to Home Screen\" to install."
          : "Open this site in Chrome or Edge and use the install button in the address bar.";
        document.body.appendChild(tip);
        setTimeout(function () { tip && tip.remove(); }, 4000);
      }
    });
  })();
})();
