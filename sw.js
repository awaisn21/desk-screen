/* ---------------------------------------------------------------------------
   Desk Screen — service worker  (v5)

   Shell (HTML/CSS/JS): network-first with cache fallback for offline.
   Art + video: stale-while-revalidate — serve instantly from cache, refresh
   in the background so new art appears on the next visit without any delay
   on the current one. This makes repeat visits nearly instant offline.
--------------------------------------------------------------------------- */

const CACHE = "desk-screen-v5";

const SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/config.js",
  "/tracks.js",
  "/src/themes.js",
  "/src/backgrounds.js",
  "/src/engine-spotify.js",
  "/src/engine-files.js",
  "/src/engine-ambient.js",
  "/src/engine-youtube.js",
  "/src/app.js",
  "/src/intention.js",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.allSettled(
        SHELL.map(function (url) { return cache.add(url).catch(function () {}); })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  /* Art and video: stale-while-revalidate
     → serve from cache immediately (no network wait)
     → refresh cache in the background so new files appear next visit */
  if (url.pathname.startsWith("/art/") || url.pathname.startsWith("/video/")) {
    e.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          var networkFetch = fetch(e.request).then(function (res) {
            if (res && res.status === 200 && res.type !== "opaque") {
              cache.put(e.request, res.clone());
            }
            return res;
          }).catch(function () { return cached; });

          /* Return cached immediately, fetch in background */
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  /* Shell: network-first → always serves fresh JS/HTML on new deploys.
     Falls back to cache so the app still loads when offline. */
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type !== "opaque") {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
