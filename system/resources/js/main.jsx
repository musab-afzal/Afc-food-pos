import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ToastProvider from './components/ui/ToastProvider.jsx';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
        },
    },
});

createRoot(document.getElementById('app')).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter basename={document.querySelector('meta[name="app-base"]')?.content || '/'}>
                <App />
                <ToastProvider />
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);

if ('serviceWorker' in navigator) {
    const appBase = (document.querySelector('meta[name="app-base"]')?.content || '').replace(/\/$/, '');
    const OFFLINE_CACHE = 'respos-offline-v4';

    function collectAssetUrls() {
        return [...new Set([
            window.location.href,
            `${appBase || ''}/`,
            `${appBase || ''}/pos`,
            `${appBase || ''}/login`,
            `${appBase || ''}/offline.html`,
            `${appBase || ''}/manifest.webmanifest`,
            `${appBase || ''}/build/manifest.json`,
            `${appBase || ''}/sw.js`,
            ...[...document.querySelectorAll('script[src], link[rel="stylesheet"]')]
                .map((el) => el.src || el.href)
                .filter(Boolean),
        ].filter(Boolean))];
    }

    async function warmOfflineCache(registration) {
        const urls = collectAssetUrls();
        const worker = registration.active || navigator.serviceWorker.controller;
        if (worker) worker.postMessage({ type: 'CACHE_URLS', urls });
        if (!('caches' in window)) return;
        const cache = await caches.open(OFFLINE_CACHE);
        await Promise.allSettled(urls.map(async (url) => {
            try {
                const response = await fetch(url, { credentials: 'same-origin' });
                if (!response.ok) return;
                const store = response.redirected
                    ? new Response(await response.clone().blob(), { status: 200, statusText: 'OK', headers: response.headers })
                    : response.clone();
                await cache.put(url, store);
            } catch { /* skip */ }
        }));
    }

    // Register immediately so the worker can control this page ASAP.
    navigator.serviceWorker.register(`${appBase}/sw.js`, { updateViaCache: 'none' })
        .then(async (registration) => {
            await warmOfflineCache(registration);
            // Warm again after load so Vite CSS/JS tags are definitely present.
            window.addEventListener('load', () => { warmOfflineCache(registration); });
            registration.update().catch(() => {});
        })
        .catch(() => {});
}
