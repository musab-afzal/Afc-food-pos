import { ArrowLeft, CheckCircle2, PackageCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function PurchaseDetailPage() {
    const { id } = useParams();
    const { can } = useAuth();
    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [receiveQty, setReceiveQty] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api(`/purchases/${id}`);
            setPurchase(response.data);
            const qty = {};
            (response.data.items || []).forEach((item) => {
                const remaining = Number(item.quantity) - Number(item.quantity_received || 0);
                qty[item.id] = remaining > 0 ? remaining : 0;
            });
            setReceiveQty(qty);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function submitOrder() {
        setBusy(true);
        try {
            await api(`/purchases/${id}/submit`, { method: 'POST', body: '{}' });
            toast.success('Purchase submitted');
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function cancelOrder() {
        if (!window.confirm('Cancel this purchase order?')) return;
        setBusy(true);
        try {
            await api(`/purchases/${id}/cancel`, { method: 'POST', body: '{}' });
            toast.success('Purchase cancelled');
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function receiveStock() {
        const items = Object.entries(receiveQty)
            .map(([purchase_item_id, quantity]) => ({ purchase_item_id: Number(purchase_item_id), quantity: Number(quantity) }))
            .filter((row) => row.quantity > 0);
        if (!items.length) {
            toast.error('Enter quantities to receive');
            return;
        }
        setBusy(true);
        try {
            await api(`/purchases/${id}/receive`, { method: 'POST', body: JSON.stringify({ items }) });
            toast.success('Stock received into inventory');
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-white soft-shadow" />;
    if (!purchase) return <div className="rounded-3xl bg-white p-12 text-center text-sm text-ink/45 soft-shadow">Purchase not found.</div>;

    const canReceive = ['ordered', 'partial'].includes(purchase.status) && can('purchases.approve');

    return (
        <div>
            <PageHeader
                title={purchase.purchase_number}
                description={`${purchase.supplier?.name || 'Supplier'} · ${purchase.purchase_date || ''}`}
                breadcrumbs={['Purchases', purchase.purchase_number]}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/purchases" className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <ArrowLeft size={16} /> Back
                        </Link>
                        {purchase.status === 'draft' && can('purchases.edit') && (
                            <button type="button" disabled={busy} onClick={submitOrder} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                                <CheckCircle2 size={16} /> Submit
                            </button>
                        )}
                        {['draft', 'ordered'].includes(purchase.status) && can('purchases.edit') && (
                            <button type="button" disabled={busy} onClick={cancelOrder} className="flex items-center gap-2 rounded-xl bg-coral/15 px-4 py-2.5 text-sm font-semibold text-coral disabled:opacity-40">
                                <XCircle size={16} /> Cancel
                            </button>
                        )}
                        {canReceive && (
                            <button type="button" disabled={busy} onClick={receiveStock} className="flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">
                                <PackageCheck size={16} /> Receive stock
                            </button>
                        )}
                    </div>
                )}
            />

            <div className="mb-4 flex gap-2">
                <StatusBadge status={purchase.status} />
                <StatusBadge status={purchase.payment_status} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                <section className="rounded-3xl bg-white p-6 soft-shadow">
                    <h2 className="text-lg font-semibold">Line items</h2>
                    <div className="mt-4 divide-y divide-ink/8">
                        {(purchase.items || []).map((item) => {
                            const remaining = Number(item.quantity) - Number(item.quantity_received || 0);
                            return (
                                <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                                    <div>
                                        <p className="font-semibold">{item.inventory_item?.name || `Item #${item.inventory_item_id}`}</p>
                                        <p className="text-xs text-ink/45">
                                            Ordered {item.quantity} {item.unit} · Received {item.quantity_received || 0} · Remaining {remaining}
                                        </p>
                                        <p className="mt-1 text-sm">{money(item.unit_cost)} / {item.unit}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{money(item.total)}</p>
                                        {canReceive && remaining > 0 && (
                                            <label className="mt-2 block text-xs text-ink/45">
                                                Receive
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={remaining}
                                                    step="0.001"
                                                    value={receiveQty[item.id] ?? 0}
                                                    onChange={(e) => setReceiveQty((q) => ({ ...q, [item.id]: e.target.value }))}
                                                    className="mt-1 w-28 rounded-lg border border-ink/10 px-2 py-1.5 text-sm"
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 space-y-2 border-t border-ink/8 pt-4 text-sm">
                        <div className="flex justify-between text-ink/50"><span>Subtotal</span><span>{money(purchase.subtotal)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Discount</span><span>-{money(purchase.discount)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Tax</span><span>{money(purchase.tax)}</span></div>
                        <div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span>{money(purchase.total)}</span></div>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 soft-shadow">
                    <h2 className="text-lg font-semibold">Details</h2>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4"><dt className="text-ink/45">Supplier</dt><dd className="font-medium">{purchase.supplier?.name}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-ink/45">Created by</dt><dd className="font-medium">{purchase.user?.name || '—'}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-ink/45">Invoice ref</dt><dd className="font-medium">{purchase.invoice_reference || '—'}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-ink/45">Remaining payable</dt><dd className="font-medium">{money(purchase.remaining)}</dd></div>
                        {purchase.notes && <div><dt className="text-ink/45">Notes</dt><dd className="mt-1 font-medium">{purchase.notes}</dd></div>}
                    </dl>
                </section>
            </div>
        </div>
    );
}
