// Offline: the whole app is kept in one cache named after its contents. The
// build fills in the name and the file list; a new deploy means a new cache,
// and the app asks before switching to it.

const CACHE = '__CACHE__';
const FILES = ['__FILES__'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('geldfluss-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    // The app is one page; every navigation inside it gets that page.
    event.respondWith(caches.match(new URL('./', scope).href, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
