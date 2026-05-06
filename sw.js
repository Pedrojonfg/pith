const CACHE_NAME = "mylearning-v3";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/css/main.css",
  "/src/css/sidebar.css",
  "/src/js/main.js",
  "/src/js/api.js",
  "/src/js/session.js",
  "/src/js/study.js",
  "/src/js/rsvp.js",
  "/src/js/export.js",
  "/src/js/resume.js",
  "/src/js/ui.js",
  "/src/js/guide-chat.js",
  "/src/js/dictionary.js",
  "/src/js/review.js",
  "/src/js/config.js",
  "/manifest.json",
];

const MATHJAX_URLS = [
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/startup.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/input/tex.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...STATIC_ASSETS, ...MATHJAX_URLS]).catch((err) => {
        console.warn("SW cache failed for some assets:", err);
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.hostname === "api.anthropic.com" || url.hostname === "api.deepseek.com";
}

function isStaticAsset(url) {
  return STATIC_ASSETS.includes(url.pathname);
}

function isMathJaxAsset(url) {
  return MATHJAX_URLS.includes(url.href);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (isApiRequest(url)) {
    return;
  }

  if (isStaticAsset(url) || isMathJaxAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          return res;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
