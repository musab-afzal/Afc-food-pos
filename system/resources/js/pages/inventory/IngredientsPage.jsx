import { Edit3, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

const emptyForm = {
    inventory_category_id: '', name: '', sku: '', barcode: '', unit: 'pc',
    current_stock: 0, minimum_stock: 0, reorder_level: 0, average_cost: 0,
    latest_purchase_cost: 0, is_active: true, notes: '',
};

export default function IngredientsPage({ stockOnly = false, defaultFilter = '' }) {
    const { can } = useAuth();
    const [categories, setCategories] = useState([]);
    const [searchParams] = useSearchParams();
    const urlFilter = ['low', 'out'].includes(searchParams.get('filter')) ? searchParams.get('filter') : null;
    const [filters, setFilters] = useState({
        search: '', inventory_category_id: '', date_from: '', date_to: '', stock_status: urlFilter ?? defaultFilter, page: 1, per_page: 15,
    });

    // Deep links such as /inventory/stock?filter=low (from low-stock notifications) apply even when already on the page.
    useEffect(() => {
        if (urlFilter) setFilters((f) => ({ ...f, stock_status: urlFilter, page: 1 }));
    }, [urlFilter]);
    const { rows, meta, loading, reload } = usePaginatedResource('/inventory/items', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/inventory/categories?per_page=100').then((r) => setCategories(r.data || [])).catch(() => {});
    }, []);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            inventory_category_id: row.inventory_category_id || '',
            name: row.name,
            sku: row.sku,
            barcode: row.barcode || '',
            unit: row.unit,
            current_stock: row.current_stock,
            minimum_stock: row.minimum_stock,
            reorder_level: row.reorder_level,
            average_cost: row.average_cost,
            latest_purchase_cost: row.latest_purchase_cost,
            is_active: row.is_active,
            notes: row.notes || '',
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const payload = { ...form, barcode: form.barcode || null, notes: form.notes || null };
            if (editing) delete payload.current_stock;
            await api(editing ? `/inventory/items/${editing.id}` : '/inventory/items', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(editing ? 'Ingredient updated' : 'Ingredient created');
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
            await api(`/inventory/items/${deleting.id}`, { method: 'DELETE' });
            toast.success('Ingredient archived');
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
                title={stockOnly ? 'Stock' : 'Ingredients'}
                description={stockOnly ? 'Current on-hand quantities and reorder signals.' : 'Raw materials tracked for recipe deduction and purchasing.'}
                breadcrumbs={['Inventory', stockOnly ? 'Stock' : 'Ingredients']}
                actions={!stockOnly && can('inventory.create') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add ingredient
                    </button>
                )}
            />
            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Search name, SKU, barcode…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select className="field max-w-[200px]" value={filters.inventory_category_id} onChange={(e) => setFilters((f) => ({ ...f, inventory_category_id: e.target.value, page: 1 }))}>
                    <option value="">All categories</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="field max-w-[180px]" value={filters.stock_status} onChange={(e) => setFilters((f) => ({ ...f, stock_status: e.target.value, page: 1 }))}>
                    <option value="">All stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                </select>
            </ListFilters>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No ingredients found."
                columns={[
                    { key: 'name', label: 'Ingredient', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">{row.sku}</p></div> },
                    { key: 'category', label: 'Category', render: (row) => row.category?.name || '—' },
                    { key: 'current_stock', label: 'Stock', render: (row) => <span className="font-semibold">{Number(row.current_stock)} {row.unit}</span> },
                    { key: 'reorder_level', label: 'Reorder', render: (row) => Number(row.reorder_level) },
                    { key: 'average_cost', label: 'Avg cost', render: (row) => currency(row.average_cost) },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => {
                            if (Number(row.current_stock) <= 0) return <StatusBadge status="out_of_stock" label="Out" />;
                            if (Number(row.current_stock) <= Number(row.reorder_level)) return <StatusBadge status="pending" label="Low" />;
                            return <StatusBadge status={row.is_active ? 'active' : 'inactive'} />;
                        },
                    },
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
            <FormModal open={open} title={editing ? 'Edit ingredient' : 'Add ingredient'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name"><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="SKU"><input className="field" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
                    <Field label="Category">
                        <select className="field" required value={form.inventory_category_id} onChange={(e) => setForm({ ...form, inventory_category_id: e.target.value })}>
                            <option value="">Select category</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Unit"><input className="field" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
                    <Field label="Barcode"><input className="field" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
                    {!editing && <Field label="Opening stock"><input className="field" type="number" step="any" min="0" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} /></Field>}
                    <Field label="Minimum stock"><input className="field" type="number" step="any" min="0" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} /></Field>
                    <Field label="Reorder level"><input className="field" type="number" step="any" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></Field>
                    <Field label="Average cost"><input className="field" type="number" step="any" min="0" value={form.average_cost} onChange={(e) => setForm({ ...form, average_cost: e.target.value })} /></Field>
                    <Field label="Last purchase cost"><input className="field" type="number" step="any" min="0" value={form.latest_purchase_cost} onChange={(e) => setForm({ ...form, latest_purchase_cost: e.target.value })} /></Field>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Notes</span><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive ingredient?" message="Historical movements stay intact." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block text-sm"><span className="mb-2 block font-medium">{label}</span>{children}</label>;
}
