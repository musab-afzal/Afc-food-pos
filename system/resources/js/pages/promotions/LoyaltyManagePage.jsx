import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

export default function LoyaltyManagePage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ customer_id: '', type: '', page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/loyalty/transactions', filters);
    const [customers, setCustomers] = useState([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ customer_id: '', points: '', notes: '' });

    useEffect(() => {
        api('/customers?per_page=100').then((r) => setCustomers(r.data || [])).catch(() => {});
    }, []);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/loyalty/adjust', {
                method: 'POST',
                body: JSON.stringify({
                    customer_id: Number(form.customer_id),
                    points: Number(form.points),
                    notes: form.notes,
                }),
            });
            toast.success('Loyalty points adjusted');
            setOpen(false);
            setForm({ customer_id: '', points: '', notes: '' });
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Loyalty ledger"
                description="Earn, redeem, and manual point adjustments."
                breadcrumbs={['Promotions', 'Loyalty']}
                actions={(can('loyalty.manage') || can('customers.loyalty')) && (
                    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Adjust points
                    </button>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.customer_id} onChange={(e) => setFilters((f) => ({ ...f, customer_id: e.target.value, page: 1 }))}>
                    <option value="">All customers</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}>
                    <option value="">All types</option>
                    <option value="earn">Earn</option>
                    <option value="redeem">Redeem</option>
                    <option value="adjust">Adjust</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No loyalty transactions yet."
                rows={rows}
                columns={[
                    { key: 'customer', label: 'Customer', render: (row) => row.customer?.name || `#${row.customer_id}` },
                    { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type} /> },
                    { key: 'points', label: 'Points', render: (row) => <span className={`font-semibold ${Number(row.points) < 0 ? 'text-coral' : 'text-herb'}`}>{Number(row.points) > 0 ? '+' : ''}{row.points}</span> },
                    { key: 'balance_after', label: 'Balance' },
                    { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
                    { key: 'created_at', label: 'When', render: (row) => formatDateTime(row.created_at) },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Adjust loyalty points" description="Use negative points to deduct. Notes are required." onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Post adjustment">
                <label className="text-sm font-medium">Customer
                    <select required className="field mt-1" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                        <option value="">Select…</option>
                        {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.loyalty_points || 0} pts)</option>)}
                    </select>
                </label>
                <label className="mt-4 block text-sm font-medium">Points (+/−)
                    <input required type="number" className="field mt-1" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
                </label>
                <label className="mt-4 block text-sm font-medium">Notes
                    <textarea required className="field mt-1 min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>
            </FormModal>
        </div>
    );
}
