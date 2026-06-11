// ── S4P CRM Service Worker ──────────────────────────────────────
// Cache-first for static assets; network-first for Supabase API.
// Version bump this string to force cache refresh on deploy.

const CACHE_NAME = 's4p-crm-v1';

// Assets to pre-cache on install (adjust paths if your repo layout differs)
const PRECACHE = [
  '/crm/',
  '/crm/index.html',
  '/crm/manifest.json',
  '/crm/icons/icon-192.png',
  '/crm/icons/icon-512.png',
  // External CDN assets (cached on first fetch after install)
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,500;1,300&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Patterns that should NEVER be served from cache (live data)
const NETWORK_ONLY = [
  'supabase.co',          // all Supabase API & Realtime calls
  'googleapis.com/maps',  // if you ever add maps
];

// ── Install ──────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache local assets; skip CDN failures gracefully
      return Promise.allSettled(
        PRECACHE.map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate (clean up old caches) ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Always network-only for Supabase / live data
  if (NETWORK_ONLY.some((pattern) => url.includes(pattern))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Non-GET requests → always network
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Cache-first for everything else (HTML, CSS, JS, fonts, icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Only cache valid, non-opaque responses for same-origin or CDN
          if (
            response.ok &&
            (response.type === 'basic' || response.type === 'cors')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve the app shell
          if (event.request.mode === 'navigate') {
            return caches.match('/crm/') || caches.match('/crm/index.html');
          }
        });
    })
  );
});

// ── Background sync (optional, for future offline queue) ─────────
// self.addEventListener('sync', (event) => { ... });
