// Biirb hors ligne : le planificateur (pages, voyages, dépenses) reste consultable sans réseau.
// Lecture seule : seules les requêtes GET sont mises en cache ; les modifications exigent le réseau.
// Les données de voyage en cache sont effacées à la déconnexion (src/client/session.ts).

const STATIC_CACHE = "brb-static-v1";
const PAGE_CACHE = "brb-pages";
const DATA_CACHE = "brb-data";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("brb-static-") && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fichiers versionnés par leur nom : jamais modifiés, le cache suffit.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetchAndStore(request, STATIC_CACHE)));
    return;
  }
  if (request.mode === "navigate" && url.pathname.startsWith("/planner")) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }
  // Clé = URL seule : l'en-tête Authorization (token en mémoire, perdu hors ligne) n'est pas comparé.
  if (url.pathname.startsWith("/api/v1/trips")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});

async function fetchAndStore(request, cacheName) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request.url, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    return await fetchAndStore(request, cacheName);
  } catch (error) {
    const cached = await caches.match(request.url, { cacheName });
    if (cached) return cached;
    throw error;
  }
}
