/** Child action → required parent permission(s). */
export const PERMISSION_DEPENDENCIES = {
    'orders.create': ['orders.view'],
    'orders.update': ['orders.view'],
    'orders.cancel': ['orders.view'],
    'orders.assign_rider': ['orders.view'],
    'pos.create_sale': ['pos.access'],
    'pos.discount': ['pos.access'],
    'pos.cancel_item': ['pos.access'],
    'pos.cancel_sale': ['pos.access'],
    'pos.hold_order': ['pos.access'],
    'pos.refund': ['pos.access'],
    'kitchen.accept': ['kitchen.view'],
    'kitchen.ready': ['kitchen.view'],
    'kitchen.complete': ['kitchen.view'],
    'tables.manage': ['tables.view'],
    'tables.reservations': ['tables.view'],
    'menu.create': ['menu.view'],
    'menu.edit': ['menu.view'],
    'menu.delete': ['menu.view'],
    'inventory.create': ['inventory.view'],
    'inventory.edit': ['inventory.view'],
    'inventory.adjust': ['inventory.view'],
    'inventory.purchase': ['inventory.view'],
    'inventory.wastage': ['inventory.view'],
    'purchases.create': ['purchases.view'],
    'purchases.edit': ['purchases.view'],
    'purchases.approve': ['purchases.view'],
    'customers.create': ['customers.view'],
    'customers.edit': ['customers.view'],
    'customers.delete': ['customers.view'],
    'customers.loyalty': ['customers.view'],
    'reports.sales': ['reports.view'],
    'reports.export': ['reports.view'],
    'reports.inventory': ['reports.view'],
    'reports.finance': ['reports.view'],
    'reports.staff': ['reports.view'],
    'reports.kitchen': ['reports.view'],
    'reports.customers': ['reports.view'],
    'reports.purchases': ['reports.view'],
    'reports.delivery': ['reports.view'],
    'reports.overview': ['reports.view'],
    'settings.manage': ['settings.view'],
    'staff.create': ['staff.view'],
    'staff.edit': ['staff.view'],
    'staff.delete': ['staff.view'],
};

export function withDependencies(slugs, slugById, idBySlug) {
    const selected = new Set(slugs);
    let changed = true;
    while (changed) {
        changed = false;
        for (const slug of [...selected]) {
            const deps = PERMISSION_DEPENDENCIES[slug] || [];
            for (const dep of deps) {
                if (!selected.has(dep)) {
                    selected.add(dep);
                    changed = true;
                }
            }
        }
    }
    return [...selected].map((s) => idBySlug[s]).filter(Boolean);
}

export function dependentsOf(slug) {
    return Object.entries(PERMISSION_DEPENDENCIES)
        .filter(([, deps]) => deps.includes(slug))
        .map(([child]) => child);
}
