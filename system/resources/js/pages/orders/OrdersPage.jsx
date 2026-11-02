import { Ban, Eye, ShoppingBag } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { canCancelOrder, isOrderPaid, ORDER_CANCEL_WINDOW_HOURS } from '../../utils/format.js';
import { useEffect, useState } from 'react';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

const statuses = [
    '', 'draft', 'pending', 'confirmed', 'preparing', 'ready', 'served',
    'out_for_delivery', 'completed', 'cancelled', 'refunded', 'partially_refunded',
];

export default function OrdersPage() {
    const [searchParams] = useSearchParams();
    const urlSearch = searchParams.get('search') || '';
    const [filters, setFilters] = useState({
        search: urlSearch, status: '', order_type: '', payment_status: '', date_from: '', date_to: '', page: 1, per_page: 15,
    });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/orders', filters);
    const { can } = useAuth();
    const [cancelling, setCancelling] = useState(null);
    const [busy, setBusy] = useState(false);

    async function cancelOrder() {
        setBusy(true);
        try {
            await api(`/orders/${cancelling.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Cancelled from orders screen' }) });
            toast.success(isOrderPaid(cancelling) ? 'Order cancelled and refunded' : 'Order cancelled');
            setCancelling(null);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    // Header search navigates to /orders?search=… — keep the filter in sync when the URL changes on this page.
    useEffect(() => {
        setFilters((f) => (f.search === urlSearch ? f : { ...f, search: urlSearch, page: 1 }));
    }, [urlSearch]);

    return (
        <div>
            <PageHeader
                title="Orders"
                description="Live and historical restaurant orders across dine-in, takeaway, and delivery."
                breadcrumbs={['Orders', 'List']}
                actions={(
                    <Link to="/pos" className="flex items-center gap-2 btn-primary">
                        <ShoppingBag size={16} /> Open POS
                    </Link>
                )}
            />

            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Search order #, customer, table…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select
                    value={filters.status}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                >
                    <option value="">All statuses</option>
                    {statuses.filter(Boolean).map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                </select>
                <select
                    value={filters.order_type}
                    onChange={(e) => setFilters((f) => ({ ...f, order_type: e.target.value, page: 1 }))}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                >
                    <option value="">All types</option>
                    <option value="dine_in">Dine in</option>
                    <option value="takeaway">Takeaway</option>
                    <option value="delivery">Delivery</option>
                </select>
                <select
                    value={filters.payment_status}
                    onChange={(e) => setFilters((f) => ({ ...f, payment_status: e.target.value, page: 1 }))}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                >
                    <option value="">All payments</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partially paid</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                </select>
            </ListFilters>

            {error && (
                <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">
                    {error} — tap to retry
                </button>
            )}

            <DataTable
                loading={loading}
                emptyMessage="No orders yet. Complete a POS sale or create an open order."
                columns={[
                    { key: 'order_number', label: 'Order', render: (row) => <span className="font-semibold">{row.order_number}</span> },
                    { key: 'order_type', label: 'Type', render: (row) => <span className="capitalize">{String(row.order_type || '').replace(/_/g, ' ')}</span> },
                    { key: 'customer', label: 'Customer', render: (row) => row.customer?.name || 'Walk-in' },
                    { key: 'table', label: 'Table', render: (row) => row.table?.name || row.restaurant_table?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'payment_status', label: 'Payment', render: (row) => <StatusBadge status={row.payment_status || (row.sale ? 'paid' : 'unpaid')} /> },
                    { key: 'grand_total', label: 'Total', className: 'text-right', render: (row) => money(row.grand_total) },
                    { key: 'ordered_at', label: 'Ordered', render: (row) => (row.ordered_at ? new Date(row.ordered_at).toLocaleString() : '—') },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="inline-flex items-center gap-4">
                                {can('orders.cancel') && canCancelOrder(row) && (
                                    <button type="button" onClick={() => setCancelling(row)} className="inline-flex items-center gap-1 text-sm font-semibold text-coral">
                                        <Ban size={15} /> Cancel
                                    </button>
                                )}
                                <Link to={`/orders/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                    <Eye size={15} /> View
                                </Link>
                            </div>
                        ),
                    },
                ]}
                rows={rows}
            />

            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <ConfirmDialog
                open={Boolean(cancelling)}
                title={`Cancel ${cancelling?.order_number || 'order'}?`}
                message={isOrderPaid(cancelling)
                    ? `This order is paid. Cancelling will refund the remaining ${money(cancelling?.grand_total)} and return the ingredients to stock.`
                    : `Orders can be cancelled within ${ORDER_CANCEL_WINDOW_HOURS} hours of being placed.`}
                confirmLabel="Cancel order"
                busy={busy}
                onCancel={() => setCancelling(null)}
                onConfirm={cancelOrder}
            />
        </div>
    );
}
