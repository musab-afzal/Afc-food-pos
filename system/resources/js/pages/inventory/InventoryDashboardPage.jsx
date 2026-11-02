import { AlertTriangle, Boxes, PackageX, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import { api } from '../../services/api.js';
import { currency, formatDateTime } from '../../utils/format.js';

export default function InventoryDashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/inventory/dashboard')
            .then((response) => setData(response.data))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <PageHeader
                title="Inventory"
                description="Stock health, valuation, and recent movements."
                breadcrumbs={['Inventory', 'Dashboard']}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/inventory/ingredients" className="btn-primary">Ingredients</Link>
                        <Link to="/inventory/stock-in" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Stock in</Link>
                    </div>
                )}
            />

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard label="Active ingredients" value={data?.total_items ?? 0} icon={Boxes} tone="bg-lime" />
                    <KpiCard label="Low stock" value={data?.low_stock ?? 0} icon={AlertTriangle} tone="bg-[#fff0bd]" />
                    <KpiCard label="Out of stock" value={data?.out_of_stock ?? 0} icon={PackageX} tone="bg-[#ffe0d7]" />
                    <KpiCard label="Stock valuation" value={currency(data?.total_valuation)} icon={Wallet} tone="bg-[#d8e8ff]" />
                </section>
            )}

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
                <article className="card-panel p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Low stock</p>
                            <p className="text-sm text-ink/45">At or below reorder level</p>
                        </div>
                        <Link to="/inventory/stock?filter=low" className="text-sm font-medium text-herb">View all</Link>
                    </div>
                    <div className="mt-4 divide-y divide-ink/7">
                        {(data?.low_stock_items || []).length ? data.low_stock_items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-xs text-ink/40">{item.sku}</p>
                                </div>
                                <p className="font-semibold text-amber-700">{Number(item.current_stock)} {item.unit}</p>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-ink/40">No low-stock items.</p>}
                    </div>
                </article>

                <article className="card-panel p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Recent movements</p>
                            <p className="text-sm text-ink/45">Latest stock changes</p>
                        </div>
                        <Link to="/inventory/movements" className="text-sm font-medium text-herb">History</Link>
                    </div>
                    <div className="mt-4 divide-y divide-ink/7">
                        {(data?.recent_movements || []).length ? data.recent_movements.map((movement) => (
                            <div key={movement.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                                <div>
                                    <p className="font-medium">{movement.inventory_item?.name || 'Item'}</p>
                                    <p className="text-xs text-ink/40">{movement.type.replace(/_/g, ' ')} · {formatDateTime(movement.occurred_at)}</p>
                                </div>
                                <p className={`font-semibold ${Number(movement.quantity) < 0 ? 'text-coral' : 'text-herb'}`}>
                                    {Number(movement.quantity) > 0 ? '+' : ''}{Number(movement.quantity)}
                                </p>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-ink/40">No movements yet.</p>}
                    </div>
                </article>
            </section>
        </div>
    );
}
