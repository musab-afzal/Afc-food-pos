import { Archive, Edit3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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

const emptyModifier = () => ({
    id: null,
    name: '',
    additional_price: '0',
    additional_cost: '0',
    is_active: true,
    sort_order: 0,
});

const emptyForm = {
    name: '',
    is_required: false,
    min_selections: 0,
    max_selections: '',
    is_active: true,
    dish_ids: [],
    modifiers: [emptyModifier()],
};

const currency = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 2 }).format(Number(value || 0));

export default function ModifierGroupsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/modifier-groups', filters);
    const [dishes, setDishes] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [archiving, setArchiving] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/dishes?per_page=100&is_active=1')
            .then((response) => setDishes(response.data || []))
            .catch(() => {});
    }, []);

    function openForm(group = null) {
        setEditing(group);
        if (group) {
            setForm({
                name: group.name,
                is_required: group.is_required,
                min_selections: group.min_selections ?? 0,
                max_selections: group.max_selections ?? '',
                is_active: group.is_active,
                dish_ids: (group.dishes || []).map((dish) => dish.id),
                modifiers: (group.modifiers || []).length
                    ? group.modifiers.map((modifier, index) => ({
                        id: modifier.id,
                        name: modifier.name,
                        additional_price: modifier.additional_price,
                        additional_cost: modifier.additional_cost ?? 0,
                        is_active: modifier.is_active,
                        sort_order: modifier.sort_order ?? index,
                    }))
                    : [emptyModifier()],
            });
        } else {
            setForm({ ...emptyForm, modifiers: [emptyModifier()] });
        }
        setFormErrors({});
        setIsFormOpen(true);
    }

    function updateModifier(index, patch) {
        setForm((current) => ({
            ...current,
            modifiers: current.modifiers.map((modifier, i) => (i === index ? { ...modifier, ...patch } : modifier)),
        }));
    }

    function addModifier() {
        setForm((current) => ({
            ...current,
            modifiers: [...current.modifiers, { ...emptyModifier(), sort_order: current.modifiers.length }],
        }));
    }

    function removeModifier(index) {
        setForm((current) => ({
            ...current,
            modifiers: current.modifiers.filter((_, i) => i !== index).map((modifier, i) => ({ ...modifier, sort_order: i })),
        }));
    }

    function toggleDish(dishId) {
        setForm((current) => ({
            ...current,
            dish_ids: current.dish_ids.includes(dishId)
                ? current.dish_ids.filter((id) => id !== dishId)
                : [...current.dish_ids, dishId],
        }));
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setFormErrors({});
        try {
            const payload = {
                name: form.name,
                is_required: form.is_required,
                min_selections: Number(form.min_selections),
                max_selections: form.max_selections === '' || form.max_selections === null ? null : Number(form.max_selections),
                is_active: form.is_active,
                dish_ids: form.dish_ids,
                modifiers: form.modifiers.map((modifier, index) => ({
                    id: modifier.id || undefined,
                    name: modifier.name,
                    additional_price: Number(modifier.additional_price),
                    additional_cost: Number(modifier.additional_cost || 0),
                    is_active: modifier.is_active,
                    sort_order: Number(modifier.sort_order ?? index),
                })),
            };
            const response = await api(editing ? `/modifier-groups/${editing.id}` : '/modifier-groups', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(response.message || (editing ? 'Modifier group updated' : 'Modifier group created'));
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
            const response = await api(`/modifier-groups/${archiving.id}`, { method: 'DELETE' });
            toast.success(response.message || 'Modifier group archived');
            setArchiving(null);
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
            label: 'Group',
            render: (row) => (
                <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-ink/40">
                        {row.is_required ? 'Required' : 'Optional'} · min {row.min_selections}
                        {row.max_selections != null ? ` · max ${row.max_selections}` : ''}
                    </p>
                </div>
            ),
        },
        { key: 'modifiers_count', label: 'Options', render: (row) => row.modifiers_count ?? row.modifiers?.length ?? 0 },
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
                title="Modifier groups"
                description="Define choice sets like size, spice, or toppings with min/max selection rules."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Group
                    </button>
                )}
            />

            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-7 flex flex-wrap gap-3 rounded-3xl bg-white p-3 soft-shadow">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters({ ...filters, search, page: 1 })}
                    placeholder="Search modifier groups…"
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
                <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No modifier groups match these filters." />
                <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            </div>

            <FormModal
                open={isFormOpen}
                title={editing ? 'Edit modifier group' : 'Create modifier group'}
                description="Options sync on save. Removing an option deletes it from this group."
                onClose={() => { setIsFormOpen(false); setEditing(null); setForm(emptyForm); }}
                onSubmit={submit}
                busy={busy}
                submitLabel={editing ? 'Update group' : 'Create group'}
                wide
            >
                <div className="grid gap-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium sm:col-span-2">
                            Group name
                            <input className="field mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            {formErrors.name && <span className="mt-1 block text-xs text-red-600">{formErrors.name[0]}</span>}
                        </label>
                        <label className="block text-sm font-medium">
                            Min selections
                            <input className="field mt-2" type="number" min="0" required value={form.min_selections} onChange={(e) => setForm({ ...form, min_selections: e.target.value })} />
                            {formErrors.min_selections && <span className="mt-1 block text-xs text-red-600">{formErrors.min_selections[0]}</span>}
                        </label>
                        <label className="block text-sm font-medium">
                            Max selections
                            <input className="field mt-2" type="number" min="0" value={form.max_selections} onChange={(e) => setForm({ ...form, max_selections: e.target.value })} placeholder="Unlimited" />
                            {formErrors.max_selections && <span className="mt-1 block text-xs text-red-600">{formErrors.max_selections[0]}</span>}
                        </label>
                        <label className="flex items-center gap-3 text-sm font-medium">
                            <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked, min_selections: e.target.checked && Number(form.min_selections) < 1 ? 1 : form.min_selections })} className="size-4 accent-herb" />
                            Required
                        </label>
                        <label className="flex items-center gap-3 text-sm font-medium">
                            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-herb" />
                            Active
                        </label>
                    </div>

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">Options</p>
                            <button type="button" onClick={addModifier} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-herb hover:bg-herb/5">
                                <Plus size={14} /> Add option
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.modifiers.map((modifier, index) => (
                                <div key={modifier.id || `new-${index}`} className="grid gap-3 rounded-2xl border border-ink/8 p-3 sm:grid-cols-12">
                                    <label className="block text-sm font-medium sm:col-span-4">
                                        Name
                                        <input className="field mt-2" required value={modifier.name} onChange={(e) => updateModifier(index, { name: e.target.value })} />
                                    </label>
                                    <label className="block text-sm font-medium sm:col-span-2">
                                        Price
                                        <input className="field mt-2" type="number" step="0.01" min="0" required value={modifier.additional_price} onChange={(e) => updateModifier(index, { additional_price: e.target.value })} />
                                    </label>
                                    <label className="block text-sm font-medium sm:col-span-2">
                                        Cost
                                        <input className="field mt-2" type="number" step="0.0001" min="0" value={modifier.additional_cost} onChange={(e) => updateModifier(index, { additional_cost: e.target.value })} />
                                    </label>
                                    <label className="block text-sm font-medium sm:col-span-2">
                                        Sort
                                        <input className="field mt-2" type="number" min="0" value={modifier.sort_order} onChange={(e) => updateModifier(index, { sort_order: e.target.value })} />
                                    </label>
                                    <div className="flex items-end justify-between gap-2 sm:col-span-2">
                                        <label className="flex items-center gap-2 pb-3 text-sm font-medium">
                                            <input type="checkbox" checked={modifier.is_active} onChange={(e) => updateModifier(index, { is_active: e.target.checked })} className="size-4 accent-herb" />
                                            On
                                        </label>
                                        {form.modifiers.length > 1 && (
                                            <button type="button" onClick={() => removeModifier(index)} className="mb-2 rounded-lg p-2 text-ink/35 hover:bg-red-50 hover:text-red-600" title="Remove option">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {formErrors.modifiers && <p className="mt-2 text-xs text-red-600">{Array.isArray(formErrors.modifiers) ? formErrors.modifiers[0] : 'Check modifier options.'}</p>}
                    </div>

                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink/40">Attach to dishes (optional)</p>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-ink/8 p-3">
                            {dishes.length === 0 && <p className="text-sm text-ink/40">No active dishes available.</p>}
                            {dishes.map((dish) => (
                                <label key={dish.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-ink/[.03]">
                                    <input type="checkbox" checked={form.dish_ids.includes(dish.id)} onChange={() => toggleDish(dish.id)} className="size-4 accent-herb" />
                                    <span className="flex-1">{dish.name}</span>
                                    <span className="text-xs text-ink/35">{currency(dish.base_price)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(archiving)}
                title="Archive modifier group?"
                message={`${archiving?.name || 'This group'} will be hidden from new orders. Existing tickets keep their modifier snapshots.`}
                onCancel={() => setArchiving(null)}
                onConfirm={archive}
                busy={busy}
                confirmLabel="Archive"
            />
        </div>
    );
}
