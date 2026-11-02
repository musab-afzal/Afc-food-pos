import { api } from './api.js';
import { markSync, pendingQueue } from './database.js';

let running = false;

export async function syncPending(onProgress = () => {}) {
    if (running || !navigator.onLine || !localStorage.getItem('respos_token')) return;
    running = true;
    try {
        const queue = await pendingQueue();
        onProgress({ state: 'syncing', pending: queue.length });
        for (const item of queue) {
            try {
                await markSync(item.uuid, 'syncing');
                await api('/pos/sync', { method: 'POST', body: JSON.stringify(item.payload) });
                await markSync(item.uuid, 'synced');
            } catch (error) {
                await markSync(item.uuid, 'failed', error.message);
            }
        }
        const remaining = await pendingQueue();
        onProgress({ state: remaining.length ? 'failed' : 'synced', pending: remaining.length, lastSync: new Date() });
    } finally {
        running = false;
    }
}
