import { Check, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function QrOrdersPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', status: 'pending', page: 1, per_page: 15, source: 'qr' });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/qr-orders', filters);
    const [busyId, setBusyId] = useState(null);

    async function accept(order) {
        setBusyId(order.id);
        try {
            await api(`/qr-orders/${order.id}/accept`, { method: 'POST', body: '{}' });
            toast.success(`${order.order_number} accepted → kitchen`);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function reject(order) {
        const reason = window.prompt('Reject reason (optional)') ?? '';
        setBusyId(order.id);
        try {
            await api(`/qr-orders/${order.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || null }) });
            toast.success(`${order.order_number} rejected`);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div>
            <PageHeader
                title="QR orders"
                description="Guest table orders waiting for acceptance."
                breadcrumbs={['Orders', 'QR']}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                    placeholder="Order #, table…"
                    className="min-w-[220px] flex-1"
                />
                <select
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                    value={filters.status}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Accepted</option>
                    <option value="cancelled">Rejected</option>
                    <option value="preparing">Preparing</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {error && (
                <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">
                    {error} — tap to retry
                </button>
            )}

            <DataTable
                loading={loading}
                emptyMessage="No QR orders in this filter."
                rows={rows}
                columns={[
                    { key: 'order_number', label: 'Order', render: (row) => <span className="font-semibold">{row.order_number}</span> },
                    { key: 'table', label: 'Table', render: (row) => row.table?.name || '—' },
                    { key: 'guest', label: 'Guest', render: (row) => row.guest_name || row.notes?.split('\n')?.[0] || 'Guest' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'grand_total', label: 'Total', className: 'text-right', render: (row) => money(row.grand_total) },
                    { key: 'ordered_at', label: 'When', render: (row) => (row.ordered_at ? new Date(row.ordered_at).toLocaleString() : '—') },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-2">
                                <Link to={`/orders/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60">
                                    <Eye size={14} /> View
                                </Link>
                                {row.status === 'pending' && can('orders.update') && (
                                    <button type="button" disabled={busyId === row.id} onClick={() => accept(row)} className="inline-flex items-center gap-1 rounded-lg bg-herb/15 px-2.5 py-1 text-xs font-semibold text-herb disabled:opacity-40">
                                        <Check size={14} /> Accept
                                    </button>
                                )}
                                {row.status === 'pending' && (can('orders.cancel') || can('orders.update')) && (
                                    <button type="button" disabled={busyId === row.id} onClick={() => reject(row)} className="inline-flex items-center gap-1 rounded-lg bg-coral/15 px-2.5 py-1 text-xs font-semibold text-coral disabled:opacity-40">
                                        <X size={14} /> Reject
                                    </button>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
    );
}
