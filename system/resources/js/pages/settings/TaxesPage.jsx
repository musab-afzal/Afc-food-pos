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

const empty = { name: '', percentage: '', is_inclusive: false, is_active: true };

export default function TaxesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/taxes', filters);
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
            percentage: String(row.percentage ?? ''),
            is_inclusive: Boolean(row.is_inclusive),
            is_active: Boolean(row.is_active),
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/taxes/${editing.id}` : '/taxes';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name: form.name,
                    percentage: Number(form.percentage),
                    is_inclusive: Boolean(form.is_inclusive),
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success(editing ? 'Tax updated' : 'Tax created');
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
                title="Taxes"
                description="Tax rates available for restaurant configuration."
                breadcrumbs={['Settings', 'Taxes']}
                actions={can('settings.manage') && (
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add tax
                    </button>
                )}
            />
            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}
            <DataTable
                loading={loading}
                emptyMessage="No taxes configured."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'percentage', label: 'Rate', render: (row) => `${row.percentage}%` },
                    { key: 'is_inclusive', label: 'Inclusive', render: (row) => (row.is_inclusive ? 'Yes' : 'No') },
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
            <FormModal open={open} title={editing ? 'Edit tax' : 'Add tax'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'}>
                <div className="grid gap-4">
                    <label className="text-sm font-medium">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Percentage
                        <input required type="number" min="0" max="100" step="0.01" className="field mt-1" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={form.is_inclusive} onChange={(e) => setForm({ ...form, is_inclusive: e.target.checked })} /> Inclusive
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
