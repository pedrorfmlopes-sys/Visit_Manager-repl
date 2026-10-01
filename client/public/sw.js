const CACHE_NAME = "visit-manager-shell-v4";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/brand-mark.svg",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve(false);
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Never cache authenticated API traffic in the service worker.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first for navigation so users get the latest app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/")),
    );
    return;
  }

  // Let the browser handle versioned assets normally to avoid stale JS/CSS
  // after deployments. We only keep an offline fallback for the app shell.
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response?.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      }).catch(() => caches.match(request)),
    );
  }
});
