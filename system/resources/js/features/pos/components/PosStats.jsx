import { BadgePercent, ClipboardList, Package, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../../services/api.js';
import { usePos } from '../context/PosContext.jsx';

function todayYmd() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function PosStats() {
    const { state, can } = usePos();
    const [counts, setCounts] = useState({ todayOrders: null, customers: null });
    const salesAllowed = can('orders.view');
    const customersAllowed = can('customers.view');
    const totalItems = (state.catalog?.dishes || []).length;
    const activeDeals = (state.catalog?.deals || []).length;

    useEffect(() => {
        let cancelled = false;
        let loading = false;

        async function refresh() {
            if (loading) return;
            if (!state.online) {
                setCounts({ todayOrders: null, customers: null });
                return;
            }
            loading = true;
            const today = todayYmd();
            const requests = [
                salesAllowed
                    ? api(`/sales?date_from=${today}&date_to=${today}&per_page=1`).then((response) => response.meta?.total ?? 0)
                    : Promise.resolve(null),
                customersAllowed
                    ? api('/customers?per_page=1').then((response) => response.meta?.total ?? 0)
                    : Promise.resolve(null),
            ];
            const results = await Promise.allSettled(requests);
            if (!cancelled) {
                setCounts({
                    todayOrders: results[0].status === 'fulfilled' ? results[0].value : null,
                    customers: results[1].status === 'fulfilled' ? results[1].value : null,
                });
            }
            loading = false;
        }

        refresh();
        const timer = setInterval(refresh, 60000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [state.online, state.success, salesAllowed, customersAllowed]);

    const cards = [
        ['Today Orders', counts.todayOrders, ClipboardList, 'orange'],
        ['Total Customers', counts.customers, Users, 'blue'],
        ['Total Items', totalItems, Package, 'teal'],
        ['Active deals', activeDeals, BadgePercent, 'red'],
    ];

    return (
        <div className="afc-pos-stats">
            {cards.map(([label, value, Icon, tone]) => (
                <div
                    className={`afc-pos-stat ${tone}`}
                    key={label}
                    title={value === null ? 'Not available while offline or without access' : label}
                >
                    <span className="afc-pos-stat-icon"><Icon size={27} strokeWidth={1.9} /></span>
                    <div>
                        <strong>{value ?? '—'}</strong>
                        <p>{label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
