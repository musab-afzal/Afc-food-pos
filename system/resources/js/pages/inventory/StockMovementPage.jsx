import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { api } from '../../services/api.js';

export default function StockMovementPage({ type = 'stock_in' }) {
    const isIn = type === 'stock_in';
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ inventory_item_id: '', quantity: '', unit_cost: '', notes: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/inventory/items?per_page=100&is_active=1')
            .then((response) => setItems(response.data || []))
            .catch((error) => toast.error(error.message));
    }, []);

    const selected = items.find((item) => String(item.id) === String(form.inventory_item_id));

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const endpoint = isIn ? '/inventory/stock-in' : '/inventory/stock-out';
            const payload = {
                inventory_item_id: Number(form.inventory_item_id),
                quantity: Number(form.quantity),
                notes: form.notes || null,
            };
            if (isIn && form.unit_cost !== '') payload.unit_cost = Number(form.unit_cost);
            const response = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
            toast.success(response.message || (isIn ? 'Stock received' : 'Stock issued'));
            setForm({ inventory_item_id: '', quantity: '', unit_cost: '', notes: '' });
            const refresh = await api('/inventory/items?per_page=100&is_active=1');
            setItems(refresh.data || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl">
            <PageHeader
                title={isIn ? 'Stock In' : 'Stock Out'}
                description={isIn ? 'Receive inventory into stock with an auditable movement.' : 'Issue inventory out of stock with a recorded reason.'}
                breadcrumbs={['Inventory', isIn ? 'Stock In' : 'Stock Out']}
            />
            <form onSubmit={submit} className="card-panel p-6">
                <div className="space-y-4">
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Ingredient</span>
                        <select className="field" required value={form.inventory_item_id} onChange={(e) => setForm({ ...form, inventory_item_id: e.target.value, unit_cost: items.find((i) => String(i.id) === e.target.value)?.average_cost || '' })}>
                            <option value="">Select ingredient</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>{item.name} · {Number(item.current_stock)} {item.unit}</option>
                            ))}
                        </select>
                    </label>
                    {selected && (
                        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink/60">
                            Current stock: <strong className="text-ink">{Number(selected.current_stock)} {selected.unit}</strong>
                        </p>
                    )}
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Quantity</span>
                        <input className="field" type="number" min="0.0001" step="any" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </label>
                    {isIn && (
                        <label className="block text-sm">
                            <span className="mb-2 block font-medium">Unit cost (optional)</span>
                            <input className="field" type="number" min="0" step="any" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                        </label>
                    )}
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Notes</span>
                        <textarea className="field min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </label>
                </div>
                <button disabled={busy} className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? 'Saving…' : isIn ? 'Receive stock' : 'Issue stock'}
                </button>
            </form>
        </div>
    );
}
