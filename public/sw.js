// Phrase offline cache. Same-origin GET requests only; nothing is ever sent anywhere else.
const CACHE = 'phrase-cache-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const put = (res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  };

  // Fingerprinted build assets never change: cache first.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
    return;
  }
  // Everything else (index.html, icons): network first, cache as offline fallback.
  event.respondWith(
    fetch(req)
      .then(put)
      .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL('./', self.location).href))),
  );
});
