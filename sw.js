// Bump all four version markers together: CACHE_NAME, SW_VERSION, splash.js?v=, and index.html script ?v= neighbors.
const CACHE_NAME = "pith-v171";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/css/main.css",
  "/src/css/sidebar.css",
  "/src/css/slow-mode.css",
  "/src/css/cloze-mode.css",
  "/src/css/recall-mode.css",
  "/src/css/graph.css",
  "/src/css/mnemonic.css",
  "/src/css/design-enforcement.css",
  "/src/js/main.js",
  "/src/js/offline.js",
  "/src/js/api.js",
  "/src/js/session.js",
  "/src/js/study.js",
  "/src/js/rsvp.js",
  "/src/js/paced-reader.js",
  "/src/js/export.js",
  "/src/js/resume.js",
  "/src/js/ui.js",
  "/src/js/guide-chat.js",
  "/src/js/markdown.js",
  "/src/js/dictionary.js",
  "/src/js/shuffle-options.js",
  "/src/js/sneakPeek.js",
  "/src/js/graph/build.js",
  "/src/js/graph/adapters.js",
  "/src/js/graph/proximity.js",
  "/src/js/graph/canvas.js",
  "/src/js/graph/view.js",
  "/src/js/graph/ids.js",
  "/src/js/slow/sidebar.js",
  "/src/js/slow/headings.js",
  "/src/js/slow/reader.js",
  "/src/js/slow/phase0.js",
  "/src/js/slow/phase3.js",
  "/src/js/slow/gamification.js",
  "/src/js/slow/pagination.js",
  "/src/js/slow/annotations.js",
  "/src/js/review.js",
  "/src/js/mnemonic.js",
  "/src/js/cloze/normalize.js",
  "/src/js/cloze/pipeline.js",
  "/src/js/cloze/study.js",
  "/src/js/config.js",
  "/src/js/llm.js",
  "/src/js/sw-update.js",
  "/src/js/splash.js",
  "/src/js/pwa-install.js",
  "/src/js/text-boundaries.js",
  "/src/js/scope-selection.js",
  "/src/js/read-mode.js",
  "/src/js/read-visuals.js",
  "/manifest.json",
];

const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@15/marked.min.js";
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

const MATHJAX_URLS = [
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/startup.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/input/tex.js",
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml.js",
];

self.addEventListener("install", (event) => {
  // [debug-enrich]
  console.info("[sw.install] Install start:", {
    cacheName: CACHE_NAME,
    staticAssetCount: STATIC_ASSETS.length,
    hasActiveWorker: Boolean(self.registration.active),
  });
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urls = [...STATIC_ASSETS, MARKED_URL, MERMAID_URL, ...MATHJAX_URLS];
      return cache.addAll(urls).then(() => {
        // [debug-enrich]
        console.info("[sw.install] Precache complete:", {
          cacheName: CACHE_NAME,
          urlCount: urls.length,
        });
      }).catch((err) => {
        // [debug-enrich]
        console.warn("[sw.install] Precache partial/failed:", {
          cacheName: CACHE_NAME,
          message: err?.message || String(err),
        });
      });
    }),
  );
  // Only activate immediately on first install; updates wait for user "Update now".
  if (!self.registration.active) {
    // [debug-enrich]
    console.info("[sw.install] First install — skipWaiting");
    self.skipWaiting();
  }
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

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  return (
    url.hostname === "api.anthropic.com" ||
    url.hostname === "api.deepseek.com" ||
    url.hostname === "generativelanguage.googleapis.com"
  );
}

function isStaticAsset(url) {
  return STATIC_ASSETS.includes(url.pathname);
}

function isMathJaxAsset(url) {
  return MATHJAX_URLS.includes(url.href);
}

/** App JS/HTML must be network-first so deploys are not stuck on stale cache. */
function isNetworkFirstAsset(url) {
  if (url.pathname === "/index.html" || url.pathname === "/") return true;
  return url.pathname.startsWith("/src/js/") && url.pathname.endsWith(".js");
}

function networkFirst(req) {
  const url = new URL(req.url);
  // [debug-enrich]
  console.debug('[sw.networkFirst] Fetching:', { pathname: url.pathname });
  return fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
        // [debug-enrich]
        console.debug('[sw.networkFirst] Network ok + cached:', {
          pathname: url.pathname,
          status: res.status,
        });
      } else {
        // [debug-enrich]
        console.warn('[sw.networkFirst] Network non-ok:', {
          pathname: url.pathname,
          status: res.status,
        });
      }
      return res;
    })
    .catch((err) => {
      // [debug-enrich]
      console.warn('[sw.networkFirst] Network failed — trying cache:', {
        pathname: url.pathname,
        message: err?.message ?? String(err),
      });
      return caches.match(req);
    });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (isApiRequest(url)) {
    // [debug-enrich]
    console.debug('[sw.fetch] API passthrough (no SW intercept):', { hostname: url.hostname });
    return;
  }

  if (isNetworkFirstAsset(url)) {
    // [debug-enrich]
    console.debug('[sw.fetch] Network-first asset:', { pathname: url.pathname });
    event.respondWith(networkFirst(req));
    return;
  }

  if (isStaticAsset(url) || isMathJaxAsset(url)) {
    // [debug-enrich]
    console.debug('[sw.fetch] Cache-first static/mathjax:', { pathname: url.pathname });
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // [debug-enrich]
          console.debug('[sw.fetch] Cache hit:', { pathname: url.pathname });
          return cached;
        }
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          // [debug-enrich]
          console.debug('[sw.fetch] Cache miss — fetched and stored:', {
            pathname: url.pathname,
            status: res.status,
          });
          return res;
        });
      }),
    );
    return;
  }

  // [debug-enrich]
  console.debug('[sw.fetch] Default network-first:', { pathname: url.pathname });
  event.respondWith(networkFirst(req));
});
