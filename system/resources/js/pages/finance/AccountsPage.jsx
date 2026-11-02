import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

const emptyAccount = { name: '', code: '', type: 'cash', opening_balance: '0', is_active: true };
const emptyAdjust = { amount: '', direction: 'increase', reason: '' };

export default function AccountsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/accounts', filters);
    const [open, setOpen] = useState(false);
    const [adjusting, setAdjusting] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(emptyAccount);
    const [adjust, setAdjust] = useState(emptyAdjust);

    async function submitAccount(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/accounts', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name,
                    code: form.code.toUpperCase(),
                    type: form.type,
                    opening_balance: Number(form.opening_balance),
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success('Account created');
            setOpen(false);
            setForm(emptyAccount);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function submitAdjust(event) {
        event.preventDefault();
        if (!adjusting) return;
        setBusy(true);
        try {
            await api(`/accounts/${adjusting.id}/adjustments`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: Number(adjust.amount),
                    direction: adjust.direction,
                    reason: adjust.reason,
                }),
            });
            toast.success('Balance adjusted');
            setAdjusting(null);
            setAdjust(emptyAdjust);
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
                title="Accounts"
                description="Cash, bank, and wallet balances used by the ledger."
                breadcrumbs={['Finance', 'Accounts']}
                actions={can('finance.accounts') && (
                    <button type="button" onClick={() => { setForm(emptyAccount); setOpen(true); }} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> New account
                    </button>
                )}
            />

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No accounts yet."
                rows={rows}
                columns={[
                    { key: 'code', label: 'Code', render: (row) => <span className="font-semibold">{row.code}</span> },
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
                    { key: 'current_balance', label: 'Balance', className: 'text-right', render: (row) => <span className="font-semibold">{currency(row.current_balance)}</span> },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('finance.accounts') && (
                            <button type="button" onClick={() => { setAdjusting(row); setAdjust(emptyAdjust); }} className="text-sm font-semibold text-herb">
                                Adjust
                            </button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Create account" description="Opening balance seeds current_balance." onClose={() => setOpen(false)} onSubmit={submitAccount} busy={busy} submitLabel="Create">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Code
                        <input required className="field mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                    </label>
                    <label className="text-sm font-medium">Type
                        <select className="field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                            <option value="wallet">Wallet</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">Opening balance
                        <input required type="number" step="0.01" className="field mt-1" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
                    </label>
                </div>
            </FormModal>

            <FormModal open={Boolean(adjusting)} title={`Adjust ${adjusting?.name || ''}`} description={`Current balance ${currency(adjusting?.current_balance)}`} onClose={() => setAdjusting(null)} onSubmit={submitAdjust} busy={busy} submitLabel="Post adjustment">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Direction
                        <select className="field mt-1" value={adjust.direction} onChange={(e) => setAdjust({ ...adjust, direction: e.target.value })}>
                            <option value="increase">Increase</option>
                            <option value="decrease">Decrease</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">Amount
                        <input required type="number" min="0.01" step="0.01" className="field mt-1" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Reason
                        <textarea required className="field mt-1 min-h-20" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
