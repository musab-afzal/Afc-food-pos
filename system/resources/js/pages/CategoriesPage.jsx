import { Archive, Edit3, Plus } from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DataTable from '../components/DataTable.jsx';
import FormModal from '../components/FormModal.jsx';
import ListFilters from '../components/ListFilters.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePaginatedResource } from '../hooks/usePaginatedResource.js';
import { api } from '../services/api.js';

const emptyForm = { name: '', slug: '', description: '', image: '', sort_order: 0, is_active: true };
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function CategoriesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/categories', filters);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [archiving, setArchiving] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    function openForm(category = null) {
        setEditing(category); setForm(category ? { name: category.name, slug: category.slug, description: category.description || '', image: category.image || '', sort_order: category.sort_order, is_active: category.is_active } : emptyForm); setFormErrors({}); setIsFormOpen(true);
    }
    async function submit(event) {
        event.preventDefault(); setBusy(true); setFormErrors({});
        try {
            const response = await api(editing ? `/categories/${editing.id}` : '/categories', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
            setNotice(response.message); setIsFormOpen(false); setEditing(null); setForm(emptyForm); await reload();
        } catch (caught) { setFormErrors(caught.errors || { general: [caught.message] }); }
        finally { setBusy(false); }
    }
    async function archive() {
        setBusy(true);
        try { const response = await api(`/categories/${archiving.id}`, { method: 'DELETE' }); setNotice(response.message); setArchiving(null); await reload(); }
        catch (caught) { setNotice(caught.message); }
        finally { setBusy(false); }
    }
    const columns = [
        { key: 'name', label: 'Category', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">/{row.slug}</p></div> },
        { key: 'dishes_count', label: 'Dishes', render: (row) => <span className="font-medium">{row.dishes_count}</span> },
        { key: 'sort_order', label: 'Order' },
        { key: 'is_active', label: 'Status', render: (row) => <StatusBadge active={row.is_active} /> },
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
                    {can('menu.delete') && row.is_active && (
                        <button type="button" onClick={() => setArchiving(row)} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5">
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
                title="Categories"
                description="Organize the menu guests and cashiers browse."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Category
                    </button>
                )}
            />
            {notice && <button type="button" onClick={() => setNotice('')} className="mb-4 w-full rounded-[5px] bg-primary-soft px-4 py-3 text-left text-sm font-medium text-heading">{notice}</button>}
            {error && <p className="mb-4 rounded-[5px] bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Search categories…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select value={filters.is_active} onChange={(event) => setFilters((f) => ({ ...f, is_active: event.target.value, page: 1 }))} className="field max-w-xs">
                    <option value="">All statuses</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                </select>
            </ListFilters>
            <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No categories match these filters." />
            <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            <FormModal open={isFormOpen} title={editing ? 'Edit category' : 'Add category'} description="Names and ordering update both admin and POS catalog views." onClose={() => { setIsFormOpen(false); setEditing(null); setForm(emptyForm); }} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update category' : 'Create category'}>
                <div className="grid gap-4">
                    <Field label="Name" error={formErrors.name} value={form.name} onChange={(value) => setForm({ ...form, name: value, slug: editing ? form.slug : slugify(value) })} />
                    <Field label="Slug" error={formErrors.slug} value={form.slug} onChange={(value) => setForm({ ...form, slug: slugify(value) })} />
                    <label className="text-sm font-medium">
                        Description
                        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" className="field mt-2" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Sort order" type="number" error={formErrors.sort_order} value={form.sort_order} onChange={(value) => setForm({ ...form, sort_order: Number(value) })} />
                        <label className="flex items-center gap-3 pt-8 text-sm font-medium">
                            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="size-4 accent-primary" />
                            Active
                        </label>
                    </div>
                    {formErrors.general && <p className="text-sm text-coral">{formErrors.general[0]}</p>}
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(archiving)} title="Remove category?" message={`${archiving?.name || 'This category'} will disappear from active menus. Its dishes and historical links stay preserved.`} onCancel={() => setArchiving(null)} onConfirm={archive} busy={busy} confirmLabel="Remove" />
        </div>
    );
}

function Field({ label, error, value, onChange, type = 'text' }) {
    return (
        <label className="text-sm font-medium">
            {label}
            <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className={`field mt-2 ${error ? 'border-coral' : ''}`} />
            {error && <span className="mt-1 block text-xs text-coral">{error[0]}</span>}
        </label>
    );
}
