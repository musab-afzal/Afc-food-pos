import { Edit3, ImagePlus, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { mediaUrl } from '../utils/media.js';

function dishImageSrc(dish) {
    return mediaUrl(dish?.image_url || dish?.image || '');
}

const defaults = { category_id: '', brand_id: null, name: '', slug: '', sku: '', barcode: '', description: '', short_description: '', image: '', base_price: '', tax_percent: 0, preparation_minutes: 10, is_active: true, is_available: true, dine_in_enabled: true, takeaway_enabled: true, delivery_enabled: true, qr_enabled: true, pos_enabled: true, kitchen_enabled: true, sort_order: 0, variants: [], auto_minus_items: [] };
const emptyVariant = { id: null, name: '', sku: '', price: '' };
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const currency = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function DishesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', category_id: '', is_active: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const { rows, meta, loading, error, reload } = usePaginatedResource('/dishes', filters);
    const [categories, setCategories] = useState([]);
    const [autoMinusOptions, setAutoMinusOptions] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(defaults);
    const [formErrors, setFormErrors] = useState({});
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [removedVariantIds, setRemovedVariantIds] = useState([]);
    const [variantsLoading, setVariantsLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [pickAutoMinusId, setPickAutoMinusId] = useState('');

    useEffect(() => {
        api('/categories?per_page=100&is_active=1').then((response) => setCategories(response.data));
        api('/inventory/items?auto_minus=1&is_active=1&per_page=100')
            .then((response) => setAutoMinusOptions(response.data || []))
            .catch(() => setAutoMinusOptions([]));
    }, []);
    function openForm(dish = null) {
        setEditing(dish); setRemovedVariantIds([]); setPickAutoMinusId('');
        const linked = (dish?.auto_minus_items || []).map((item) => ({
            inventory_item_id: String(item.inventory_item_id || item.id),
            name: item.name || '',
            unit: item.unit || '',
            quantity: item.quantity ?? 1,
        }));
        setForm(dish ? {
            ...defaults,
            ...dish,
            category_id: dish.category_id,
            brand_id: dish.brand_id || null,
            description: dish.description || '',
            short_description: dish.short_description || '',
            image: dish.image || '',
            barcode: dish.barcode || '',
            variants: [],
            auto_minus_items: linked,
        } : defaults);
        setImagePreview(dishImageSrc(dish));
        setFormErrors({}); setIsFormOpen(true);
        if (dish) {
            setVariantsLoading(true);
            api(`/dishes/${dish.id}/variants`)
                .then((response) => setForm((current) => ({
                    ...current,
                    variants: (response.data || []).map((variant) => ({ id: variant.id, name: variant.name, sku: variant.sku, price: variant.price })),
                })))
                .catch(() => {})
                .finally(() => setVariantsLoading(false));
        }
    }
    function addAutoMinusItem() {
        if (!pickAutoMinusId) return;
        if (form.auto_minus_items.some((row) => String(row.inventory_item_id) === String(pickAutoMinusId))) {
            setPickAutoMinusId('');
            return;
        }
        const option = autoMinusOptions.find((row) => String(row.id) === String(pickAutoMinusId));
        if (!option) return;
        setForm((current) => ({
            ...current,
            auto_minus_items: [
                ...current.auto_minus_items,
                { inventory_item_id: String(option.id), name: option.name, unit: option.unit, quantity: 1 },
            ],
        }));
        setPickAutoMinusId('');
    }
    function updateAutoMinusQty(index, quantity) {
        setForm((current) => ({
            ...current,
            auto_minus_items: current.auto_minus_items.map((row, i) => (i === index ? { ...row, quantity } : row)),
        }));
    }
    function removeAutoMinusItem(index) {
        setForm((current) => ({
            ...current,
            auto_minus_items: current.auto_minus_items.filter((_, i) => i !== index),
        }));
    }
    function addVariant() { setForm((current) => ({ ...current, variants: [...current.variants, { ...emptyVariant }] })); }
    function updateVariant(index, patch) {
        setForm((current) => ({ ...current, variants: current.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)) }));
    }
    function removeVariant(index) {
        const variant = form.variants[index];
        if (variant?.id) setRemovedVariantIds((ids) => [...ids, variant.id]);
        setForm((current) => ({ ...current, variants: current.variants.filter((_, i) => i !== index) }));
    }
    // Saves variations after the dish itself was saved. Returns a list of per-variant failure messages.
    async function syncVariants(dishId, dishSku) {
        const failures = [];
        const rows = form.variants.filter((variant) => variant.name.trim() !== '');
        for (const [index, variant] of rows.entries()) {
            const sku = (variant.sku || '').trim() || `${dishSku || 'VAR'}-${slugify(variant.name).toUpperCase() || index + 1}`;
            const payload = JSON.stringify({
                name: variant.name.trim(),
                sku: sku.toUpperCase(),
                price: Number(variant.price === '' ? form.base_price : variant.price) || 0,
                is_active: true,
                sort_order: index,
            });
            try {
                if (variant.id) await api(`/dishes/${dishId}/variants/${variant.id}`, { method: 'PUT', body: payload });
                else await api(`/dishes/${dishId}/variants`, { method: 'POST', body: payload });
            } catch (caught) { failures.push(`${variant.name}: ${caught.message}`); }
        }
        for (const variantId of removedVariantIds) {
            try { await api(`/dishes/${dishId}/variants/${variantId}`, { method: 'DELETE' }); }
            catch (caught) { failures.push(`Remove variation: ${caught.message}`); }
        }
        return failures;
    }
    async function uploadImage(file) {
        if (!file) return;
        setUploadingImage(true); setFormErrors((current) => ({ ...current, image: undefined }));
        try {
            const body = new FormData();
            body.append('image', file);
            const response = await api('/dishes/upload-image', { method: 'POST', body });
            const path = response.data?.path || '';
            const url = mediaUrl(response.data?.url || path);
            setForm((current) => ({ ...current, image: path }));
            setImagePreview(url);
        } catch (caught) {
            setFormErrors((current) => ({ ...current, image: [caught.message] }));
        } finally {
            setUploadingImage(false);
        }
    }

    function clearImage() {
        setForm((current) => ({ ...current, image: '' }));
        setImagePreview('');
    }

    async function submit(event) {
        event.preventDefault(); setBusy(true); setFormErrors({});
        try {
            const { variants: _variants, auto_minus_items: autoMinusRows, ...dishFields } = form;
            const response = await api(editing ? `/dishes/${editing.id}` : '/dishes', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...dishFields,
                    category_id: Number(form.category_id),
                    brand_id: form.brand_id || null,
                    base_price: Number(form.base_price),
                    tax_percent: Number(form.tax_percent),
                    preparation_minutes: Number(form.preparation_minutes),
                    sort_order: Number(form.sort_order),
                    barcode: form.barcode || null,
                    image: form.image || null,
                    auto_minus_items: (autoMinusRows || []).map((row) => ({
                        inventory_item_id: Number(row.inventory_item_id),
                        quantity: Number(row.quantity) || 1,
                    })),
                }),
            });
            const dishId = response.data?.id ?? editing?.id;
            const failures = dishId && (form.variants.length || removedVariantIds.length) ? await syncVariants(dishId, form.sku) : [];
            setNotice(failures.length ? `${response.message} Some variations were not saved — ${failures.join('; ')}` : response.message);
            setIsFormOpen(false); setEditing(null); setRemovedVariantIds([]); setImagePreview(''); await reload();
        } catch (caught) { setFormErrors(caught.errors || { general: [caught.message] }); }
        finally { setBusy(false); }
    }
    async function deleteDish() {
        setBusy(true);
        try {
            const response = await api(`/dishes/${deleting.id}`, { method: 'DELETE' });
            setNotice(response.message);
            setDeleting(null);
            await reload();
        } catch (caught) {
            setNotice(caught.message);
        } finally {
            setBusy(false);
        }
    }
    const columns = [
        {
            key: 'name',
            label: 'Dish',
            render: (row) => {
                const src = dishImageSrc(row);
                return (
                    <div className="flex items-center gap-3">
                        {src ? (
                            <img src={src} alt="" className="size-10 rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                        ) : (
                            <span className="grid size-10 place-items-center rounded-xl bg-[#edf2e8] text-herb"><UtensilsCrossed size={18} /></span>
                        )}
                        <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">{row.sku}</p></div>
                    </div>
                );
            },
        },
        { key: 'category', label: 'Category', render: (row) => row.category?.name || '—' },
        { key: 'base_price', label: 'Price', render: (row) => <span className="font-semibold">{currency(row.base_price)}</span> },
        { key: 'availability', label: 'Availability', render: (row) => <StatusBadge active={row.is_available} activeLabel="Available" inactiveLabel="Unavailable" /> },
        { key: 'is_active', label: 'Status', render: (row) => <StatusBadge active={row.is_active} /> },
        {
            key: 'actions',
            label: 'Actions',
            className: 'text-right',
            render: (row) => (
                <div className="flex justify-end gap-1">
                    {can('menu.edit') && (
                        <button type="button" onClick={() => openForm(row)} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-heading hover:bg-light" title="Edit dish">
                            <Edit3 size={14} /> Edit
                        </button>
                    )}
                    {can('menu.delete') && (
                        <button type="button" onClick={() => setDeleting(row)} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5" title="Delete dish">
                            <Trash2 size={14} /> Delete
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
                title="Dishes"
                description="Manage items sold at POS, QR menus and kitchen displays."
                actions={can('menu.create') && (
                    <button type="button" onClick={() => openForm()} className="btn-primary">
                        <Plus size={18} /> Add Dish
                    </button>
                )}
            />
            {notice && <button type="button" onClick={() => setNotice('')} className="mb-4 w-full rounded-[5px] bg-primary-soft px-4 py-3 text-left text-sm font-medium text-heading">{notice}</button>}
            {error && <p className="mb-4 rounded-[5px] bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Search name, SKU or barcode…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select value={filters.category_id} onChange={(event) => setFilters((f) => ({ ...f, category_id: event.target.value, page: 1 }))} className="field max-w-xs">
                    <option value="">All categories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <select value={filters.is_active} onChange={(event) => setFilters((f) => ({ ...f, is_active: event.target.value, page: 1 }))} className="field max-w-xs">
                    <option value="">All statuses</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                </select>
            </ListFilters>
            <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No dishes match these filters." />
            <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
            <FormModal open={isFormOpen} title={editing ? 'Edit dish' : 'Add dish'} description="Configure selling channels, availability and pricing." onClose={() => { setIsFormOpen(false); setImagePreview(''); }} onSubmit={submit} busy={busy || uploadingImage} submitLabel={editing ? 'Update dish' : 'Create dish'} wide>
                <div className="grid gap-5">
                    <div className="rounded-[5px] border border-dashed border-ink/15 bg-light p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Dish image</p>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="grid size-24 place-items-center overflow-hidden rounded-2xl bg-white text-herb shadow-sm">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="" className="size-full object-cover" />
                                ) : (
                                    <UtensilsCrossed size={28} />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <label className="btn-primary inline-flex cursor-pointer items-center gap-2">
                                    <ImagePlus size={16} />
                                    {uploadingImage ? 'Uploading…' : (imagePreview ? 'Change image' : 'Upload image')}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        className="hidden"
                                        disabled={uploadingImage || busy}
                                        onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            event.target.value = '';
                                            uploadImage(file);
                                        }}
                                    />
                                </label>
                                {imagePreview && (
                                    <button type="button" onClick={clearImage} className="ml-2 inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5">
                                        <X size={14} /> Remove
                                    </button>
                                )}
                                <p className="text-xs text-muted">JPG, PNG, WEBP or GIF · max 5 MB. Shown on POS and menus.</p>
                                {formErrors.image && <span className="block text-xs text-coral">{formErrors.image[0]}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Dish name" error={formErrors.name} value={form.name} onChange={(value) => setForm({ ...form, name: value, slug: editing ? form.slug : slugify(value) })} />
                        <Field label="Slug" error={formErrors.slug} value={form.slug} onChange={(value) => setForm({ ...form, slug: slugify(value) })} />
                        <Field label="SKU" error={formErrors.sku} value={form.sku} onChange={(value) => setForm({ ...form, sku: value.toUpperCase() })} />
                        <Field label="Barcode" error={formErrors.barcode} value={form.barcode} onChange={(value) => setForm({ ...form, barcode: value })} />
                        <label className="text-sm font-medium">
                            Category
                            <select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className="field mt-2">
                                <option value="">Select category</option>
                                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                            </select>
                            {formErrors.category_id && <span className="mt-1 block text-xs text-coral">{formErrors.category_id[0]}</span>}
                        </label>
                        <Field label="Selling price" type="number" step="0.01" error={formErrors.base_price} value={form.base_price} onChange={(value) => setForm({ ...form, base_price: value })} />
                        <Field label="Tax %" type="number" step="0.01" error={formErrors.tax_percent} value={form.tax_percent} onChange={(value) => setForm({ ...form, tax_percent: value })} />
                        <Field label="Prep minutes" type="number" error={formErrors.preparation_minutes} value={form.preparation_minutes} onChange={(value) => setForm({ ...form, preparation_minutes: value })} />
                    </div>
                    <label className="text-sm font-medium">
                        Short description
                        <textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} rows="2" className="field mt-2" />
                    </label>
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Sales channels & visibility</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {[['is_active', 'Active'], ['is_available', 'Available'], ['pos_enabled', 'POS'], ['qr_enabled', 'QR menu'], ['kitchen_enabled', 'Kitchen'], ['dine_in_enabled', 'Dine-in'], ['takeaway_enabled', 'Takeaway'], ['delivery_enabled', 'Delivery']].map(([key, label]) => (
                                <label key={key} className="flex items-center gap-3 rounded-[5px] bg-light p-3 text-sm font-medium">
                                    <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="size-4 accent-primary" />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[5px] border border-herb/25 bg-herb/5 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-herb">Auto minus stock</p>
                        <p className="mb-3 text-xs text-muted">Link stock items that should deduct when this dish is sold on POS (e.g. 1 bottle).</p>
                        <div className="mb-3 flex flex-wrap gap-2">
                            <select className="field min-w-[220px] flex-1 bg-white" value={pickAutoMinusId} onChange={(event) => setPickAutoMinusId(event.target.value)}>
                                <option value="">Select auto-minus stock item…</option>
                                {autoMinusOptions
                                    .filter((option) => !form.auto_minus_items.some((row) => String(row.inventory_item_id) === String(option.id)))
                                    .map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name} ({option.unit}) · stock {Number(option.current_stock)}
                                        </option>
                                    ))}
                            </select>
                            <button type="button" onClick={addAutoMinusItem} disabled={!pickAutoMinusId} className="inline-flex items-center gap-1 rounded-[5px] bg-white px-3 py-2 text-xs font-bold text-primary shadow-sm hover:bg-primary-soft disabled:opacity-40">
                                <Plus size={14} /> Link item
                            </button>
                        </div>
                        {!autoMinusOptions.length && (
                            <p className="mb-2 rounded-[5px] border border-dashed border-ink/15 bg-white p-3 text-xs text-muted">
                                Dropdown is empty until you mark a stock item with <strong>Auto minus on POS sale</strong> under Inventory → Stock / Ingredients.
                            </p>
                        )}
                        {!form.auto_minus_items.length ? (
                            <p className="rounded-[5px] bg-white/70 p-3 text-xs text-muted">No items linked yet for this dish.</p>
                        ) : (
                            <div className="space-y-2">
                                {form.auto_minus_items.map((row, index) => (
                                    <div key={row.inventory_item_id} className="grid gap-2 rounded-[5px] bg-white p-3 sm:grid-cols-[1.5fr_0.7fr_auto]">
                                        <div>
                                            <p className="text-sm font-semibold">{row.name || `Item #${row.inventory_item_id}`}</p>
                                            <p className="text-xs text-muted">{row.unit || 'unit'} deducted per sale</p>
                                        </div>
                                        <label className="text-xs font-medium">
                                            Qty per sale
                                            <input
                                                className="field mt-1"
                                                type="number"
                                                min="0.0001"
                                                step="any"
                                                value={row.quantity}
                                                onChange={(event) => updateAutoMinusQty(index, event.target.value)}
                                            />
                                        </label>
                                        <button type="button" onClick={() => removeAutoMinusItem(index)} className="inline-flex items-center justify-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5">
                                            <Trash2 size={14} /> Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {formErrors.auto_minus_items && <span className="mt-2 block text-xs text-coral">{formErrors.auto_minus_items[0]}</span>}
                    </div>
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Variations <span className="font-normal normal-case tracking-normal">(optional — e.g. Small / Large)</span></p>
                            <button type="button" onClick={addVariant} className="inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary-soft">
                                <Plus size={14} /> Add variation
                            </button>
                        </div>
                        {variantsLoading && <p className="text-xs text-muted">Loading variations…</p>}
                        {!variantsLoading && !form.variants.length && <p className="rounded-[5px] bg-light p-3 text-xs text-muted">No variations. The selling price above is used as the default.</p>}
                        <div className="space-y-2">
                            {form.variants.map((variant, index) => (
                                <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-[5px] bg-light p-3 sm:grid-cols-[1.4fr_1fr_0.8fr_auto]">
                                    <input className="field" placeholder="Name (e.g. Large)" value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} />
                                    <input className="field" placeholder="SKU (auto if empty)" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value.toUpperCase() })} />
                                    <input className="field" type="number" min="0" step="0.01" placeholder={`Price (${form.base_price || 'base'})`} value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} />
                                    <button type="button" onClick={() => removeVariant(index)} className="inline-flex items-center justify-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-bold text-coral hover:bg-coral/5">
                                        <Trash2 size={14} /> Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    {formErrors.general && <p className="text-sm text-coral">{formErrors.general[0]}</p>}
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Delete dish?" message={`${deleting?.name || 'This dish'} will be deleted from the menu and POS. Existing sales keep their snapshot data.`} onCancel={() => setDeleting(null)} onConfirm={deleteDish} busy={busy} confirmLabel="Delete" />
        </div>
    );
}

function Field({ label, error, value, onChange, type = 'text', step }) {
    return (
        <label className="text-sm font-medium">
            {label}
            <input
                type={type}
                step={step}
                required={['Dish name', 'Slug', 'SKU', 'Selling price'].includes(label)}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={`field mt-2 ${error ? 'border-coral' : ''}`}
            />
            {error && <span className="mt-1 block text-xs text-coral">{error[0]}</span>}
        </label>
    );
}
