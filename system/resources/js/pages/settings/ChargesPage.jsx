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

const empty = { name: '', code: '', type: 'fixed', value: '', apply_to: 'all', is_active: true };

export default function ChargesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/charges', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);

    function openCreate() {
        setEditing(null);
        setForm(empty);
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            name: row.name,
            code: row.code,
            type: row.type === 'percentage' ? 'percent' : row.type,
            value: String(row.value ?? ''),
            apply_to: row.apply_to || 'all',
            is_active: Boolean(row.is_active),
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/charges/${editing.id}` : '/charges';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name: form.name,
                    code: form.code,
                    type: form.type,
                    value: Number(form.value),
                    apply_to: form.apply_to,
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success(editing ? 'Charge updated' : 'Charge created');
            setOpen(false);
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
                title="Service charges"
                description="Fixed or percent charges applied by order type."
                breadcrumbs={['Settings', 'Charges']}
                actions={can('settings.manage') && (
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add charge
                    </button>
                )}
            />
            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}
            <DataTable
                loading={loading}
                emptyMessage="No charges configured."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'code', label: 'Code' },
                    { key: 'value', label: 'Value', render: (row) => (['percent', 'percentage'].includes(row.type) ? `${row.value}%` : currency(row.value)) },
                    { key: 'apply_to', label: 'Applies', render: (row) => <span className="capitalize">{String(row.apply_to).replace(/_/g, ' ')}</span> },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('settings.manage') && (
                            <button type="button" onClick={() => openEdit(row)} className="text-sm font-semibold text-herb">Edit</button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit charge' : 'Add charge'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Code
                        <input required className="field mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={Boolean(editing)} />
                    </label>
                    <label className="text-sm font-medium">Type
                        <select className="field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option value="fixed">Fixed</option>
                            <option value="percent">Percent</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">Value
                        <input required type="number" min="0" step="0.01" className="field mt-1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Apply to
                        <select className="field mt-1" value={form.apply_to} onChange={(e) => setForm({ ...form, apply_to: e.target.value })}>
                            <option value="all">All</option>
                            <option value="dine_in">Dine in</option>
                            <option value="takeaway">Takeaway</option>
                            <option value="delivery">Delivery</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
