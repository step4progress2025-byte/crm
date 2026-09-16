// Step4Progress CRM — service worker
//
// Deliberately minimal and conservative: this exists ONLY to satisfy
// browsers' installability requirements for "Add to Home Screen" and to
// provide a basic offline fallback — it is NOT meant to make the CRM
// work fully offline, since the CRM is a live, constantly-updated tool
// backed by Supabase.
//
// Caching strategy: network-first for everything. Every request tries
// the real network first, so you always get the latest version of the
// app and always get live data. The cache is only ever used as a
// fallback if the network request genuinely fails (e.g. no internet).
// Nothing from api calls to Supabase is ever cached — only the static
// app shell (this HTML file, the manifest, and the icons) is elegible.
//
// Bump CACHE_VERSION any time this file itself changes, so old cached
// entries get cleaned up automatically.
const CACHE_VERSION = 'crm-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  // Deliberately NOT calling skipWaiting() here — the CRM's own update
  // flow explicitly asks the user to confirm before reloading onto a
  // new version (see the registration code in index.html), and only
  // sends SKIP_WAITING once they've said yes. Auto-skipping here would
  // silently bypass that confirmation.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Supabase API calls, Twilio, Meta, or any other
  // cross-origin request — these must always go straight to the
  // network, live, every time. Only ever consider caching same-origin
  // static shell files.
  if (!url.startsWith(self.location.origin)) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Successfully got a fresh copy — update the cache for offline
        // fallback purposes, but always serve the fresh network response.
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => {
        // Network failed (likely offline) — fall back to whatever we
        // have cached, if anything.
        return caches.match(event.request);
      })
  );
});
