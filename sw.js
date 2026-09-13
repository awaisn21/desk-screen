/* ---------------------------------------------------------------------------
   Desk Screen — service worker  (v3)

   Shell (HTML/CSS/JS): cached on install, served from cache indefinitely.
   Art + video: stale-while-revalidate — serve instantly from cache, refresh
   in the background so new art appears on the next visit without any delay
   on the current one. This makes repeat visits nearly instant offline.
--------------------------------------------------------------------------- */

const CACHE = "desk-screen-v3";

const SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/intention.js",
  "/engine-ambient.js",
  "/engine-files.js",
  "/engine-spotify.js",
  "/engine-youtube.js",
  "/config.js",
  "/tracks.js",
  "/backgrounds.js",
  "/themes.js",
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

  /* Shell: cache-first */
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type !== "opaque") {
          const clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      });
    })
  );
});
