import { api } from './api.js';
import { markSync, pendingCount, pendingQueue } from './database.js';

let running = false;

/**
 * Push queued offline POS sales to the server (idempotent by sale uuid).
 */
export async function syncPending(onProgress = () => {}) {
    if (running || !navigator.onLine || !localStorage.getItem('respos_token')) {
        const pending = await pendingCount().catch(() => 0);
        onProgress({ state: navigator.onLine ? 'idle' : 'offline', pending });
        return { synced: 0, failed: 0, pending };
    }

    running = true;
    let synced = 0;
    let failed = 0;

    try {
        const queue = await pendingQueue();
        onProgress({ state: 'syncing', pending: queue.length });

        for (const item of queue) {
            // Skip stubborn failures for a few rounds (still retried on later ticks).
            if (item.status === 'failed' && Number(item.attempts || 0) >= 8) {
                failed += 1;
                continue;
            }
            try {
                await markSync(item.uuid, 'syncing');
                const payload = {
                    ...(item.payload || {}),
                    uuid: item.uuid,
                    was_offline: true,
                    coupon_code: null,
                    loyalty_points: 0,
                };
                await api('/pos/sync', { method: 'POST', body: JSON.stringify(payload) });
                await markSync(item.uuid, 'synced');
                synced += 1;
            } catch (error) {
                await markSync(item.uuid, 'failed', error?.message || 'Sync failed');
                failed += 1;
            }
        }

        const remaining = await pendingQueue();
        onProgress({
            state: remaining.length ? (failed ? 'failed' : 'idle') : 'synced',
            pending: remaining.length,
            lastSync: new Date(),
            synced,
            failed,
        });

        return { synced, failed, pending: remaining.length };
    } finally {
        running = false;
    }
}

export function startAutoSync(onProgress = () => {}, intervalMs = 20000) {
    const tick = () => {
        if (navigator.onLine) {
            syncPending(onProgress).catch(() => {});
        }
    };

    tick();
    const timer = window.setInterval(tick, intervalMs);
    const onOnline = () => tick();
    window.addEventListener('online', onOnline);

    return () => {
        window.clearInterval(timer);
        window.removeEventListener('online', onOnline);
    };
}
