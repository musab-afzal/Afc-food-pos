import { useState } from 'react';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { currency, formatDate } from '../../utils/format.js';

export default function LedgerPage() {
    const [filters, setFilters] = useState({ search: '', type: '', page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/financial-transactions', filters);

    return (
        <div>
            <PageHeader
                title="Ledger"
                description="All financial transactions across expenses, income, sales, and adjustments."
                breadcrumbs={['Finance', 'Ledger']}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Txn #, category…" className="min-w-[220px] flex-1" />
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}>
                    <option value="">All types</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="sale">Sale</option>
                    <option value="adjustment_in">Adjustment in</option>
                    <option value="adjustment_out">Adjustment out</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No ledger entries yet."
                rows={rows}
                columns={[
                    { key: 'transaction_number', label: 'Number', render: (row) => <span className="font-semibold">{row.transaction_number}</span> },
                    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                    { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{String(row.type).replace(/_/g, ' ')}</span> },
                    { key: 'category', label: 'Category', render: (row) => row.category || '—' },
                    { key: 'account', label: 'Account', render: (row) => row.account?.name || '—' },
                    { key: 'amount', label: 'Amount', className: 'text-right', render: (row) => <span className="font-semibold">{currency(row.amount)}</span> },
                    { key: 'description', label: 'Notes', render: (row) => row.description || '—' },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
    );
}
