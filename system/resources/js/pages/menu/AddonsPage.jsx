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

const emptyForm = { name: '', price: '', cost: '0', is_active: true };
const currency = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 2 }).format(Number(value || 0));

export default function AddonsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/addons', filters);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [archiving, setArchiving] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(addon = null) {
        setEditing(addon);
        setForm(addon
            ? { name: addon.name, price: addon.price, cost: addon.cost ?? 0, is_active: addon.is_active }
            : emptyForm);
        setFormErrors({});
        setIsFormOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setFormErrors({});
        try {
            const payload = {
                name: form.name,
                price: Number(form.price),
                cost: Number(form.cost || 0),
                is_active: form.is_active,
            };
            const response = await api(editing ? `/addons/${editing.id}` : '/addons', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(response.message || (editing ? 'Add-on updated' : 'Add-on created'));
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

    async function archive() {
        setBusy(true);
        try {
            const response = await api(`/addons/${archiving.id}`, { method: 'DELETE' });
            toast.success(response.message || 'Add-on archived');
            setArchiving(null);
            await reload();
        } catch (caught) {
            toast.error(caught.message);
        } finally {
            setBusy(false);
        }
    }

    const columns = [
        { key: 'name', label: 'Add-on', render: (row) => <p className="font-semibold">{row.name}</p> },
        { key: 'price', label: 'Price', render: (row) => <span className="font-semibold">{currency(row.price)}</span> },
        { key: 'cost', label: 'Cost', render: (row) => currency(row.cost) },
        { key: 'dishes_count', label: 'Dishes', render: (row) => row.dishes_count ?? 0 },
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
                title="Add-ons"
                description="Extras guests can attach to dishes at POS — priced and costed independently."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Add-on
                    </button>
                )}
            />

            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-7 flex flex-wrap gap-3 rounded-3xl bg-white p-3 soft-shadow">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters({ ...filters, search, page: 1 })}
                    placeholder="Search add-ons…"
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
                <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No add-ons match these filters." />
                <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            </div>

            <FormModal
                open={isFormOpen}
                title={editing ? 'Edit add-on' : 'Create add-on'}
                description="Prices are revalidated by the server during checkout."
                onClose={() => { setIsFormOpen(false); setEditing(null); setForm(emptyForm); }}
                onSubmit={submit}
                busy={busy}
                submitLabel={editing ? 'Update add-on' : 'Create add-on'}
            >
                <div className="grid gap-4">
                    <label className="block text-sm font-medium">
                        Name
                        <input className="field mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        {formErrors.name && <span className="mt-1 block text-xs text-red-600">{formErrors.name[0]}</span>}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block text-sm font-medium">
                            Price
                            <input className="field mt-2" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                            {formErrors.price && <span className="mt-1 block text-xs text-red-600">{formErrors.price[0]}</span>}
                        </label>
                        <label className="block text-sm font-medium">
                            Cost
                            <input className="field mt-2" type="number" step="0.0001" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                            {formErrors.cost && <span className="mt-1 block text-xs text-red-600">{formErrors.cost[0]}</span>}
                        </label>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-herb" />
                        Active
                    </label>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(archiving)}
                title="Archive add-on?"
                message={`${archiving?.name || 'This add-on'} will be hidden from new orders. Historical sales keep their snapshots.`}
                onCancel={() => setArchiving(null)}
                onConfirm={archive}
                busy={busy}
                confirmLabel="Archive"
            />
        </div>
    );
}
