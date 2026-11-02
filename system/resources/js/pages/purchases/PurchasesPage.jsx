import { Eye, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = { inventory_item_id: '', quantity: 1, unit_cost: 0, stock_alert: '' };
const emptyForm = () => ({
    supplier_id: '', purchase_date: today(),
    invoice_reference: '', discount: 0, tax: 0, other_charges: 0, notes: '',
    receive_now: true,
    lines: [{ ...emptyLine }],
});

export default function PurchasesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', status: '', supplier_id: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/purchases', filters);
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(emptyForm);

    // Submitting + receiving need extra permissions; fall back to a plain draft when the user lacks them.
    const canReceive = can('purchases.edit') && can('purchases.approve');

    useEffect(() => {
        api('/suppliers?per_page=100&is_active=1').then((r) => setSuppliers(r.data || [])).catch(() => {});
        api('/inventory/items?per_page=100&is_active=1').then((r) => setItems(r.data || [])).catch(() => {});
    }, []);

    const subtotal = useMemo(
        () => form.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0), 0),
        [form.lines],
    );

    function openCreate() {
        setForm(emptyForm());
        setOpen(true);
    }

    function updateLine(index, patch) {
        setForm((current) => ({
            ...current,
            lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
        }));
    }

    // Writes the "stock alert" number to the ingredient's reorder level (which drives low-stock warnings).
    async function applyStockAlerts() {
        const alerts = new Map();
        form.lines.forEach((line) => {
            if (line.inventory_item_id && line.stock_alert !== '' && line.stock_alert !== null) {
                alerts.set(Number(line.inventory_item_id), Number(line.stock_alert));
            }
        });
        const failures = [];
        for (const [itemId, level] of alerts) {
            try {
                // Fresh copy so we never overwrite costs that the receipt just updated.
                const fresh = (await api(`/inventory/items/${itemId}`)).data;
                await api(`/inventory/items/${itemId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        inventory_category_id: fresh.inventory_category_id,
                        brand_id: fresh.brand_id ?? null,
                        preferred_supplier_id: fresh.preferred_supplier_id ?? null,
                        name: fresh.name,
                        sku: fresh.sku,
                        barcode: fresh.barcode || null,
                        unit: fresh.unit,
                        minimum_stock: fresh.minimum_stock,
                        reorder_level: level,
                        average_cost: fresh.average_cost,
                        latest_purchase_cost: fresh.latest_purchase_cost,
                        is_active: fresh.is_active,
                        notes: fresh.notes || null,
                    }),
                });
            } catch (error) {
                failures.push(`${items.find((i) => i.id === itemId)?.name || `#${itemId}`}: ${error.message}`);
            }
        }
        return failures;
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        let created = null;
        try {
            const response = await api('/purchases', {
                method: 'POST',
                body: JSON.stringify({
                    supplier_id: Number(form.supplier_id),
                    purchase_date: form.purchase_date,
                    invoice_reference: form.invoice_reference || null,
                    discount: Number(form.discount) || 0,
                    tax: Number(form.tax) || 0,
                    other_charges: Number(form.other_charges) || 0,
                    notes: form.notes || null,
                    items: form.lines.map((line) => {
                        const item = items.find((i) => String(i.id) === String(line.inventory_item_id));
                        return {
                            inventory_item_id: Number(line.inventory_item_id),
                            quantity: Number(line.quantity),
                            unit: item?.unit,
                            unit_cost: Number(line.unit_cost),
                        };
                    }),
                }),
            });
            created = response.data;
        } catch (error) {
            toast.error(error.message);
            setBusy(false);
            return;
        }

        const warnings = [];
        let received = false;

        if (form.receive_now && canReceive) {
            try {
                await api(`/purchases/${created.id}/submit`, { method: 'POST', body: '{}' });
                await api(`/purchases/${created.id}/receive`, {
                    method: 'POST',
                    body: JSON.stringify({
                        items: (created.items || []).map((line) => ({ purchase_item_id: line.id, quantity: Number(line.quantity) })),
                    }),
                });
                received = true;
            } catch (error) {
                warnings.push(`Purchase saved but stock was not received (${error.message}). Open it to receive manually.`);
            }
        }

        const alertFailures = await applyStockAlerts();
        if (alertFailures.length) warnings.push(`Stock alert not updated — ${alertFailures.join('; ')}`);

        if (warnings.length) warnings.forEach((message) => toast.warning(message));
        toast.success(received ? 'Purchase saved and stock received' : 'Purchase saved');
        setOpen(false);
        setBusy(false);
        reload();
    }

    return (
        <div>
            <PageHeader
                title="Purchases"
                description="Record stock you buy from suppliers. Stock is updated as soon as a purchase is saved."
                breadcrumbs={['Purchases', 'Orders']}
                actions={can('purchases.create') && (
                    <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> New purchase
                    </button>
                )}
            />

            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="PO # or invoice…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    {['draft', 'ordered', 'partial', 'received', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.supplier_id} onChange={(e) => setFilters((f) => ({ ...f, supplier_id: e.target.value, page: 1 }))}>
                    <option value="">All suppliers</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </ListFilters>

            <DataTable
                loading={loading}
                emptyMessage="No purchases yet."
                rows={rows}
                columns={[
                    { key: 'purchase_number', label: 'PO', render: (row) => <span className="font-semibold">{row.purchase_number}</span> },
                    { key: 'supplier', label: 'Supplier', render: (row) => row.supplier?.name || '—' },
                    { key: 'purchase_date', label: 'Date', render: (row) => row.purchase_date || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'payment_status', label: 'Payment', render: (row) => <StatusBadge status={row.payment_status} /> },
                    { key: 'total', label: 'Total', className: 'text-right', render: (row) => money(row.total) },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <Link to={`/purchases/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                <Eye size={15} /> View
                            </Link>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="New purchase" description="Pick what you bought, how much and the price. Stock updates automatically." onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Save purchase" wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Supplier</span>
                        <select className="field" required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                            <option value="">Select supplier</option>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Date</span><input className="field" type="date" required value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></label>
                </div>

                <div className="mt-5 space-y-3">
                    <div className="hidden gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1.4fr_0.6fr_0.7fr_0.7fr_auto]">
                        <span>Item</span><span>Qty</span><span>Price (per unit)</span><span>Stock alert</span><span className="w-14" />
                    </div>
                    {form.lines.map((line, index) => {
                        const item = items.find((i) => String(i.id) === String(line.inventory_item_id));
                        return (
                            <div key={index} className="grid gap-2 rounded-2xl bg-ink/[.03] p-3 sm:grid-cols-[1.4fr_0.6fr_0.7fr_0.7fr_auto]">
                                <select className="field" required aria-label="Item" value={line.inventory_item_id} onChange={(e) => {
                                    const picked = items.find((i) => String(i.id) === e.target.value);
                                    updateLine(index, {
                                        inventory_item_id: e.target.value,
                                        unit_cost: picked?.latest_purchase_cost || picked?.average_cost || 0,
                                        stock_alert: picked && Number(picked.reorder_level) > 0 ? Number(picked.reorder_level) : '',
                                    });
                                }}>
                                    <option value="">Select item</option>
                                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.unit ? ` (${i.unit})` : ''}</option>)}
                                </select>
                                <input className="field" type="number" min="0.001" step="0.001" required aria-label="Quantity" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} placeholder={item?.unit ? `Qty (${item.unit})` : 'Qty'} />
                                <input className="field" type="number" min="0" step="0.01" required aria-label="Price" value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} placeholder="Price" />
                                <input className="field" type="number" min="0" step="any" aria-label="Stock alert" value={line.stock_alert} onChange={(e) => updateLine(index, { stock_alert: e.target.value })} placeholder="Alert at…" title="Warn me when stock falls to this number" />
                                <button type="button" disabled={form.lines.length === 1} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))} className="text-sm text-coral disabled:opacity-30">Remove</button>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...emptyLine }] }))} className="text-sm font-semibold text-herb">+ Add item</button>
                        <p className="text-sm font-semibold">Total: {money(subtotal)}</p>
                    </div>
                </div>

                {canReceive && (
                    <label className="mt-4 flex items-center gap-3 rounded-[5px] bg-light p-3 text-sm font-medium">
                        <input type="checkbox" className="size-4 accent-primary" checked={form.receive_now} onChange={(e) => setForm({ ...form, receive_now: e.target.checked })} />
                        Add to stock immediately
                    </label>
                )}

                <details className="mt-4 rounded-2xl border border-ink/10 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Advanced (invoice, discount, tax, notes)</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block text-sm sm:col-span-3"><span className="mb-2 block font-medium">Invoice reference</span><input className="field" value={form.invoice_reference} onChange={(e) => setForm({ ...form, invoice_reference: e.target.value })} /></label>
                        <label className="block text-sm"><span className="mb-2 block font-medium">Discount</span><input className="field" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></label>
                        <label className="block text-sm"><span className="mb-2 block font-medium">Tax</span><input className="field" type="number" min="0" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></label>
                        <label className="block text-sm"><span className="mb-2 block font-medium">Other charges</span><input className="field" type="number" min="0" step="0.01" value={form.other_charges} onChange={(e) => setForm({ ...form, other_charges: e.target.value })} /></label>
                        <label className="block text-sm sm:col-span-3"><span className="mb-2 block font-medium">Notes</span><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                    </div>
                </details>
            </FormModal>
        </div>
    );
}
