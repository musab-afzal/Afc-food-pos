import { openDB } from 'idb';

const database = openDB('respos-offline', 2, {
    upgrade(db, oldVersion) {
        if (oldVersion < 1) {
            db.createObjectStore('catalog');
            db.createObjectStore('sales', { keyPath: 'uuid' });
            const queue = db.createObjectStore('syncQueue', { keyPath: 'uuid' });
            queue.createIndex('status', 'status');
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
        }
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
    await transaction.objectStore('sales').put({
        ...sale,
        syncStatus: 'pending',
        savedAt: new Date().toISOString(),
    });
    await transaction.objectStore('syncQueue').put({
        uuid: sale.uuid,
        payload: { ...sale, was_offline: true },
        status: 'pending',
        attempts: 0,
        error: null,
        updatedAt: new Date().toISOString(),
    });
    await transaction.done;
}

export async function pendingQueue() {
    const items = await (await database).getAll('syncQueue');
    return items
        .filter((item) => item.status !== 'synced')
        .sort((a, b) => String(a.updatedAt || a.uuid).localeCompare(String(b.updatedAt || b.uuid)));
}

export async function pendingCount() {
    return (await pendingQueue()).length;
}

export async function markSync(uuid, status, error = null) {
    const db = await database;
    const queued = await db.get('syncQueue', uuid);
    if (!queued) return;
    const attempts = status === 'syncing' ? (queued.attempts || 0) : (queued.attempts || 0) + (status === 'failed' ? 1 : 0);
    await db.put('syncQueue', {
        ...queued,
        status,
        error: error || null,
        attempts: status === 'synced' ? queued.attempts || 0 : attempts,
        updatedAt: new Date().toISOString(),
    });
    const sale = await db.get('sales', uuid);
    if (sale) {
        await db.put('sales', { ...sale, syncStatus: status, serverError: error || null });
    }
}

export async function getOfflineSale(uuid) {
    return (await database).get('sales', uuid);
}

export async function listOfflineSales() {
    return (await database).getAll('sales');
}
