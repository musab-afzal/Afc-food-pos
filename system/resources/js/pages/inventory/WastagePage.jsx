import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDate } from '../../utils/format.js';

const reasons = ['Expired', 'Spoiled', 'Kitchen Waste', 'Overcooked', 'Damaged', 'Contamination', 'Other'];

export default function WastagePage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/inventory/wastages', filters);
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        reason: 'Kitchen Waste',
        wastage_date: new Date().toISOString().slice(0, 10),
        notes: '',
        items: [{ inventory_item_id: '', quantity: '', unit: '', unit_cost: 0 }],
    });

    useEffect(() => {
        api('/inventory/items?per_page=100&is_active=1').then((r) => setItems(r.data || [])).catch(() => {});
    }, []);

    function updateLine(index, key, value) {
        setForm((current) => {
            const lines = [...current.items];
            lines[index] = { ...lines[index], [key]: value };
            if (key === 'inventory_item_id') {
                const item = items.find((row) => String(row.id) === String(value));
                lines[index].unit = item?.unit || '';
                lines[index].unit_cost = item?.average_cost || 0;
            }
            return { ...current, items: lines };
        });
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/inventory/wastages', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    items: form.items.map((line) => ({
                        inventory_item_id: Number(line.inventory_item_id),
                        quantity: Number(line.quantity),
                        unit: line.unit,
                        unit_cost: Number(line.unit_cost || 0),
                    })),
                }),
            });
            toast.success('Wastage recorded');
            setOpen(false);
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
                title="Wastage"
                description="Track food waste with automatic stock reduction."
                breadcrumbs={['Inventory', 'Wastage']}
                actions={can('inventory.wastage') && (
                    <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Record wastage
                    </button>
                )}
            />
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No wastage recorded."
                columns={[
                    { key: 'wastage_number', label: 'Number' },
                    { key: 'wastage_date', label: 'Date', render: (row) => formatDate(row.wastage_date) },
                    { key: 'reason', label: 'Reason' },
                    { key: 'total_cost', label: 'Cost', render: (row) => currency(row.total_cost) },
                    { key: 'user', label: 'By', render: (row) => row.user?.name || '—' },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title="Record wastage" onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Reason</span>
                        <select className="field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                            {reasons.map((reason) => <option key={reason}>{reason}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Date</span>
                        <input className="field" type="date" required value={form.wastage_date} onChange={(e) => setForm({ ...form, wastage_date: e.target.value })} />
                    </label>
                </div>
                <div className="mt-5 space-y-3">
                    {form.items.map((line, index) => (
                        <div key={index} className="grid gap-3 rounded-2xl border border-ink/8 p-3 sm:grid-cols-[1.4fr_1fr_auto]">
                            <select className="field" required value={line.inventory_item_id} onChange={(e) => updateLine(index, 'inventory_item_id', e.target.value)}>
                                <option value="">Ingredient</option>
                                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            <input className="field" type="number" min="0.0001" step="any" required placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} />
                            <button type="button" className="rounded-xl px-3 text-coral hover:bg-coral/5" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))} disabled={form.items.length === 1}><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button type="button" className="text-sm font-medium text-herb" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { inventory_item_id: '', quantity: '', unit: '', unit_cost: 0 }] }))}>+ Add line</button>
                </div>
                <label className="mt-4 block text-sm"><span className="mb-2 block font-medium">Notes</span><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            </FormModal>
        </div>
    );
}
