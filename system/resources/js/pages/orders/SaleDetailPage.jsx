import { ArrowLeft, Printer, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function SaleDetailPage() {
    const { id } = useParams();
    const { can } = useAuth();
    const [sale, setSale] = useState(null);
    const [refunds, setRefunds] = useState([]);
    const [refundable, setRefundable] = useState(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState('');
    const [restoreInventory, setRestoreInventory] = useState(true);
    const [qty, setQty] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api(`/sales/${id}`);
            setSale(response.data);
            if (can('pos.refund') || can('orders.update')) {
                const [list, info] = await Promise.all([
                    api(`/sales/${id}/refunds`),
                    api(`/sales/${id}/refundable`).catch(() => ({ data: null })),
                ]);
                setRefunds(list.data || []);
                setRefundable(info.data);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [id, can]);

    useEffect(() => { load(); }, [load]);

    function openRefund() {
        const lines = {};
        (refundable?.items || sale?.items || []).forEach((item) => {
            const remaining = item.refundable_quantity ?? item.remaining_quantity ?? item.quantity;
            lines[item.sale_item_id || item.id] = remaining > 0 ? remaining : 0;
        });
        setQty(lines);
        setReason('');
        setRestoreInventory(true);
        setOpen(true);
    }

    async function submitRefund(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const items = Object.entries(qty)
                .filter(([, quantity]) => Number(quantity) > 0)
                .map(([sale_item_id, quantity]) => ({ sale_item_id: Number(sale_item_id), quantity: Number(quantity) }));
            if (!items.length) {
                toast.error('Select at least one item to refund');
                return;
            }
            await api(`/sales/${id}/refunds`, {
                method: 'POST',
                body: JSON.stringify({
                    sale_id: Number(id),
                    reason,
                    restore_inventory: restoreInventory,
                    items,
                }),
            });
            toast.success('Refund recorded');
            setOpen(false);
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <div className="h-64 animate-pulse card-panel" />;
    if (!sale) return <div className="rounded-3xl bg-white p-12 text-center text-sm text-ink/45 soft-shadow">Sale not found.</div>;

    const remainingTotal = refundable?.remaining_total ?? refundable?.refundable_total;

    return (
        <div>
            <PageHeader
                title={sale.invoice_number}
                description={`Sale #${sale.id}${sale.was_offline ? ' · synced from offline' : ''}`}
                breadcrumbs={['Orders', 'Sales', sale.invoice_number]}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/sales" className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <ArrowLeft size={16} /> Back
                        </Link>
                        <Link to={`/sales/${sale.id}/receipt`} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <Printer size={16} /> Receipt
                        </Link>
                        {can('pos.refund') && Number(remainingTotal ?? 1) > 0 && (
                            <button type="button" onClick={openRefund} className="flex items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white">
                                <RotateCcw size={16} /> Refund
                            </button>
                        )}
                    </div>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-2">
                <StatusBadge status={sale.status} />
                <StatusBadge status={sale.order_type} />
                {remainingTotal != null && <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium">Refundable {money(remainingTotal)}</span>}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <section className="card-panel p-6">
                    <h2 className="text-lg font-semibold">Line items</h2>
                    <div className="mt-4 divide-y divide-ink/8">
                        {(sale.items || []).map((item) => (
                            <div key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                                <div>
                                    <p className="font-semibold">{item.quantity} × {item.dish_name}</p>
                                    <p className="text-xs text-ink/45">{item.variant_name || item.sku || '—'}</p>
                                </div>
                                <p className="font-semibold">{money(item.total)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 space-y-2 border-t border-ink/8 pt-4 text-sm">
                        <div className="flex justify-between text-ink/50"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Tax</span><span>{money(sale.tax_total)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Paid</span><span>{money(sale.paid_total)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Change</span><span>{money(sale.change_total)}</span></div>
                        <div className="flex justify-between pt-2 text-lg font-semibold"><span>Grand total</span><span>{money(sale.grand_total)}</span></div>
                    </div>
                </section>

                <section className="card-panel p-6">
                    <h2 className="text-lg font-semibold">Meta</h2>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between"><dt className="text-ink/45">Cashier</dt><dd className="font-medium">{sale.cashier?.name || '—'}</dd></div>
                        <div className="flex justify-between"><dt className="text-ink/45">Customer</dt><dd className="font-medium">{sale.customer?.name || 'Walk-in'}</dd></div>
                        <div className="flex justify-between"><dt className="text-ink/45">Table</dt><dd className="font-medium">{sale.table?.name || sale.restaurant_table?.name || '—'}</dd></div>
                        <div className="flex justify-between"><dt className="text-ink/45">Sold at</dt><dd className="font-medium">{sale.sold_at ? new Date(sale.sold_at).toLocaleString() : '—'}</dd></div>
                        {sale.order_id && (
                            <div className="flex justify-between">
                                <dt className="text-ink/45">Order</dt>
                                <dd><Link className="font-semibold text-herb" to={`/orders/${sale.order_id}`}>View order</Link></dd>
                            </div>
                        )}
                    </dl>
                    <h3 className="mt-6 font-semibold">Payments</h3>
                    <div className="mt-3 space-y-2">
                        {(sale.payments || []).map((payment) => (
                            <div key={payment.id} className="flex justify-between rounded-xl bg-ink/[.035] px-3 py-2.5 text-sm">
                                <span>{payment.method?.name || 'Payment'}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                                <span className="font-semibold">{money(payment.amount)}</span>
                            </div>
                        ))}
                    </div>

                    <h3 className="mt-6 font-semibold">Refunds</h3>
                    <div className="mt-3 space-y-2">
                        {refunds.length ? refunds.map((refund) => (
                            <div key={refund.id} className="rounded-xl bg-coral/10 px-3 py-2.5 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="font-semibold">{refund.refund_number}</span>
                                    <span className="font-semibold text-coral">{money(refund.amount)}</span>
                                </div>
                                <p className="mt-1 text-xs text-ink/50">{refund.reason}</p>
                            </div>
                        )) : <p className="text-sm text-ink/40">No refunds yet.</p>}
                    </div>
                </section>
            </div>

            <FormModal open={open} title="Issue refund" description="Partial or full refund. Optionally restore recipe stock." onClose={() => setOpen(false)} onSubmit={submitRefund} busy={busy} submitLabel="Confirm refund" wide>
                <div className="grid gap-3">
                    {(refundable?.items || sale.items || []).map((item) => {
                        const key = item.sale_item_id || item.id;
                        const max = item.refundable_quantity ?? item.remaining_quantity ?? item.quantity;
                        if (Number(max) <= 0) return null;
                        return (
                            <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-ink/[.035] px-3 py-2.5 text-sm">
                                <div>
                                    <p className="font-semibold">{item.dish_name || item.name}</p>
                                    <p className="text-xs text-ink/45">Max {max}</p>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    max={max}
                                    className="field w-24"
                                    value={qty[key] ?? 0}
                                    onChange={(e) => setQty((current) => ({ ...current, [key]: e.target.value }))}
                                />
                            </div>
                        );
                    })}
                    <label className="text-sm font-medium">Reason
                        <textarea required className="field mt-1 min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={restoreInventory} onChange={(e) => setRestoreInventory(e.target.checked)} />
                        Restore inventory from recipes
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
