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
            return;
        }
        setLoading(true);
        api(`/customers/${selectedId}/ledger`)
            .then((response) => setRows((response.data || []).map((row, index) => ({ ...row, id: row.id || index }))))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [selectedId]);

    return (
        <div>
            <PageHeader
                title="Customer Ledger"
                description="Sales and loyalty movements for a selected guest."
                breadcrumbs={['Customers', 'Ledger']}
            />
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_280px]">
                <SearchInput value={query} onChange={setQuery} placeholder="Find customer…" />
                <select className="field" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone || customer.customer_code}</option>
                    ))}
                </select>
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage={selectedId ? 'No ledger entries.' : 'Select a customer to view ledger.'}
                columns={[
                    { key: 'date', label: 'When', render: (row) => formatDateTime(row.date || row.sold_at || row.created_at) },
                    { key: 'label', label: 'Entry', render: (row) => row.label || row.type || row.invoice_number || '—' },
                    { key: 'amount', label: 'Amount', render: (row) => (row.amount != null ? currency(row.amount) : '—') },
                    { key: 'points', label: 'Points', render: (row) => (row.points != null ? row.points : '—') },
                ]}
            />
        </div>
    );
}
