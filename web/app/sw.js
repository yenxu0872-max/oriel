/* Oriel works offline: this keeps the app's own files and the engine code it
   loads, so once a model is downloaded the whole app starts without internet.

   - the app's files: from the network when online (so updates show at once),
     from here when not
   - engine code on jsDelivr, pinned to exact versions, never changes: kept
     after the first use
   - the models themselves are stored by their engines (WebLLM's caches and
     the picture maker's folder), so they pass straight through here

   Nothing is ever sent anywhere by this file; it only keeps copies. */
const APP = 'oriel-app-v7', LIBS = 'oriel-libs-v1';
const PINNED = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+[^/]*\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(['./', 'chat.html', 'app.css', 'manifest.webmanifest', 'support.js',
    'engine-worker.js', 'image-worker.js', 'motion.js', 'models.json', 'img/icon-192.png', 'fonts/Geist-Variable.woff2'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('oriel-') && ![APP, LIBS].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // always ask the server (a cheap "not modified" when nothing changed), so an update shows at once
    const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' });
    e.respondWith(fresh.then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('chat.html'))));
  } else if (PINNED.test(req.url)) {
    e.respondWith(caches.open(LIBS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
  }
});
