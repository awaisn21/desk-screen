/* ---------------------------------------------------------------------------
   Ambient engine — original generative music, made in the browser.

   Nothing is downloaded and nothing is a recording. Six pieces, each a set of
   rules: a scale, a register, how often notes arrive, what a note sounds like,
   and a slow chord cycle underneath. The notes themselves are chosen fresh
   every time, so a piece never plays the same way twice and never ends.

   Built to be left running: a handful of voices at a time, no animation loop,
   and a one-second timer for the ring. It costs almost nothing to keep open.
--------------------------------------------------------------------------- */

window.EngineAmbient = (function () {
  "use strict";

  /* Partials are ratios against the note's fundamental, with a gain and an
     optional detune in cents. Inharmonic ratios read as metal and glass;
     whole-number ratios read as wood and voice. */

  const PIECES = [
    {
      name: "Glass Bay",
      note: "high, sparse, bell-like",
      root: 261.63,                       /* C4 */
      scale: [0, 2, 4, 7, 9, 12, 14, 16], /* lydian pentatonic, two octaves */
      cycle: [0, -3, -5, 2],              /* semitone shifts across the cycle */
      cycleSeconds: 200,
      gapRange: [3.5, 9],
      partials: [
        { ratio: 1, gain: 0.5 },
        { ratio: 2.01, gain: 0.18 },
        { ratio: 3.02, gain: 0.09 },
        { ratio: 4.98, gain: 0.04 },
      ],
      attack: [1.5, 3.5], release: [7, 13],
      cutoff: [900, 2600],
      drone: 0.10,
    },
    {
      name: "Long Dusk",
      note: "warm, low, close",
      root: 220.0,                        /* A3 */
      scale: [0, 3, 5, 7, 10, 12, 15],    /* minor pentatonic + fourth */
      cycle: [0, -2, -5, -7],
      cycleSeconds: 240,
      gapRange: [5, 12],
      partials: [
        { ratio: 0.5, gain: 0.30 },
        { ratio: 1, gain: 0.44 },
        { ratio: 2, gain: 0.14, detune: 7 },
        { ratio: 3, gain: 0.05 },
      ],
      attack: [3, 6], release: [10, 18],
      cutoff: [380, 1100],
      drone: 0.16,
    },
    {
      name: "Snowfield",
      note: "very sparse, pure tone",
      root: 293.66,                       /* D4 */
      scale: [0, 2, 3, 5, 7, 9, 12, 14, 19],  /* dorian, wide */
      cycle: [0, 5, -2, 3],
      cycleSeconds: 300,
      gapRange: [7, 16],
      partials: [
        { ratio: 1, gain: 0.55 },
        { ratio: 2, gain: 0.10, detune: -5 },
      ],
      attack: [4, 8], release: [12, 22],
      cutoff: [1200, 3200],
      drone: 0.05,
    },
    {
      name: "Harbour",
      note: "drifting, detuned pads",
      root: 196.0,                        /* G3 */
      scale: [0, 2, 4, 7, 9, 10, 12, 16],  /* mixolydian colour */
      cycle: [0, 3, -4, -2],
      cycleSeconds: 220,
      gapRange: [3, 8],
      partials: [
        { ratio: 1, gain: 0.34, detune: -9 },
        { ratio: 1, gain: 0.34, detune: 9 },
        { ratio: 2, gain: 0.12 },
        { ratio: 2.99, gain: 0.05, detune: 4 },
      ],
      attack: [2, 5], release: [8, 15],
      cutoff: [500, 1600],
      drone: 0.13,
    },
    {
      name: "Slow Metal",
      note: "rare, struck, inharmonic",
      root: 185.0,                        /* F#3 */
      scale: [0, 2, 7, 9, 14, 16, 21],
      cycle: [0, -5, 2, -7],
      cycleSeconds: 260,
      gapRange: [8, 18],
      partials: [
        { ratio: 1, gain: 0.40 },
        { ratio: 2.76, gain: 0.16 },
        { ratio: 5.40, gain: 0.07 },
        { ratio: 8.93, gain: 0.03 },
      ],
      attack: [0.6, 2], release: [14, 24],
      cutoff: [700, 2200],
      drone: 0.08,
    },
    {
      name: "Nightfloor",
      note: "almost only drone",
      root: 164.81,                       /* E3 */
      scale: [0, 3, 7, 10, 12, 15],
      cycle: [0, -2, -4, -5],
      cycleSeconds: 320,
      gapRange: [12, 26],
      partials: [
        { ratio: 0.5, gain: 0.34 },
        { ratio: 1, gain: 0.30, detune: 6 },
        { ratio: 1.5, gain: 0.08 },
      ],
      attack: [5, 10], release: [16, 28],
      cutoff: [240, 700],
      drone: 0.22,
    },
    {
      name: "Old House",
      note: "warm, high, half-remembered",
      root: 523.25,                       /* C5 — bright, childhood register */
      scale: [0, 2, 4, 7, 9, 12],         /* C major pentatonic, simple */
      cycle: [0, 2, -2, 0],
      cycleSeconds: 360,
      gapRange: [6, 16],
      partials: [
        { ratio: 1,    gain: 0.44 },
        { ratio: 2,    gain: 0.22, detune: -4 },
        { ratio: 3.01, gain: 0.09 },
        { ratio: 4.02, gain: 0.04 },
      ],
      attack: [0.4, 1.4], release: [5, 9],
      cutoff: [1800, 4200],
      drone: 0.04,
    },
  ];

  let ui = null;
  let ctx = null;
  let master = null;      /* everything lands here */
  let wet = null;         /* reverb send */
  let voices = null;      /* per-note bus, so the drone is independent */
  let drone = null;       /* { stop() } */
  let scheduler = null;
  let ringTimer = null;

  let index = 0;
  let playing = false;
  let startedAt = 0;      /* ctx.currentTime when the current piece began */
  let live = 0;           /* voices currently sounding */

  const MAX_VOICES = 7;

  function between(range) {
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ---- reverb: a synthesized impulse, no file needed --------------------- */

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        /* noise shaped by an exponential tail, plus a slow early build so it
           reads as a room rather than a gate */
        const t = i / length;
        const swell = Math.min(1, t * 18);
        data[i] = (Math.random() * 2 - 1) * swell * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(5.5, 2.6);

    wet = ctx.createGain();
    wet.gain.value = 0.55;
    wet.connect(reverb);
    reverb.connect(master);

    voices = ctx.createGain();
    voices.gain.value = 0.9;
    voices.connect(master);
    voices.connect(wet);
  }

  /* ---- one note --------------------------------------------------------- */

  function note(piece, frequency) {
    if (live >= MAX_VOICES) return;
    live++;

    const now = ctx.currentTime;
    const attack = between(piece.attack);
    const release = between(piece.release);
    const hold = between([1, 4]);
    const peak = 0.22;

    const shell = ctx.createGain();
    shell.gain.setValueAtTime(0.0001, now);
    shell.gain.exponentialRampToValueAtTime(peak, now + attack);
    shell.gain.setValueAtTime(peak, now + attack + hold);
    shell.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.6;
    const open = between(piece.cutoff);
    filter.frequency.setValueAtTime(open * 0.55, now);
    filter.frequency.linearRampToValueAtTime(open, now + attack + hold);
    filter.frequency.linearRampToValueAtTime(open * 0.4, now + attack + hold + release);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() * 2 - 1) * 0.65;

    filter.connect(shell);
    if (pan) { shell.connect(pan); pan.connect(voices); } else { shell.connect(voices); }

    const oscillators = piece.partials.map(function (partial) {
      const osc = ctx.createOscillator();
      osc.type = partial.ratio < 1.01 && partial.ratio > 0.99 ? "triangle" : "sine";
      osc.frequency.value = frequency * partial.ratio;
      if (partial.detune) osc.detune.value = partial.detune;

      const level = ctx.createGain();
      level.gain.value = partial.gain;

      osc.connect(level);
      level.connect(filter);
      osc.start(now);
      osc.stop(now + attack + hold + release + 0.2);
      return osc;
    });

    const last = oscillators[oscillators.length - 1];
    if (last) last.onended = function () { live = Math.max(0, live - 1); };
    else live = Math.max(0, live - 1);
  }

  /* ---- the drone underneath --------------------------------------------- */

  function startDrone(piece) {
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(piece.drone, now + 1.8);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = piece.cutoff[0] * 0.9;
    filter.connect(bus);
    bus.connect(voices);

    /* a very slow sweep so the floor is never quite still */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.013;
    const depth = ctx.createGain();
    depth.gain.value = piece.cutoff[0] * 0.35;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    lfo.start(now);

    const parts = [
      { ratio: 0.5, gain: 0.5, detune: -6 },
      { ratio: 0.5, gain: 0.5, detune: 6 },
      { ratio: 0.75, gain: 0.22 },
    ];

    const oscillators = parts.map(function (part) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = piece.root * part.ratio;
      if (part.detune) osc.detune.value = part.detune;
      const level = ctx.createGain();
      level.gain.value = part.gain;
      osc.connect(level);
      level.connect(filter);
      osc.start(now);
      return osc;
    });

    return {
      stop: function () {
        const t = ctx.currentTime;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), t);
        bus.gain.exponentialRampToValueAtTime(0.0001, t + 2);
        oscillators.concat([lfo]).forEach(function (osc) {
          try { osc.stop(t + 2.2); } catch (e) {}
        });
      },
    };
  }

  /* ---- the piece as a whole --------------------------------------------- */

  function shiftNow(piece) {
    const elapsed = ctx.currentTime - startedAt;
    const step = piece.cycleSeconds / piece.cycle.length;
    return piece.cycle[Math.floor(elapsed / step) % piece.cycle.length];
  }

  function scheduleNext(piece) {
    const gap = between(piece.gapRange);
    scheduler = setTimeout(function () {
      if (!playing) return;
      const semitone = pick(piece.scale) + shiftNow(piece);
      note(piece, piece.root * Math.pow(2, semitone / 12));
      /* now and then, a second note a fifth or octave away */
      if (Math.random() < 0.28) {
        const partner = semitone + pick([7, 12, -12, 5]);
        setTimeout(function () {
          if (playing) note(piece, piece.root * Math.pow(2, partner / 12));
        }, 400 + Math.random() * 1800);
      }
      scheduleNext(piece);
    }, gap * 1000);
  }

  function startRing(piece) {
    if (ringTimer) clearInterval(ringTimer);
    ringTimer = setInterval(function () {
      if (!playing || !ctx) return;
      const elapsed = (ctx.currentTime - startedAt) % piece.cycleSeconds;
      ui.progress(elapsed / piece.cycleSeconds);
    }, 1000);
  }

  function stopSound(fade) {
    playing = false;
    if (scheduler) { clearTimeout(scheduler); scheduler = null; }
    if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    if (drone) { drone.stop(); drone = null; }
    if (master && ctx) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + (fade || 1.5));
    }
  }

  function startSound() {
    const piece = PIECES[index];
    playing = true;
    startedAt = ctx.currentTime;

    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.8, t + 0.6);

    drone = startDrone(piece);
    /* one note straight away so it does not open on silence */
    note(piece, piece.root * Math.pow(2, pick(piece.scale) / 12));
    scheduleNext(piece);
    startRing(piece);

    ui.track(piece.name, piece.note);
    ui.playing(true);
  }

  function change(step) {
    const wasPlaying = playing;
    stopSound(0.35);
    index = (index + step + PIECES.length) % PIECES.length;
    const piece = PIECES[index];
    ui.track(piece.name, piece.note);
    ui.progress(0);
    if (!wasPlaying) { ui.playing(false); return; }
    setTimeout(function () { if (ctx) startSound(); }, 120);
  }

  return {
    name: "ambient",

    available: function () { return true; },

    init: function (hooks) {
      ui = hooks;
      /* pick a starting piece by the hour so the environment matches the day */
      var h = new Date().getHours();
      if      (h >= 5  && h < 10) index = 6;  /* Old House  — nostalgic morning    */
      else if (h >= 10 && h < 16) index = 0;  /* Glass Bay  — clear, focused day   */
      else if (h >= 16 && h < 20) index = 1;  /* Long Dusk  — golden hour          */
      else if (h >= 20 && h < 23) index = 3;  /* Harbour    — late evening drift   */
      else                         index = 5;  /* Nightfloor — deep night           */
      const piece = PIECES[index];
      ui.track(piece.name, piece.note);
      ui.playing(false);
    },

    toggle: function () {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) { ui.notice("No audio support", "Try Chrome or Safari"); return; }
        ctx = new Ctor();
        build();
      }
      if (ctx.state === "suspended") ctx.resume();

      if (playing) { stopSound(0.4); ui.playing(false); }
      else startSound();
    },

    next: function () { change(1); },
    prev: function () { change(-1); },

    /* exposed so the test harness can render the same synthesis offline */
    _pieces: PIECES,
  };
})();
