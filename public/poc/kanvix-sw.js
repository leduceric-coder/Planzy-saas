/* Kanvix — service worker minimal (POC PWA).
   Stratégie : cache-first sur la coquille de l'app pour un lancement hors-ligne,
   network-first implicite pour tout le reste. Volontairement simple : le POC
   tient dans un seul fichier HTML. */
const CACHE = "kanvix-poc-v1";
const SHELL = ["./kanvix-next-gen.html", "./kanvix.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Met en cache les réponses de même origine récupérées avec succès.
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./kanvix-next-gen.html"));
    }),
  );
});
