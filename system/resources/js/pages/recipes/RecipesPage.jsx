import { Edit3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { currency } from '../../utils/format.js';

export default function RecipesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/recipes', filters);
    const [dishes, setDishes] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        dish_id: '',
        dish_variant_id: '',
        name: '',
        items: [{ inventory_item_id: '', quantity: '', unit: '', wastage_percent: 0 }],
    });

    useEffect(() => {
        Promise.all([
            api('/dishes?per_page=100&is_active=1'),
            api('/inventory/items?per_page=100&is_active=1'),
        ]).then(([dishRes, itemRes]) => {
            setDishes(dishRes.data || []);
            setIngredients(itemRes.data || []);
        }).catch((error) => toast.error(error.message));
    }, []);

    const selectedDish = dishes.find((dish) => String(dish.id) === String(form.dish_id));

    function openForm(recipe = null) {
        setEditing(recipe);
        setForm(recipe ? {
            dish_id: recipe.dish_id,
            dish_variant_id: recipe.dish_variant_id || '',
            name: recipe.name || '',
            items: (recipe.items || []).map((item) => ({
                inventory_item_id: item.inventory_item_id,
                quantity: item.quantity,
                unit: item.unit,
                wastage_percent: item.wastage_percent || 0,
            })),
        } : {
            dish_id: '',
            dish_variant_id: '',
            name: '',
            items: [{ inventory_item_id: '', quantity: '', unit: '', wastage_percent: 0 }],
        });
        setOpen(true);
    }

    function updateLine(index, key, value) {
        setForm((current) => {
            const lines = [...current.items];
            lines[index] = { ...lines[index], [key]: value };
            if (key === 'inventory_item_id') {
                const item = ingredients.find((row) => String(row.id) === String(value));
                lines[index].unit = item?.unit || '';
            }
            return { ...current, items: lines };
        });
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const payload = {
                dish_id: Number(form.dish_id),
                dish_variant_id: form.dish_variant_id ? Number(form.dish_variant_id) : null,
                name: form.name || null,
                items: form.items.map((line) => ({
                    inventory_item_id: Number(line.inventory_item_id),
                    quantity: Number(line.quantity),
                    unit: line.unit,
                    wastage_percent: Number(line.wastage_percent || 0),
                })),
            };
            await api(editing ? `/recipes/${editing.id}` : '/recipes', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(editing ? 'Recipe updated' : 'Recipe created');
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
            await api(`/recipes/${deleting.id}`, { method: 'DELETE' });
            toast.success('Recipe removed');
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
                title="Recipe Mapping"
                description="Map dishes to ingredient consumption for automatic stock deduction."
                breadcrumbs={['Recipes', 'Mapping']}
                actions={can('recipes.manage') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add recipe
                    </button>
                )}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search dishes…" />
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No recipes mapped yet."
                columns={[
                    { key: 'dish', label: 'Dish', render: (row) => row.dish?.name || '—' },
                    { key: 'variant', label: 'Variant', render: (row) => row.variant?.name || 'Standard' },
                    { key: 'items_count', label: 'Ingredients', render: (row) => row.items?.length ?? row.items_count ?? 0 },
                    { key: 'recipe_cost', label: 'Recipe cost', render: (row) => currency(row.recipe_cost || 0) },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('recipes.manage') && (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-2 text-coral hover:bg-coral/5"><Trash2 size={16} /></button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit recipe' : 'Add recipe'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Dish</span>
                        <select className="field" required value={form.dish_id} onChange={(e) => setForm({ ...form, dish_id: e.target.value, dish_variant_id: '' })}>
                            <option value="">Select dish</option>
                            {dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Variant (optional)</span>
                        <select className="field" value={form.dish_variant_id} onChange={(e) => setForm({ ...form, dish_variant_id: e.target.value })}>
                            <option value="">Standard</option>
                            {(selectedDish?.variants || []).map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Recipe name</span>
                        <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Optional label" />
                    </label>
                </div>
                <div className="mt-5 space-y-3">
                    <p className="text-sm font-semibold">Ingredients</p>
                    {form.items.map((line, index) => (
                        <div key={index} className="grid gap-3 rounded-2xl border border-ink/8 p-3 md:grid-cols-[1.5fr_.8fr_.7fr_.7fr_auto]">
                            <select className="field" required value={line.inventory_item_id} onChange={(e) => updateLine(index, 'inventory_item_id', e.target.value)}>
                                <option value="">Ingredient</option>
                                {ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            <input className="field" type="number" min="0.0001" step="any" required placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} />
                            <input className="field" required placeholder="Unit" value={line.unit} onChange={(e) => updateLine(index, 'unit', e.target.value)} />
                            <input className="field" type="number" min="0" step="any" placeholder="Waste %" value={line.wastage_percent} onChange={(e) => updateLine(index, 'wastage_percent', e.target.value)} />
                            <button type="button" className="rounded-xl px-3 text-coral hover:bg-coral/5" disabled={form.items.length === 1} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button type="button" className="text-sm font-medium text-herb" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { inventory_item_id: '', quantity: '', unit: '', wastage_percent: 0 }] }))}>+ Add ingredient</button>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Remove recipe?" message="This only removes the mapping. Stock history stays intact." confirmLabel="Remove" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
