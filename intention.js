/* ---------------------------------------------------------------------------
   Session intention — a focus anchor shown on every fresh visit.

   On load, checks sessionStorage (survives theme/image reloads; cleared
   when the tab closes). If nothing saved → prompt. This means changing
   the theme or background does NOT re-ask — only opening a new tab does.
   Press I to change the intention at any time.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  const KEY = "desk-screen:intention-session";

  function load() {
    try { return sessionStorage.getItem(KEY) || null; } catch (e) { return null; }
  }

  function save(text) {
    try { sessionStorage.setItem(KEY, text); } catch (e) {}
  }

  const wrap    = document.getElementById("intention-wrap");
  const input   = document.getElementById("intention-input");
  const display = document.getElementById("intention-display");

  if (!wrap || !input || !display) return;

  function showDisplay(text) {
    display.textContent = "— " + text + " —";
    display.classList.add("on");
  }

  function clearDisplay() {
    display.classList.remove("on");
    display.textContent = "";
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

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter")  { e.preventDefault(); commit(input.value); }
    if (e.key === "Escape") { e.preventDefault(); closePrompt(); }
    e.stopPropagation();
  });

  document.addEventListener("keydown", function (e) {
    if (wrap.classList.contains("open")) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "i" || e.key === "I") { clearDisplay(); openPrompt(); }
  });

  /* Boot: restore from this session or prompt */
  var saved = load();
  if (saved) {
    showDisplay(saved);
  } else {
    setTimeout(openPrompt, 1400);
  }
})();
