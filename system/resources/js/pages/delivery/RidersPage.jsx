import { Edit3, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const emptyForm = { name: '', phone: '', vehicle_number: '', status: 'available', is_active: true };

export default function RidersPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/riders', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            name: row.name,
            phone: row.phone || '',
            vehicle_number: row.vehicle_number || '',
            status: row.status || 'available',
            is_active: row.is_active,
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/riders/${editing.id}` : '/riders', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });
            toast.success(editing ? 'Rider updated' : 'Rider created');
            setOpen(false);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            await api(`/riders/${deleting.id}`, { method: 'DELETE' });
            toast.success('Rider archived');
            setDeleting(null);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Riders"
                description="Delivery fleet availability and contact details."
                breadcrumbs={['Delivery', 'Riders']}
                actions={can('riders.manage') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add rider
                    </button>
                )}
            />
            <div className="mb-4">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search riders…" />
            </div>
            <DataTable
                loading={loading}
                emptyMessage="No riders yet."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Rider', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'phone', label: 'Phone' },
                    { key: 'vehicle_number', label: 'Vehicle', render: (row) => row.vehicle_number || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'is_active', label: 'Active', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('riders.manage') && (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit rider' : 'Add rider'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy}>
                <div className="grid gap-4">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Phone</span><input className="field" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Vehicle number</span><input className="field" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Status</span>
                        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {['available', 'busy', 'offline'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive rider?" message="Past deliveries stay linked." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
