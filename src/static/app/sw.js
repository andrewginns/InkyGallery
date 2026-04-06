const STATIC_CACHE = "inkygallery-static-v1";
const RUNTIME_CACHE = "inkygallery-runtime-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-32.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableStatic(requestUrl) {
  return (
    requestUrl.pathname.startsWith("/assets/") ||
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname === "/manifest.webmanifest" ||
    requestUrl.pathname === "/favicon.ico"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached || Response.error();
        }),
    );
    return;
  }

  if (isCacheableStatic(requestUrl)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});
