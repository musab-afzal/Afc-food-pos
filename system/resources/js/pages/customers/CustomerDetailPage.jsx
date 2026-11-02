import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import { api } from '../../services/api.js';
import { currency, formatDateTime } from '../../utils/format.js';

export default function CustomerDetailPage() {
    const { id } = useParams();
    const [customer, setCustomer] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api(`/customers/${id}`),
            api(`/customers/${id}/ledger`),
        ]).then(([profile, ledgerRes]) => {
            setCustomer(profile.data);
            setLedger(ledgerRes.data || []);
        }).catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-white" />;
    if (!customer) return <p className="text-sm text-ink/50">Customer not found.</p>;

    const stats = customer.stats || customer.totals || {};
    if (stats.sales_sum != null && stats.total_spent == null) {
        stats.total_spent = stats.sales_sum;
        stats.average_order_value = stats.orders_count ? Number(stats.sales_sum) / Number(stats.orders_count) : 0;
    }

    return (
        <div>
            <PageHeader
                title={customer.name}
                description={`${customer.customer_code || ''} · ${customer.group?.name || 'No group'}`}
                breadcrumbs={['Customers', 'Profile']}
                actions={<Link to="/customers" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Back</Link>}
            />
            <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-ink/55">
                <StatusBadge status={customer.is_active ? 'active' : 'inactive'} />
                <span>{customer.phone || 'No phone'}</span>
                <span>{customer.email || 'No email'}</span>
                <span>{customer.city || ''}</span>
            </div>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total orders" value={stats.orders_count ?? 0} />
                <KpiCard label="Total spent" value={currency(stats.total_spent)} tone="bg-lime" />
                <KpiCard label="Avg order" value={currency(stats.average_order_value)} tone="bg-[#d8e8ff]" />
                <KpiCard label="Loyalty points" value={customer.loyalty_points ?? 0} tone="bg-[#fff0bd]" />
            </section>
            <article className="mt-5 card-panel p-6">
                <p className="font-semibold">Ledger / recent activity</p>
                <div className="mt-4 divide-y divide-ink/7">
                    {ledger.length ? ledger.map((row, index) => (
                        <div key={row.id || index} className="flex items-center justify-between gap-3 py-3 text-sm">
                            <div>
                                <p className="font-medium">{row.label || row.type || row.invoice_number || 'Entry'}</p>
                                <p className="text-xs text-ink/40">{formatDateTime(row.date || row.sold_at || row.created_at)}</p>
                            </div>
                            <p className="font-semibold">{row.amount != null ? currency(row.amount) : (row.points != null ? `${row.points} pts` : '—')}</p>
                        </div>
                    )) : <p className="py-10 text-center text-sm text-ink/40">No ledger entries yet.</p>}
                </div>
            </article>
        </div>
    );
}
