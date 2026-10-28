// Keeps this build on the device so the game opens and plays with no network. vite.config.js fills in FILES and CACHE.
const FILES = __FILES__, CACHE = __CACHE__;
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
// the origin can be shared (github.io), so only this game's old caches go
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('tycoon-') && k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  // the page: the newest one if the network answers within 3 seconds (a plane's Wi-Fi may never answer), else the saved one
  if (r.mode === 'navigate') e.respondWith(Promise.race([fetch(r), new Promise((_, no) => setTimeout(no, 3000))]).catch(() => caches.match('./')));
  else e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
