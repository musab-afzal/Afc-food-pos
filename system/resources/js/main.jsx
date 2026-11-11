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

    function warmOfflineCache(registration) {
        const urls = [
            window.location.href,
            `${appBase || ''}/`,
            `${appBase || ''}/pos`,
            `${appBase || ''}/login`,
            `${appBase || ''}/manifest.webmanifest`,
            `${appBase || ''}/build/manifest.json`,
            ...[...document.querySelectorAll('script[src], link[rel="stylesheet"]')]
                .map((el) => el.src || el.href)
                .filter(Boolean),
        ];
        const unique = [...new Set(urls.filter(Boolean))];
        const worker = registration.active || navigator.serviceWorker.controller;
        if (worker) {
            worker.postMessage({ type: 'CACHE_URLS', urls: unique });
        }
        if ('caches' in window) {
            caches.open('respos-offline-v3').then((cache) => Promise.allSettled(
                unique.map(async (url) => {
                    try {
                        const response = await fetch(url, { credentials: 'same-origin' });
                        if (response.ok) await cache.put(url, response.clone());
                    } catch { /* offline warm skip */ }
                }),
            )).catch(() => {});
        }
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${appBase}/sw.js`)
            .then((registration) => {
                warmOfflineCache(registration);
                registration.update().catch(() => {});
            })
            .catch(() => {});
    });
}
