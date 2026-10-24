function pwaPlugin() {
  let basePath = "/";

  return {
    name: "plan-ner-service-worker",
    apply: "build",
    configResolved(config) {
      basePath = config.base;
    },
    generateBundle(_options, bundle) {
      const precacheFiles = Object.keys(bundle).filter((fileName) =>
        /\.(?:js|css)$/.test(fileName),
      );
      const precacheUrls = [
        `${basePath}index.html`,
        ...precacheFiles.map((fileName) => `${basePath}${fileName}`),
        `${basePath}manifest.webmanifest`,
        `${basePath}icons/planner-192.png`,
        `${basePath}icons/planner-512.png`,
      ];
      const version = ["index.html", ...precacheFiles].join("|").replace(/[^a-zA-Z0-9]/g, "").slice(-24);

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE_NAME = "plan-ner-${version}";
const APP_BASE = ${JSON.stringify(basePath)};
const APP_URL = new URL(APP_BASE, self.location.origin);
const APP_INDEX = new URL("index.html", APP_URL).href;
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => (key.startsWith("plan-ner-") || key.startsWith("meu-planner-")) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && (url.href === APP_URL.href || url.href === APP_INDEX)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(APP_INDEX, copy)));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(APP_INDEX);
          if (cachedPage) return cachedPage;
          return Response.error();
        }),
    );
    return;
  }

  if (!url.pathname.startsWith(APP_URL.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    }),
  );
});
`,
      });
    },
  };
}

export default pwaPlugin;
