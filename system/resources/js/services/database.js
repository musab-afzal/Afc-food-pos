import { openDB } from 'idb';

const database = openDB('respos-offline', 1, {
    upgrade(db) {
        db.createObjectStore('catalog');
        db.createObjectStore('sales', { keyPath: 'uuid' });
        const queue = db.createObjectStore('syncQueue', { keyPath: 'uuid' });
        queue.createIndex('status', 'status');
    },
});

export async function cacheCatalog(catalog) {
    return (await database).put('catalog', catalog, 'current');
}

export async function getCachedCatalog() {
    return (await database).get('catalog', 'current');
}

export async function saveOfflineSale(sale) {
    const db = await database;
    const transaction = db.transaction(['sales', 'syncQueue'], 'readwrite');
    await transaction.objectStore('sales').put({ ...sale, syncStatus: 'pending', savedAt: new Date().toISOString() });
    await transaction.objectStore('syncQueue').put({ uuid: sale.uuid, payload: sale, status: 'pending', attempts: 0 });
    await transaction.done;
}

export async function pendingQueue() {
    const items = await (await database).getAll('syncQueue');
    return items.filter((item) => item.status !== 'synced');
}

export async function markSync(uuid, status, error = null) {
    const db = await database;
    const queued = await db.get('syncQueue', uuid);
    if (!queued) return;
    await db.put('syncQueue', { ...queued, status, error, attempts: queued.attempts + 1, updatedAt: new Date().toISOString() });
    const sale = await db.get('sales', uuid);
    if (sale) await db.put('sales', { ...sale, syncStatus: status, serverError: error });
}
