/* ---------------------------------------------------------------------------
   Local files engine — plays whatever sync.py found in the music/ folder,
   shuffled fresh on every visit.
--------------------------------------------------------------------------- */

window.EngineFiles = (function () {
  "use strict";

  const audio = new Audio();
  audio.preload = "metadata";

  let ui = null;
  let order = [];
  let at = 0;

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
    }
    return copy;
  }

  function show(track) {
    ui.track(track.title || "Untitled", track.artist || "—");
  }

  function load(index, autoplay) {
    if (!order.length) return;
    at = (index + order.length) % order.length;
    const track = order[at];
    audio.src = track.src;
    show(track);
    ui.progress(0);
    if (autoplay) play();
  }

  function play() {
    const attempt = audio.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        ui.playing(false);
        ui.notice(order[at] ? order[at].title : "Cannot play", "File would not load");
      });
    }
  }

  return {
    name: "files",

    available: function () {
      return Array.isArray(window.TRACKS) && window.TRACKS.length > 0;
    },

    init: function (hooks) {
      ui = hooks;
      order = shuffled(window.TRACKS);

      audio.addEventListener("play", function () { ui.playing(true); });
      audio.addEventListener("pause", function () { ui.playing(false); });
      audio.addEventListener("ended", function () { load(at + 1, true); });
      audio.addEventListener("timeupdate", function () {
        if (audio.duration) ui.progress(audio.currentTime / audio.duration);
      });

      load(0, false);
    },

    toggle: function () {
      if (!order.length) return;
      if (audio.paused) play(); else audio.pause();
    },

    next: function () {
      if (!order.length) return;
      load(at + 1, !audio.paused || audio.currentTime > 0);
    },

    prev: function () {
      if (!order.length) return;
      /* early in a song this means "previous"; later it means "start over" */
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      load(at - 1, !audio.paused || audio.currentTime > 0);
    },
  };
})();
