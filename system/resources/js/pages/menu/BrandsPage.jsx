import { Archive, Edit3, Plus } from 'lucide-react';
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

const emptyForm = { name: '', logo: '', description: '', is_active: true };

export default function BrandsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/brands', filters);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(brand = null) {
        setEditing(brand);
        setForm(brand
            ? { name: brand.name, logo: brand.logo || '', description: brand.description || '', is_active: brand.is_active }
            : emptyForm);
        setFormErrors({});
        setIsFormOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setFormErrors({});
        try {
            const payload = { ...form, logo: form.logo || null, description: form.description || null };
            const response = await api(editing ? `/brands/${editing.id}` : '/brands', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(response.message || (editing ? 'Brand updated' : 'Brand created'));
            setIsFormOpen(false);
            setEditing(null);
            setForm(emptyForm);
            await reload();
        } catch (caught) {
            setFormErrors(caught.errors || {});
            toast.error(caught.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            const response = await api(`/brands/${deleting.id}`, { method: 'DELETE' });
            toast.success(response.message || 'Brand deleted');
            setDeleting(null);
            await reload();
        } catch (caught) {
            toast.error(caught.message);
        } finally {
            setBusy(false);
        }
    }

    const columns = [
        {
            key: 'name',
            label: 'Brand',
            render: (row) => (
                <div>
                    <p className="font-semibold">{row.name}</p>
                    {row.description && <p className="line-clamp-1 text-xs text-ink/40">{row.description}</p>}
                </div>
            ),
        },
        { key: 'dishes_count', label: 'Dishes', render: (row) => <span className="font-medium">{row.dishes_count ?? 0}</span> },
        { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
        {
            key: 'actions',
            label: 'Actions',
            className: 'text-right',
            render: (row) => (
                <div className="flex justify-end gap-1">
                    {can('menu.edit') && (
                        <button type="button" onClick={() => openForm(row)} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-heading hover:bg-light">
                            <Edit3 size={14} /> Edit
                        </button>
                    )}
                    {can('menu.delete') && (
                        <button type="button" onClick={() => setDeleting(row)} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5">
                            <Archive size={14} /> Remove
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="mx-auto max-w-[1450px]">
            <PageHeader
                eyebrow="Menu management"
                title="Brands"
                description="Group dishes under brand labels for multi-concept restaurants."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Brand
                    </button>
                )}
            />

            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-7 flex flex-wrap gap-3 rounded-3xl bg-white p-3 soft-shadow">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters({ ...filters, search, page: 1 })}
                    placeholder="Search brands…"
                    className="min-w-64 flex-1 border-0 bg-ink/[.035]"
                />
                <select
                    value={filters.is_active}
                    onChange={(event) => setFilters({ ...filters, is_active: event.target.value, page: 1 })}
                    className="rounded-xl border border-ink/10 bg-white px-3 text-sm"
                >
                    <option value="">All statuses</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                </select>
            </div>

            <div className="mt-4">
                <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No brands match these filters." />
                <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            </div>

            <FormModal
                open={isFormOpen}
                title={editing ? 'Edit brand' : 'Create brand'}
                description="Brand names must be unique across the catalog."
                onClose={() => { setIsFormOpen(false); setEditing(null); setForm(emptyForm); }}
                onSubmit={submit}
                busy={busy}
                submitLabel={editing ? 'Update brand' : 'Create brand'}
            >
                <div className="grid gap-4">
                    <label className="block text-sm font-medium">
                        Name
                        <input className="field mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        {formErrors.name && <span className="mt-1 block text-xs text-red-600">{formErrors.name[0]}</span>}
                    </label>
                    <label className="block text-sm font-medium">
                        Logo URL
                        <input className="field mt-2" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="Optional path or URL" />
                        {formErrors.logo && <span className="mt-1 block text-xs text-red-600">{formErrors.logo[0]}</span>}
                    </label>
                    <label className="block text-sm font-medium">
                        Description
                        <textarea className="field mt-2" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-herb" />
                        Active
                    </label>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete brand?"
                message={`${deleting?.name || 'This brand'} will be soft-deleted. Linked dishes keep their history with brand cleared if needed.`}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
                busy={busy}
                confirmLabel="Delete"
            />
        </div>
    );
}
