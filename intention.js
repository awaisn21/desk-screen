/* ---------------------------------------------------------------------------
   Session intention — a daily focus anchor.

   On the first open of each day, a prompt asks "What are you working on?"
   The answer is stored in localStorage and shown as a faint italic line above
   the player for the rest of the day. Resets at midnight. Press I to change it.

   Kept separate from app.js intentionally — one concern, one file.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  const KEY_TEXT = "desk-screen:intention";
  const KEY_DATE = "desk-screen:intention-date";

  function dateStamp() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function load() {
    try {
      const text = localStorage.getItem(KEY_TEXT);
      const date = localStorage.getItem(KEY_DATE);
      return (text && date === dateStamp()) ? text : null;
    } catch (e) { return null; }
  }

  function save(text) {
    try {
      localStorage.setItem(KEY_TEXT, text);
      localStorage.setItem(KEY_DATE, dateStamp());
    } catch (e) {}
  }

  const wrap    = document.getElementById("intention-wrap");
  const input   = document.getElementById("intention-input");
  const display = document.getElementById("intention-display");

  if (!wrap || !input || !display) return;

  function showDisplay(text) {
    display.textContent = text;
    display.classList.add("on");
  }

  function clearDisplay() {
    display.classList.remove("on");
  }

  function openPrompt() {
    input.value = "";
    wrap.classList.add("open");
    wrap.removeAttribute("aria-hidden");
    setTimeout(function () { input.focus(); }, 80);
  }

  function closePrompt() {
    wrap.classList.remove("open");
    wrap.setAttribute("aria-hidden", "true");
  }

  function commit(text) {
    closePrompt();
    var clean = (text || "").trim();
    if (!clean) return;
    save(clean);
    showDisplay(clean);
  }

  /* Prevent player shortcuts (space, arrows) from firing while typing */
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter")  { e.preventDefault(); commit(input.value); }
    if (e.key === "Escape") { e.preventDefault(); closePrompt(); }
    e.stopPropagation();
  });

  /* I key: open the prompt to set or change the intention */
  document.addEventListener("keydown", function (e) {
    if (wrap.classList.contains("open")) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "i" || e.key === "I") {
      clearDisplay();
      openPrompt();
    }
  });

  /* Boot: show saved intention, or prompt after a beat */
  var saved = load();
  if (saved) {
    showDisplay(saved);
  } else {
    setTimeout(openPrompt, 1400);
  }
})();
