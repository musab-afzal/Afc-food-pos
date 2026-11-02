import { Edit3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const emptyForm = { name: '', sku: '', price: '', is_active: true, sort_order: 0 };
const currency = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 2 }).format(Number(value || 0));

export default function VariationsPage() {
    const { can } = useAuth();
    const [dishQuery, setDishQuery] = useState('');
    const [dishes, setDishes] = useState([]);
    const [selectedDishId, setSelectedDishId] = useState('');
    const [variants, setVariants] = useState([]);
    const [loadingDishes, setLoadingDishes] = useState(true);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setLoadingDishes(true);
            try {
                const params = new URLSearchParams({ per_page: '100', is_active: '1' });
                if (dishQuery) params.set('search', dishQuery);
                const response = await api(`/dishes?${params}`);
                setDishes(response.data || []);
            } catch (caught) {
                toast.error(caught.message);
            } finally {
                setLoadingDishes(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [dishQuery]);

    async function loadVariants(dishId) {
        if (!dishId) {
            setVariants([]);
            return;
        }
        setLoadingVariants(true);
        try {
            const response = await api(`/dishes/${dishId}/variants`);
            setVariants(response.data || []);
        } catch (caught) {
            toast.error(caught.message);
            setVariants([]);
        } finally {
            setLoadingVariants(false);
        }
    }

    useEffect(() => {
        loadVariants(selectedDishId);
    }, [selectedDishId]);

    const selectedDish = dishes.find((dish) => String(dish.id) === String(selectedDishId));

    function openForm(variant = null) {
        setEditing(variant);
        setForm(variant
            ? {
                name: variant.name,
                sku: variant.sku,
                price: variant.price,
                is_active: variant.is_active,
                sort_order: variant.sort_order ?? 0,
            }
            : { ...emptyForm, sku: selectedDish?.sku ? `${selectedDish.sku}-V` : '' });
        setFormErrors({});
        setIsFormOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        if (!selectedDishId) return;
        setBusy(true);
        setFormErrors({});
        try {
            const payload = {
                name: form.name,
                sku: form.sku,
                price: Number(form.price),
                is_active: form.is_active,
                sort_order: Number(form.sort_order),
            };
            const path = editing
                ? `/dishes/${selectedDishId}/variants/${editing.id}`
                : `/dishes/${selectedDishId}/variants`;
            const response = await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(response.message || (editing ? 'Variant updated' : 'Variant created'));
            setIsFormOpen(false);
            setEditing(null);
            setForm(emptyForm);
            await loadVariants(selectedDishId);
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
            const response = await api(`/dishes/${selectedDishId}/variants/${deleting.id}`, { method: 'DELETE' });
            toast.success(response.message || 'Variant deleted');
            setDeleting(null);
            await loadVariants(selectedDishId);
        } catch (caught) {
            toast.error(caught.message);
        } finally {
            setBusy(false);
        }
    }

    const columns = [
        {
            key: 'name',
            label: 'Variant',
            render: (row) => (
                <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-ink/40">{row.sku}</p>
                </div>
            ),
        },
        { key: 'price', label: 'Price', render: (row) => <span className="font-semibold">{currency(row.price)}</span> },
        { key: 'sort_order', label: 'Sort' },
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
                            <Trash2 size={14} /> Remove
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
                title="Variations"
                description="Pick a dish, then manage size or portion variants with their own SKU and price."
                actions={can('menu.create') && selectedDishId && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Variant
                    </button>
                )}
            />

            <div className="mt-7 grid gap-4 rounded-3xl bg-white p-4 soft-shadow lg:grid-cols-[minmax(0,1fr)_280px]">
                <SearchInput
                    value={dishQuery}
                    onChange={setDishQuery}
                    placeholder="Filter dishes…"
                    className="border-0 bg-ink/[.035]"
                />
                <select
                    value={selectedDishId}
                    onChange={(event) => setSelectedDishId(event.target.value)}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                >
                    <option value="">{loadingDishes ? 'Loading dishes…' : 'Select a dish'}</option>
                    {dishes.map((dish) => (
                        <option key={dish.id} value={dish.id}>
                            {dish.name} ({dish.sku})
                        </option>
                    ))}
                </select>
            </div>

            {!selectedDishId ? (
                <div className="mt-6 rounded-3xl border border-dashed border-ink/15 bg-white/60 px-6 py-16 text-center text-sm text-ink/45">
                    Select a dish to view and manage its variants.
                </div>
            ) : (
                <div className="mt-4">
                    <p className="mb-3 text-sm text-ink/50">
                        Variants for <span className="font-semibold text-ink">{selectedDish?.name || `Dish #${selectedDishId}`}</span>
                        {selectedDish?.base_price != null && <> · base {currency(selectedDish.base_price)}</>}
                    </p>
                    <DataTable
                        columns={columns}
                        rows={variants}
                        loading={loadingVariants}
                        emptyMessage="This dish has no variants yet."
                    />
                </div>
            )}

            <FormModal
                open={isFormOpen}
                title={editing ? 'Edit variant' : 'Create variant'}
                description="SKU must be unique across all dish variants."
                onClose={() => { setIsFormOpen(false); setEditing(null); setForm(emptyForm); }}
                onSubmit={submit}
                busy={busy}
                submitLabel={editing ? 'Update variant' : 'Create variant'}
            >
                <div className="grid gap-4">
                    <label className="block text-sm font-medium">
                        Name
                        <input className="field mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Large" />
                        {formErrors.name && <span className="mt-1 block text-xs text-red-600">{formErrors.name[0]}</span>}
                    </label>
                    <label className="block text-sm font-medium">
                        SKU
                        <input className="field mt-2" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} />
                        {formErrors.sku && <span className="mt-1 block text-xs text-red-600">{formErrors.sku[0]}</span>}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block text-sm font-medium">
                            Price
                            <input className="field mt-2" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                            {formErrors.price && <span className="mt-1 block text-xs text-red-600">{formErrors.price[0]}</span>}
                        </label>
                        <label className="block text-sm font-medium">
                            Sort order
                            <input className="field mt-2" type="number" min="0" required value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                        </label>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-herb" />
                        Active
                    </label>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete variant?"
                message={`${deleting?.name || 'This variant'} will be permanently removed. Historical order lines keep their price snapshots.`}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
                busy={busy}
                confirmLabel="Delete"
            />
        </div>
    );
}
