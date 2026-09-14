/* ---------------------------------------------------------------------------
   Local files engine — plays whatever sync.py found in the music/ folder,
   shuffled fresh on every visit.

   Switching songs has to feel instant, so the next track is already fetched
   and decoded before you ask for it. Two audio elements take turns: one is
   playing, the other is quietly holding whatever comes next. Pressing next
   swaps them, which costs nothing, and the freed element goes off to fetch
   the following track.
--------------------------------------------------------------------------- */

window.EngineFiles = (function () {
  "use strict";

  let ui = null;
  let order = [];
  let at = 0;

  /* the element that is playing, and the one holding the next track */
  let current = create();
  let warm = create();
  let warmAt = -1;          /* which index `warm` is holding, -1 if nothing */

  function create() {
    const a = new Audio();
    a.preload = "auto";     /* fetch the audio itself, not just its duration */
    return a;
  }

  function wrap(i) {
    return ((i % order.length) + order.length) % order.length;
  }

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
    }
    return copy;
  }

  /* Both elements carry the same listeners; each one ignores events unless it
     is the element currently in front. */
  function listen(a) {
    a.addEventListener("play", function () { if (a === current) ui.playing(true); });
    a.addEventListener("pause", function () { if (a === current) ui.playing(false); });
    a.addEventListener("ended", function () { if (a === current) go(at + 1, true); });
    a.addEventListener("timeupdate", function () {
      if (a === current && a.duration) ui.progress(a.currentTime / a.duration);
    });
    a.addEventListener("error", function () {
      if (a !== current) return;
      ui.notice(order[at] ? order[at].title : "Cannot play", "File would not load");
    });
  }

  function show(track) {
    ui.track(track.title || "Untitled", track.artist || "—");
  }

  /* Start fetching a track in the background. By the time it is asked for,
     the bytes are already here. */
  function prewarm(index) {
    if (order.length < 2) return;
    const want = wrap(index);
    if (warmAt === want) return;
    warmAt = want;
    warm.src = order[want].src;
    warm.load();
  }

  function go(index, autoplay) {
    if (!order.length) return;
    const want = wrap(index);

    if (warmAt === want && warm !== current) {
      /* already fetched — swap the two elements instead of loading anything */
      const previous = current;
      previous.pause();
      current = warm;
      warm = previous;
      warm.removeAttribute("src");
      warm.load();                    /* stop the old one downloading */
      warmAt = -1;
      try { current.currentTime = 0; } catch (e) {}
    } else {
      current.pause();
      current.src = order[want].src;
      current.load();
    }

    at = want;
    show(order[at]);
    ui.progress(0);
    if (autoplay) play();

    prewarm(at + 1);                  /* line up whatever comes after */
  }

  function play() {
    const attempt = current.play();
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

      listen(current);
      listen(warm);

      /* the first track starts downloading now, while you are still looking
         at the picture, so pressing play is immediate */
      go(0, false);
    },

    toggle: function () {
      if (!order.length) return;
      if (current.paused) play(); else current.pause();
    },

    next: function () {
      if (!order.length) return;
      go(at + 1, !current.paused || current.currentTime > 0);
    },

    prev: function () {
      if (!order.length) return;
      /* early in a song this means "previous"; later it means "start over" */
      if (current.currentTime > 3) { current.currentTime = 0; return; }
      go(at - 1, !current.paused || current.currentTime > 0);
    },
  };
})();
