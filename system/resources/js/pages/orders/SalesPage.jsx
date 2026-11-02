import { Eye, Printer, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function SalesPage() {
    const [filters, setFilters] = useState({
        search: '', order_type: '', date_from: '', date_to: '', page: 1, per_page: 15,
    });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/sales', filters);

    return (
        <div>
            <PageHeader
                title="Sales & receipts"
                description="Completed POS sales with printable receipts."
                breadcrumbs={['Orders', 'Sales']}
                actions={(
                    <Link to="/pos" className="flex items-center gap-2 btn-primary">
                        <Receipt size={16} /> New sale
                    </Link>
                )}
            />

            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Invoice #, customer…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
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
            </ListFilters>

            {error && (
                <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">
                    {error} — tap to retry
                </button>
            )}

            <DataTable
                loading={loading}
                emptyMessage="No sales yet. Complete a check on the POS."
                columns={[
                    { key: 'invoice_number', label: 'Invoice', render: (row) => <span className="font-semibold">{row.invoice_number}</span> },
                    { key: 'order_type', label: 'Type', render: (row) => <span className="capitalize">{String(row.order_type || '').replace(/_/g, ' ')}</span> },
                    { key: 'customer', label: 'Customer', render: (row) => row.customer?.name || 'Walk-in' },
                    { key: 'cashier', label: 'Cashier', render: (row) => row.cashier?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'grand_total', label: 'Total', className: 'text-right', render: (row) => money(row.grand_total) },
                    { key: 'sold_at', label: 'Sold at', render: (row) => (row.sold_at ? new Date(row.sold_at).toLocaleString() : '—') },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-3">
                                <Link to={`/sales/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink/70">
                                    <Eye size={15} /> View
                                </Link>
                                <Link to={`/sales/${row.id}/receipt`} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                    <Printer size={15} /> Print
                                </Link>
                            </div>
                        ),
                    },
                ]}
                rows={rows}
            />

            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
    );
}
