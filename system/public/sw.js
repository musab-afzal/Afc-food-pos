/* AFC offline shell — keeps POS usable without internet after one online visit. */
const CACHE_NAME = 'respos-offline-v3';

function scopeUrl(path) {
    return new URL(path, self.registration.scope).href;
}

async function putAll(cache, urls) {
    await Promise.allSettled((urls || []).map(async (url) => {
        try {
            const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
            if (response.ok) await cache.put(url, response.clone());
        } catch {
            /* ignore missing asset during install */
        }
    }));
}

async function precacheShell(cache) {
    await putAll(cache, [
        scopeUrl('./'),
        scopeUrl('./index.php'),
        scopeUrl('./manifest.webmanifest'),
        scopeUrl('./icon.svg'),
        scopeUrl('./favicon.ico'),
        scopeUrl('./sw.js'),
        scopeUrl('./pos'),
        scopeUrl('./login'),
    ]);
}

async function precacheBuildAssets(cache) {
    try {
        const manifestUrl = scopeUrl('./build/manifest.json');
        const response = await fetch(manifestUrl, { cache: 'reload', credentials: 'same-origin' });
        if (!response.ok) return;
        await cache.put(manifestUrl, response.clone());
        const manifest = await response.json();
        const urls = new Set();
        Object.values(manifest || {}).forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            if (entry.file) urls.add(scopeUrl(`./build/${entry.file}`));
            (entry.css || []).forEach((file) => urls.add(scopeUrl(`./build/${file}`)));
            (entry.assets || []).forEach((file) => urls.add(scopeUrl(`./build/${file}`)));
        });
        await putAll(cache, [...urls]);
    } catch {
        /* manifest may be unavailable during first install */
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await precacheShell(cache);
        await precacheBuildAssets(cache);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await putAll(cache, data.urls);
    })());
});

async function cachedAppShell() {
    return (await caches.match(scopeUrl('./'), { ignoreSearch: true }))
        || (await caches.match(scopeUrl('./index.php'), { ignoreSearch: true }))
        || (await caches.match(scopeUrl('./pos'), { ignoreSearch: true }))
        || Response.error();
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;
    if (requestUrl.pathname.includes('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                    await cache.put(scopeUrl('./'), response.clone());
                }
                return response;
            } catch {
                return (await caches.match(request, { ignoreSearch: true })) || cachedAppShell();
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) {
            // Refresh in background when online.
            if (navigator.onLine) {
                fetch(request).then(async (response) => {
                    if (response.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(request, response.clone());
                    }
                }).catch(() => {});
            }
            return cached;
        }

        try {
            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }
            return response;
        } catch {
            return new Response('', { status: 503, statusText: 'Offline' });
        }
    })());
});
