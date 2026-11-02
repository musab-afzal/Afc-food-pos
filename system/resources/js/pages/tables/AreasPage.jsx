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

const emptyForm = { name: '', description: '', sort_order: 0, is_active: true };

export default function AreasPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/areas', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            name: row.name,
            description: row.description || '',
            sort_order: row.sort_order ?? 0,
            is_active: row.is_active,
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/areas/${editing.id}` : '/areas', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });
            toast.success(editing ? 'Area updated' : 'Area created');
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
            await api(`/areas/${deleting.id}`, { method: 'DELETE' });
            toast.success('Area archived');
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
                title="Areas"
                description="Dining zones such as Main Hall, VIP, and Outdoor."
                breadcrumbs={['Tables', 'Areas']}
                actions={can('tables.manage') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add area
                    </button>
                )}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} />
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No areas yet."
                columns={[
                    { key: 'name', label: 'Area' },
                    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                    { key: 'tables_count', label: 'Tables', render: (row) => row.tables_count ?? 0 },
                    { key: 'sort_order', label: 'Order' },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('tables.manage') && (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit area' : 'Add area'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy}>
                <div className="space-y-4">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Description</span><textarea className="field min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Sort order</span><input className="field" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive area?" message="Tables remain; the area is hidden from new assignments." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
