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
    window.addEventListener('load', () => navigator.serviceWorker.register(`${appBase}/sw.js`));
}
