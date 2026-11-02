import { useState } from 'react';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { formatDateTime } from '../../utils/format.js';

export default function MovementsPage() {
    const [filters, setFilters] = useState({ search: '', type: '', page: 1, per_page: 20 });
    const { rows, meta, loading } = usePaginatedResource('/inventory/movements', filters);

    return (
        <div>
            <PageHeader
                title="Stock Movements"
                description="Complete audit trail of every inventory change."
                breadcrumbs={['Inventory', 'Movements']}
            />
            <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1">
                    <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search ingredient…" />
                </div>
                <select className="field max-w-[220px]" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}>
                    <option value="">All types</option>
                    {['opening_stock', 'stock_in', 'stock_out', 'sale_consumption', 'manual_adjustment', 'waste', 'purchase', 'correction'].map((type) => (
                        <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No stock movements yet."
                columns={[
                    { key: 'occurred_at', label: 'When', render: (row) => formatDateTime(row.occurred_at) },
                    { key: 'item', label: 'Ingredient', render: (row) => row.inventory_item?.name || '—' },
                    { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{row.type.replace(/_/g, ' ')}</span> },
                    {
                        key: 'quantity',
                        label: 'Change',
                        render: (row) => (
                            <span className={`font-semibold ${Number(row.quantity) < 0 ? 'text-coral' : 'text-herb'}`}>
                                {Number(row.quantity) > 0 ? '+' : ''}{Number(row.quantity)}
                            </span>
                        ),
                    },
                    { key: 'after_quantity', label: 'After', render: (row) => Number(row.after_quantity) },
                    { key: 'user', label: 'User', render: (row) => row.user?.name || 'System' },
                    { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
    );
}
