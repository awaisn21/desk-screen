/* ---------------------------------------------------------------------------
   Themes — Abstract or Pakistan.

   Runs before app.js so it can set window.DESK_THEME and override
   window.CONFIG.mode before the engine is chosen and the library is built.

   Abstract  — the original vector SVG artwork + generative ambient music.
   Pakistan  — cinematic Pakistani photography (pk-*.jpg) + YouTube playlist.

   Art convention: Pakistani photos are named pk-*.jpg / pk-*.webp in art/.
   sync.py picks them up automatically; no extra config needed.
--------------------------------------------------------------------------- */

window.DeskThemes = (function () {
  "use strict";

  const KEY   = "desk-screen:theme";
  const NAMES = ["abstract", "pakistan"];

  const LABELS = {
    abstract: "Abstract",
    pakistan: "Pakistan",
  };

  /* Music engine each theme prefers. Overrides CONFIG.mode at load time
     so the engine chooser in app.js picks the right one. */
  const MUSIC = {
    abstract: "ambient",
    pakistan: "youtube",
  };

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(name) {
    try { localStorage.setItem(KEY, name); } catch (e) {}
  }

  /* Determine starting theme: stored choice → default "abstract" */
  const current = NAMES.includes(stored()) ? stored() : "abstract";

  /* Expose so app.js can filter the backgrounds library */
  window.DESK_THEME = current;

  /* Override music mode before app.js runs its chooseEngine() */
  if (window.CONFIG) {
    /* Only override if the user hasn't explicitly forced a mode */
    const forced = window.CONFIG.mode && window.CONFIG.mode !== "auto";
    if (!forced) {
      window.CONFIG.mode = MUSIC[current];
    }
  }

  /* ---- public API ---- */
  return {

    current: current,

    label: function (name) { return LABELS[name] || name; },

    /* Cycle to the next theme and reload — the cleanest way to swap
       engines and re-filter the background library */
    cycle: function () {
      const idx  = NAMES.indexOf(current);
      const next = NAMES[(idx + 1) % NAMES.length];
      save(next);
      window.location.reload();
    },

    /* True for backgrounds that belong to the current theme:
         abstract → anything NOT prefixed pk-
         pakistan → only entries prefixed pk- (falls back to all if none exist) */
    filter: function (library) {
      if (current === "pakistan") {
        const pk = library.filter(function (e) {
          const id = e.name || e.src || e.video || "";
          return id.indexOf("pk-") !== -1;
        });
        return pk.length ? pk : library;   /* graceful fallback until photos exist */
      }
      /* abstract: everything that is not a Pakistani photo */
      const abs = library.filter(function (e) {
        const id = e.name || e.src || e.video || "";
        return id.indexOf("pk-") === -1;
      });
      return abs.length ? abs : library;
    },
  };

})();
