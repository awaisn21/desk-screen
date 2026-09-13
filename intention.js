/* ---------------------------------------------------------------------------
   Session intention — a focus anchor shown on every visit.

   On every page load a prompt asks "What are you working on?"
   The answer is kept in memory and shown as a faint italic line above
   the player for the rest of the session. Press I to change it.
   Resets on refresh — intentionally: set it fresh each time you sit down.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  var sessionIntention = null;

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
    sessionIntention = clean;
    showDisplay(clean);
  }

  /* Prevent player shortcuts (space, arrows) from firing while typing */
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter")  { e.preventDefault(); commit(input.value); }
    if (e.key === "Escape") { e.preventDefault(); closePrompt(); }
    e.stopPropagation();
  });

  /* I key: open the prompt to change the intention */
  document.addEventListener("keydown", function (e) {
    if (wrap.classList.contains("open")) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "i" || e.key === "I") {
      clearDisplay();
      openPrompt();
    }
  });

  /* Boot: always prompt on every visit */
  setTimeout(openPrompt, 1400);
})();
