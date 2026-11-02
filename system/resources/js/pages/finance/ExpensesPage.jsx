import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDate } from '../../utils/format.js';

const empty = {
    expense_category_id: '',
    payment_method_id: '',
    account_id: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    reference: '',
    description: '',
};

export default function ExpensesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', expense_category_id: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/expenses', filters);
    const [categories, setCategories] = useState([]);
    const [methods, setMethods] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);

    useEffect(() => {
        api('/expense-categories?per_page=100').then((r) => setCategories(r.data || [])).catch(() => {});
        if (can('finance.view')) {
            api('/payment-methods?per_page=100').then((r) => setMethods(r.data || [])).catch(() => {});
            api('/accounts?per_page=100').then((r) => setAccounts(r.data || [])).catch(() => {});
        }
    }, [can]);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    expense_category_id: Number(form.expense_category_id),
                    payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : null,
                    account_id: form.account_id ? Number(form.account_id) : null,
                    amount: Number(form.amount),
                    expense_date: form.expense_date,
                    reference: form.reference || null,
                    description: form.description || null,
                }),
            });
            toast.success('Expense recorded');
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
                title="Expenses"
                description="Operating costs posted to the ledger and cash drawer when applicable."
                breadcrumbs={['Finance', 'Expenses']}
                actions={can('finance.expense') && (
                    <button type="button" onClick={() => { setForm({ ...empty, expense_date: new Date().toISOString().slice(0, 10) }); setOpen(true); }} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add expense
                    </button>
                )}
            />

            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Expense #, reference…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.expense_category_id} onChange={(e) => setFilters((f) => ({ ...f, expense_category_id: e.target.value, page: 1 }))}>
                    <option value="">All categories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
            </ListFilters>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No expenses yet."
                rows={rows}
                columns={[
                    { key: 'expense_number', label: 'Number', render: (row) => <span className="font-semibold">{row.expense_number}</span> },
                    { key: 'category', label: 'Category', render: (row) => row.category?.name || '—' },
                    { key: 'expense_date', label: 'Date', render: (row) => formatDate(row.expense_date) },
                    { key: 'payment', label: 'Paid via', render: (row) => row.payment_method?.name || '—' },
                    { key: 'amount', label: 'Amount', className: 'text-right', render: (row) => <span className="font-semibold">{currency(row.amount)}</span> },
                    { key: 'description', label: 'Notes', render: (row) => row.description || row.reference || '—' },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Record expense" description="Posts to ledger and cash drawer for cash payments." onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Save expense">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Category
                        <select required className="field mt-1" value={form.expense_category_id} onChange={(e) => setForm({ ...form, expense_category_id: e.target.value })}>
                            <option value="">Select…</option>
                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-medium">Amount
                        <input required type="number" min="0.01" step="0.01" className="field mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Date
                        <input required type="date" className="field mt-1" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
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
