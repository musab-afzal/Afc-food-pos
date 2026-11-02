import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const emptyItem = { dish_id: '', dish_variant_id: '', quantity: 1 };
const emptyForm = { name: '', description: '', price: '', is_active: true, items: [{ ...emptyItem }] };
const currency = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 2 }).format(Number(value || 0));

function itemLabel(item) {
    const name = item.dish?.name || 'Product';
    return item.variant?.name ? `${name} (${item.variant.name})` : name;
}

function StatusToggle({ active, disabled, onToggle }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            disabled={disabled}
            onClick={onToggle}
            className="inline-flex items-center gap-2 text-xs font-bold disabled:opacity-50"
        >
            <span className={`relative h-5 w-9 rounded-full transition ${active ? 'bg-success' : 'bg-ink/20'}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${active ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            <span className={active ? 'text-success' : 'text-muted'}>{active ? 'Active' : 'Inactive'}</span>
        </button>
    );
}

export default function DealsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/deals', filters);
    const [products, setProducts] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [deleting, setDeleting] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isFormOpen || products.length) return;
        api('/deals/products').then((response) => setProducts(response.data || [])).catch((caught) => toast.error(caught.message));
    }, [isFormOpen, products.length]);

    const productsById = useMemo(() => Object.fromEntries(products.map((p) => [String(p.id), p])), [products]);

    const regularTotal = useMemo(() => form.items.reduce((sum, item) => {
        const dish = productsById[String(item.dish_id)];
        if (!dish) return sum;
        const variant = dish.variants?.find((v) => String(v.id) === String(item.dish_variant_id));
        return sum + Number(variant?.price ?? dish.base_price ?? 0) * Number(item.quantity || 0);
    }, 0), [form.items, productsById]);

    function openForm(deal = null) {
        setEditing(deal);
        setForm(deal
            ? {
                name: deal.name,
                description: deal.description || '',
                price: deal.price,
                is_active: deal.is_active,
                items: deal.items.map((item) => ({
                    dish_id: String(item.dish_id),
                    dish_variant_id: item.dish_variant_id ? String(item.dish_variant_id) : '',
                    quantity: item.quantity,
                })),
            }
            : { ...emptyForm, items: [{ ...emptyItem }] });
        setFormErrors({});
        setIsFormOpen(true);
    }

    function closeForm() {
        setIsFormOpen(false);
        setEditing(null);
        setForm(emptyForm);
    }

    function updateItem(index, changes) {
        setForm((f) => ({ ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...changes } : item)) }));
    }

    function removeItem(index) {
        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setFormErrors({});
        try {
            const payload = {
                name: form.name,
                description: form.description || null,
                price: Number(form.price),
                is_active: form.is_active,
                items: form.items.map((item) => ({
                    dish_id: Number(item.dish_id),
                    dish_variant_id: item.dish_variant_id ? Number(item.dish_variant_id) : null,
                    quantity: Number(item.quantity),
                })),
            };
            const response = await api(editing ? `/deals/${editing.id}` : '/deals', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(response.message || (editing ? 'Deal updated' : 'Deal created'));
            closeForm();
            await reload();
        } catch (caught) {
            setFormErrors(caught.errors || {});
            toast.error(caught.message);
        } finally {
            setBusy(false);
        }
    }

    async function toggle(deal) {
        setTogglingId(deal.id);
        try {
            const response = await api(`/deals/${deal.id}/toggle`, { method: 'PATCH', body: '{}' });
            toast.success(response.message);
            await reload();
        } catch (caught) {
            toast.error(caught.message);
        } finally {
            setTogglingId(null);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            const response = await api(`/deals/${deleting.id}`, { method: 'DELETE' });
            toast.success(response.message || 'Deal deleted');
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
            label: 'Deal',
            render: (row) => (
                <div>
                    <p className="font-semibold">{row.name}</p>
                    {row.description && <p className="max-w-xs truncate text-xs text-muted">{row.description}</p>}
                </div>
            ),
        },
        {
            key: 'items',
            label: 'Products',
            render: (row) => (
                <ul className="space-y-0.5 text-sm">
                    {row.items.map((item) => (
                        <li key={item.id}><span className="font-semibold">{item.quantity} ×</span> {itemLabel(item)}</li>
                    ))}
                </ul>
            ),
        },
        { key: 'regular_price', label: 'Regular', render: (row) => <span className="text-muted line-through">{currency(row.regular_price)}</span> },
        { key: 'price', label: 'Deal price', render: (row) => <span className="font-semibold">{currency(row.price)}</span> },
        {
            key: 'savings',
            label: 'Saves',
            render: (row) => {
                const saving = Number(row.regular_price) - Number(row.price);
                return saving > 0 ? <span className="font-semibold text-success">{currency(saving)}</span> : <span className="text-muted">—</span>;
            },
        },
        {
            key: 'is_active',
            label: 'Status',
            render: (row) => (
                <StatusToggle active={row.is_active} disabled={!can('menu.edit') || togglingId === row.id} onToggle={() => toggle(row)} />
            ),
        },
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
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                </div>
            ),
        },
    ];

    const savings = regularTotal - Number(form.price || 0);

    return (
        <div className="mx-auto max-w-[1450px]">
            <PageHeader
                eyebrow="Menu management"
                title="Deals"
                description="Bundle products together and sell them at one combined price."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Make a Deal
                    </button>
                )}
            />

            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-7 flex flex-wrap gap-3 rounded-3xl bg-white p-3 soft-shadow">
                <SearchInput
                    value={filters.search}
                    onChange={(search) => setFilters({ ...filters, search, page: 1 })}
                    placeholder="Search deals…"
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
                <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No deals yet. Use “Make a Deal” to bundle products." />
                <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            </div>

            <FormModal
                open={isFormOpen}
                title={editing ? 'Edit deal' : 'Make a deal'}
                description="Pick the products in this deal, then set the price customers pay for the whole bundle."
                onClose={closeForm}
                onSubmit={submit}
                busy={busy}
                submitLabel={editing ? 'Update deal' : 'Create deal'}
                wide
            >
                <div className="grid gap-4">
                    <label className="block text-sm font-medium">
                        Deal name
                        <input className="field mt-2" required placeholder="e.g. Family Feast" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        {formErrors.name && <span className="mt-1 block text-xs text-red-600">{formErrors.name[0]}</span>}
                    </label>
                    <label className="block text-sm font-medium">
                        Description <span className="text-muted">(optional)</span>
                        <textarea className="field mt-2" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </label>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium">Products</p>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }))}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-herb"
                            >
                                <Plus size={15} /> Add product
                            </button>
                        </div>
                        <div className="space-y-2">
                            {form.items.map((item, index) => {
                                const dish = productsById[String(item.dish_id)];
                                const variants = dish?.variants || [];
                                const variant = variants.find((v) => String(v.id) === String(item.dish_variant_id));
                                const unit = Number(variant?.price ?? dish?.base_price ?? 0);
                                return (
                                    <div key={index}>
                                        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-light p-2">
                                            <select
                                                required
                                                value={item.dish_id}
                                                onChange={(e) => updateItem(index, { dish_id: e.target.value, dish_variant_id: '' })}
                                                className="field min-w-48 flex-1"
                                            >
                                                <option value="">{products.length ? 'Select product…' : 'Loading products…'}</option>
                                                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            {variants.length > 0 && (
                                                <select
                                                    value={item.dish_variant_id}
                                                    onChange={(e) => updateItem(index, { dish_variant_id: e.target.value })}
                                                    className="field w-36"
                                                >
                                                    <option value="">Standard</option>
                                                    {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                </select>
                                            )}
                                            <input
                                                type="number"
                                                min="1"
                                                max="999"
                                                required
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                                                className="field w-20"
                                                aria-label="Quantity"
                                            />
                                            <span className="w-24 text-right text-sm text-muted">{dish ? currency(unit * Number(item.quantity || 0)) : '—'}</span>
                                            <button
                                                type="button"
                                                disabled={form.items.length === 1}
                                                onClick={() => removeItem(index)}
                                                className="grid size-9 place-items-center rounded-lg text-coral hover:bg-coral/5 disabled:opacity-30"
                                                aria-label="Remove product"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        {formErrors[`items.${index}.dish_variant_id`] && (
                                            <span className="mt-1 block text-xs text-red-600">{formErrors[`items.${index}.dish_variant_id`][0]}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {formErrors.items && <span className="mt-1 block text-xs text-red-600">{formErrors.items[0]}</span>}
                    </div>

                    <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
                        <div>
                            <p className="text-xs text-muted">Regular price</p>
                            <p className="mt-1 text-lg font-semibold text-muted line-through">{currency(regularTotal)}</p>
                        </div>
                        <label className="block text-sm font-medium">
                            Deal price
                            <input className="field mt-1" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                            {formErrors.price && <span className="mt-1 block text-xs text-red-600">{formErrors.price[0]}</span>}
                        </label>
                        <div>
                            <p className="text-xs text-muted">Customer saves</p>
                            <p className={`mt-1 text-lg font-semibold ${savings > 0 ? 'text-success' : 'text-muted'}`}>
                                {form.price === '' ? '—' : currency(Math.max(0, savings))}
                            </p>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-herb" />
                        Active
                    </label>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete deal?"
                message={`${deleting?.name || 'This deal'} will be removed permanently. To hide it for now, switch it to inactive instead.`}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
                busy={busy}
                confirmLabel="Delete"
            />
        </div>
    );
}
