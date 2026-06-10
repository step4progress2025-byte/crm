const CACHE = 's4p-crm-v3';
const ASSETS = [
  '/crm/',
  '/crm/index.html',
  '/crm/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
