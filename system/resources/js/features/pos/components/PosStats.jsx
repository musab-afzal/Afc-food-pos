import { ChefHat, ClipboardList, Table2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../../services/api.js';
import { usePos } from '../context/PosContext.jsx';

const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'out_for_delivery'];

export default function PosStats() {
    const { state, can } = usePos();
    const [counts, setCounts] = useState({ orders: null, kitchen: null, customers: null, tables: null });
    const ordersAllowed = can('orders.view');
    const kitchenAllowed = can('kitchen.view');
    const customersAllowed = can('customers.view');
    const tablesAllowed = can('tables.view');

    useEffect(() => {
        let cancelled = false;
        let loading = false;
        async function refresh() {
            if (loading) return;
            if (!state.online) { setCounts({ orders: null, kitchen: null, customers: null, tables: null }); return; }
            loading = true;
            const requests = [
                ordersAllowed ? Promise.all(activeStatuses.map((status) => api(`/orders?status=${status}&per_page=1`))).then((rows) => rows.reduce((sum, row) => sum + Number(row.meta?.total || 0), 0)) : Promise.resolve(null),
                kitchenAllowed ? api('/kitchen/tickets').then((response) => response.data?.length ?? null) : Promise.resolve(null),
                customersAllowed ? api('/customers?per_page=1').then((response) => response.meta?.total ?? null) : Promise.resolve(null),
                tablesAllowed ? api('/tables?status=available&is_active=1&per_page=1').then((response) => response.meta?.total ?? null) : Promise.resolve(null),
            ];
            const results = await Promise.allSettled(requests);
            if (!cancelled) setCounts(Object.fromEntries(['orders', 'kitchen', 'customers', 'tables'].map((key, index) => [key, results[index].status === 'fulfilled' ? results[index].value : null])));
            loading = false;
        }
        refresh();
        const timer = setInterval(refresh, 60000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [state.online, state.success, ordersAllowed, kitchenAllowed, customersAllowed, tablesAllowed]);

    const cards = [
        ['Open Tables', counts.tables, Table2, 'teal'],
        ['Active Orders', counts.orders, ClipboardList, 'orange'],
        ['Kitchen Queue', counts.kitchen, ChefHat, 'red'],
        ['Total Customers', counts.customers, Users, 'blue'],
    ];
    return <div className="afc-pos-stats">{cards.map(([label, value, Icon, tone]) => (
        <div className={`afc-pos-stat ${tone}`} key={label} title={value === null ? 'Not available while offline or without access' : label}>
            <span className="afc-pos-stat-icon"><Icon size={27} strokeWidth={1.9} /></span>
            <div><strong>{value ?? '—'}</strong><p>{label}</p></div>
        </div>
    ))}</div>;
}
