const CACHE_NAME = 'respos-shell-v2';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([
        new URL('./', self.registration.scope).href,
        new URL('manifest.webmanifest', self.registration.scope).href,
        new URL('icon.svg', self.registration.scope).href,
    ])));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== 'GET' || requestUrl.pathname.includes('/api/')) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).then((response) => {
            const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response;
        }).catch(async () => (await caches.match(event.request)) || caches.match(new URL('./', self.registration.scope).href)));
        return;
    }

    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok && requestUrl.origin === self.location.origin) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
    })));
});
