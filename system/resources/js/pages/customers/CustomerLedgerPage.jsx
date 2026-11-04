import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { api } from '../../services/api.js';
import { currency, formatDateTime } from '../../utils/format.js';

export default function CustomerLedgerPage() {
    const [customers, setCustomers] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            api(`/customers?per_page=50&search=${encodeURIComponent(query)}`)
                .then((response) => setCustomers(response.data || []))
                .catch((error) => toast.error(error.message));
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!selectedId) {
            setRows([]);
            setSummary(null);
            return;
        }
        setLoading(true);
        api(`/customers/${selectedId}/ledger`)
            .then((response) => {
                const payload = response.data || {};
                const entries = payload.entries || response.data || [];
                setSummary({
                    balance: payload.balance ?? payload.customer_balance ?? 0,
                    loyalty_points: payload.loyalty_points ?? 0,
                    outstanding: payload.outstanding ?? 0,
                });
                setRows((Array.isArray(entries) ? entries : []).map((row, index) => ({ ...row, id: row.id || `${row.type}-${index}` })));
            })
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [selectedId]);

    const selected = customers.find((customer) => String(customer.id) === String(selectedId));

    return (
        <div>
            <PageHeader
                title="Customer Ledger"
                description="Pay-later (unpaid) balances, sales, and loyalty for a guest."
                breadcrumbs={['Customers', 'Ledger']}
            />
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_280px]">
                <SearchInput value={query} onChange={setQuery} placeholder="Find customer…" />
                <select className="field" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name} · {customer.phone || customer.customer_code}
                            {Number(customer.balance) > 0 ? ` · Due ${currency(customer.balance)}` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {selectedId && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-ink/10 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Ledger balance</p>
                        <p className="mt-1 text-2xl font-bold text-orange-600">{currency(summary?.balance ?? selected?.balance ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Open unpaid</p>
                        <p className="mt-1 text-2xl font-bold">{currency(summary?.outstanding ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Loyalty points</p>
                        <p className="mt-1 text-2xl font-bold">{summary?.loyalty_points ?? selected?.loyalty_points ?? 0}</p>
                    </div>
                </div>
            )}

            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage={selectedId ? 'No ledger entries.' : 'Select a customer to view ledger.'}
                columns={[
                    { key: 'date', label: 'When', render: (row) => formatDateTime(row.occurred_at || row.date || row.sold_at || row.created_at) },
                    { key: 'label', label: 'Entry', render: (row) => row.label || row.reference || row.type || row.invoice_number || '—' },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => {
                            if (row.payment_status) return String(row.payment_status).replace(/_/g, ' ');
                            if (row.status) return row.status;
                            return '—';
                        },
                    },
                    { key: 'amount', label: 'Amount', render: (row) => (row.amount != null ? currency(row.amount) : '—') },
                    {
                        key: 'due',
                        label: 'Due',
                        render: (row) => (row.due != null ? currency(row.due) : (row.balance_delta != null ? currency(row.balance_delta) : '—')),
                    },
                    { key: 'points', label: 'Points', render: (row) => (row.points != null ? row.points : '—') },
                ]}
            />
        </div>
    );
}
