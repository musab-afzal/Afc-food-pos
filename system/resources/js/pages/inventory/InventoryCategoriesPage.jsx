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

const emptyForm = { name: '', description: '', is_active: true };

export default function InventoryCategoriesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/inventory/categories', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? { name: row.name, description: row.description || '', is_active: row.is_active } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/inventory/categories/${editing.id}` : '/inventory/categories', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });
            toast.success(editing ? 'Category updated' : 'Category created');
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
            await api(`/inventory/categories/${deleting.id}`, { method: 'DELETE' });
            toast.success('Category archived');
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
                title="Ingredient Categories"
                description="Group raw materials for purchasing and stock control."
                breadcrumbs={['Inventory', 'Categories']}
                actions={can('inventory.create') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add category
                    </button>
                )}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} />
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No ingredient categories yet."
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                    { key: 'items_count', label: 'Items', render: (row) => row.items_count ?? 0 },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-1">
                                {can('inventory.edit') && <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>}
                                {can('inventory.edit') && <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit category' : 'Add category'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy}>
                <div className="space-y-4">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Description</span><textarea className="field min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive category?" message="Ingredients keep their history. The category will be hidden from new entries." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
