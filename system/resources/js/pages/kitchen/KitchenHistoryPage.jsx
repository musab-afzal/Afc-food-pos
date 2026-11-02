import { ChefHat, Eye } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';

export default function KitchenHistoryPage() {
    const [filters, setFilters] = useState({
        search: '', date_from: '', date_to: '', page: 1, per_page: 20,
    });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/kitchen/tickets/history', filters);

    return (
        <div>
            <PageHeader
                title="Kitchen history"
                description="Completed and closed kitchen tickets."
                breadcrumbs={['Kitchen', 'History']}
                actions={(
                    <Link to="/kitchen" className="flex items-center gap-2 btn-primary">
                        <ChefHat size={16} /> Live display
                    </Link>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                    placeholder="Ticket #, order #…"
                    className="min-w-[220px] flex-1"
                />
                <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value, page: 1 }))}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                />
                <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value, page: 1 }))}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                />
            </div>

            {error && (
                <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">
                    {error} — tap to retry
                </button>
            )}

            <DataTable
                loading={loading}
                emptyMessage="No kitchen history yet."
                columns={[
                    { key: 'ticket_number', label: 'Ticket', render: (row) => <span className="font-semibold">{row.ticket_number}</span> },
                    { key: 'order', label: 'Order', render: (row) => row.order?.order_number || '—' },
                    { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{String(row.order?.order_type || '').replace(/_/g, ' ') || '—'}</span> },
                    { key: 'table', label: 'Table', render: (row) => row.order?.table?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'ready_at', label: 'Ready', render: (row) => (row.ready_at ? new Date(row.ready_at).toLocaleString() : '—') },
                    { key: 'completed_at', label: 'Completed', render: (row) => (row.completed_at ? new Date(row.completed_at).toLocaleString() : '—') },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            row.order_id ? (
                                <Link to={`/orders/${row.order_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                    <Eye size={15} /> Order
                                </Link>
                            ) : null
                        ),
                    },
                ]}
                rows={rows}
            />

            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
    );
}
