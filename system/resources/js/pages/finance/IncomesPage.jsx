import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDate } from '../../utils/format.js';

const empty = {
    category: '',
    payment_method_id: '',
    account_id: '',
    amount: '',
    income_date: new Date().toISOString().slice(0, 10),
    reference: '',
    description: '',
};

export default function IncomesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/incomes', filters);
    const [methods, setMethods] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);

    useEffect(() => {
        api('/payment-methods?per_page=100').then((r) => setMethods(r.data || [])).catch(() => {});
        api('/accounts?per_page=100').then((r) => setAccounts(r.data || [])).catch(() => {});
    }, []);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/incomes', {
                method: 'POST',
                body: JSON.stringify({
                    category: form.category,
                    payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : null,
                    account_id: form.account_id ? Number(form.account_id) : null,
                    amount: Number(form.amount),
                    income_date: form.income_date,
                    reference: form.reference || null,
                    description: form.description || null,
                }),
            });
            toast.success('Income recorded');
            setOpen(false);
            setForm(empty);
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
                title="Income"
                description="Non-sale income such as tips pools, deposits, or miscellaneous receipts."
                breadcrumbs={['Finance', 'Income']}
                actions={can('finance.income') && (
                    <button type="button" onClick={() => { setForm({ ...empty, income_date: new Date().toISOString().slice(0, 10) }); setOpen(true); }} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add income
                    </button>
                )}
            />

            <div className="mb-4">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Income #, category…" className="max-w-md" />
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No income entries yet."
                rows={rows}
                columns={[
                    { key: 'income_number', label: 'Number', render: (row) => <span className="font-semibold">{row.income_number}</span> },
                    { key: 'category', label: 'Category' },
                    { key: 'income_date', label: 'Date', render: (row) => formatDate(row.income_date) },
                    { key: 'payment', label: 'Received via', render: (row) => row.payment_method?.name || '—' },
                    { key: 'amount', label: 'Amount', className: 'text-right', render: (row) => <span className="font-semibold">{currency(row.amount)}</span> },
                    { key: 'description', label: 'Notes', render: (row) => row.description || row.reference || '—' },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Record income" description="Posts to ledger and cash drawer for cash receipts." onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Save income">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Category
                        <input required className="field mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Tips, Deposit" />
                    </label>
                    <label className="text-sm font-medium">Amount
                        <input required type="number" min="0.01" step="0.01" className="field mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Date
                        <input required type="date" className="field mt-1" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Payment method
                        <select className="field mt-1" value={form.payment_method_id} onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}>
                            <option value="">Optional</option>
                            {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-medium">Account
                        <select className="field mt-1" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                            <option value="">Optional</option>
                            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Reference
                        <input className="field mt-1" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Description
                        <textarea className="field mt-1 min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
