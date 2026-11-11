/* AFC offline shell — POS must open from cache when the network is gone. */
const CACHE_NAME = 'respos-offline-v4';

function scopeUrl(path) {
    return new URL(path, self.registration.scope).href;
}

function offlinePage() {
    return new Response(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AFC — Offline</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif;padding:24px;text-align:center}
h1{font-size:1.4rem;margin:0 0 8px}p{margin:0;color:#475569;line-height:1.5;max-width:28rem}
a{display:inline-block;margin-top:18px;padding:10px 16px;border-radius:10px;background:#166534;color:#fff;text-decoration:none;font-weight:600}
</style></head><body>
<main>
<h1>Connect once to enable offline POS</h1>
<p>Turn internet ON, open this website, wait 15 seconds, then you can use POS with internet OFF.</p>
<a href="./">Retry</a>
</main>
</body></html>`, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

async function putUrl(cache, url) {
    try {
        const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
        if (!response.ok) return false;
        // Avoid caching redirect responses that Cache API rejects.
        const store = response.redirected ? new Response(await response.clone().blob(), {
            status: 200,
            statusText: 'OK',
            headers: response.headers,
        }) : response.clone();
        await cache.put(url, store);
        return true;
    } catch {
        return false;
    }
}

async function putAll(cache, urls) {
    await Promise.allSettled((urls || []).map((url) => putUrl(cache, url)));
}

async function precacheShell(cache) {
    await putAll(cache, [
        scopeUrl('./'),
        scopeUrl('./index.php'),
        scopeUrl('./offline.html'),
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
        if (!(await putUrl(cache, manifestUrl))) return;
        const response = await caches.match(manifestUrl);
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
        /* ignore */
    }
}

async function matchInAnyCache(request) {
    const direct = await caches.match(request, { ignoreSearch: true });
    if (direct) return direct;

    const keys = await caches.keys();
    for (const key of keys) {
        const hit = await caches.open(key).then((cache) => cache.match(request, { ignoreSearch: true }));
        if (hit) return hit;
    }

    const fallbacks = [
        scopeUrl('./'),
        scopeUrl('./index.php'),
        scopeUrl('./pos'),
        scopeUrl('./offline.html'),
    ];
    for (const url of fallbacks) {
        for (const key of keys) {
            const hit = await caches.open(key).then((cache) => cache.match(url, { ignoreSearch: true }));
            if (hit) return hit;
        }
    }
    return null;
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
        // Keep previous caches until this version has been used; only drop very old shells.
        const keys = await caches.keys();
        const stale = keys.filter((key) => key.startsWith('respos-') && key !== CACHE_NAME && !key.includes('v3') && !key.includes('v4') && key !== 'respos-shell-v2');
        await Promise.all(stale.map((key) => caches.delete(key)));
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

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    let requestUrl;
    try {
        requestUrl = new URL(request.url);
    } catch {
        return;
    }
    if (requestUrl.origin !== self.location.origin) return;
    if (requestUrl.pathname.includes('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            // Prefer cache when already offline so Chrome never shows ERR_INTERNET_DISCONNECTED.
            if (!self.navigator.onLine) {
                return (await matchInAnyCache(request)) || offlinePage();
            }
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    const store = response.redirected ? new Response(await response.clone().blob(), {
                        status: 200,
                        statusText: 'OK',
                        headers: response.headers,
                    }) : response.clone();
                    await cache.put(request, store.clone());
                    await cache.put(scopeUrl('./'), store.clone());
                }
                return response;
            } catch {
                return (await matchInAnyCache(request)) || offlinePage();
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await matchInAnyCache(request);
        if (cached) {
            if (self.navigator.onLine) {
                putUrl(await caches.open(CACHE_NAME), request.url).catch(() => {});
            }
            return cached;
        }
        try {
            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await putUrl(cache, request.url);
            }
            return response;
        } catch {
            if (request.destination === 'document') return offlinePage();
            return new Response('', { status: 503, statusText: 'Offline' });
        }
    })());
});
