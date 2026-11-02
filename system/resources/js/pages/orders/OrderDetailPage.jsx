import { ArrowLeft, Ban, CheckCircle2, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { canCancelOrder, isOrderPaid } from '../../utils/format.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

const nextStatuses = {
    draft: ['pending', 'confirmed', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['served', 'out_for_delivery', 'completed'],
    served: ['completed'],
    out_for_delivery: ['completed'],
    completed: ['refunded', 'partially_refunded'],
    cancelled: [],
    refunded: [],
    partially_refunded: ['refunded'],
};

export default function OrderDetailPage() {
    const { id } = useParams();
    const { can } = useAuth();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api(`/orders/${id}`);
            setOrder(response.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function changeStatus(status) {
        setBusy(true);
        try {
            await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
            toast.success(`Status → ${status.replace(/_/g, ' ')}`);
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function cancelOrder() {
        const prompt = isOrderPaid(order)
            ? 'This order is paid. Cancel it and refund the customer? Ingredients will be returned to stock.'
            : 'Cancel this order?';
        if (!window.confirm(prompt)) return;
        setBusy(true);
        try {
            await api(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Cancelled from orders screen' }) });
            toast.success('Order cancelled');
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <div className="h-64 animate-pulse card-panel" />;
    }

    if (!order) {
        return <div className="rounded-3xl bg-white p-12 text-center text-sm text-ink/45 soft-shadow">Order not found.</div>;
    }

    const allowed = nextStatuses[order.status] || [];
    const saleId = order.sale?.id;

    return (
        <div>
            <PageHeader
                title={order.order_number}
                description={`${String(order.order_type || '').replace(/_/g, ' ')} · ${order.source || 'pos'}`}
                breadcrumbs={['Orders', order.order_number]}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/orders" className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <ArrowLeft size={16} /> Back
                        </Link>
                        {saleId && (
                            <Link to={`/sales/${saleId}/receipt`} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                                <Printer size={16} /> Receipt
                            </Link>
                        )}
                        {can('orders.cancel') && canCancelOrder(order) && (
                            <button type="button" disabled={busy} onClick={cancelOrder} className="flex items-center gap-2 rounded-xl bg-coral/15 px-4 py-2.5 text-sm font-semibold text-coral disabled:opacity-40">
                                <Ban size={16} /> Cancel
                            </button>
                        )}
                    </div>
                )}
            />

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <StatusBadge status={order.status} />
                <StatusBadge status={order.payment_status || (order.sale ? 'paid' : 'unpaid')} />
                {can('orders.update') && allowed.map((status) => (
                    <button
                        key={status}
                        type="button"
                        disabled={busy}
                        onClick={() => changeStatus(status)}
                        className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold capitalize text-white disabled:opacity-40"
                    >
                        <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} /> {status.replace(/_/g, ' ')}</span>
                    </button>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <section className="card-panel p-6">
                    <h2 className="text-lg font-semibold">Items</h2>
                    <div className="mt-4 divide-y divide-ink/8">
                        {(order.items || []).map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <p className="font-semibold">{item.quantity} × {item.dish_name}</p>
                                    <p className="text-xs text-ink/45">
                                        {[item.variant_name, ...(item.addons || []).map((a) => a.name)].filter(Boolean).join(' · ') || 'Standard'}
                                    </p>
                                    {item.notes && <p className="mt-1 text-xs text-ink/50">Note: {item.notes}</p>}
                                    <div className="mt-2"><StatusBadge status={item.kitchen_status || 'pending'} label={`Kitchen: ${item.kitchen_status || 'pending'}`} /></div>
                                </div>
                                <p className="font-semibold">{money(item.total)}</p>
                            </div>
                        ))}
                        {!order.items?.length && <p className="py-8 text-center text-sm text-ink/40">No items</p>}
                    </div>
                    <div className="mt-4 space-y-2 border-t border-ink/8 pt-4 text-sm">
                        <div className="flex justify-between text-ink/50"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Discount</span><span>-{money(order.discount_total)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Tax</span><span>{money(order.tax_total)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Service</span><span>{money(order.service_charge)}</span></div>
                        <div className="flex justify-between text-ink/50"><span>Delivery</span><span>{money(order.delivery_charge)}</span></div>
                        <div className="flex justify-between pt-2 text-lg font-semibold"><span>Grand total</span><span>{money(order.grand_total)}</span></div>
                    </div>
                </section>

                <div className="space-y-4">
                    <section className="card-panel p-6">
                        <h2 className="text-lg font-semibold">Details</h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between gap-4"><dt className="text-ink/45">Customer</dt><dd className="font-medium">{order.customer?.name || 'Walk-in'}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-ink/45">Table</dt><dd className="font-medium">{order.table?.name || order.restaurant_table?.name || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-ink/45">Created by</dt><dd className="font-medium">{order.creator?.name || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-ink/45">Ordered</dt><dd className="font-medium">{order.ordered_at ? new Date(order.ordered_at).toLocaleString() : '—'}</dd></div>
                            {order.notes && <div><dt className="text-ink/45">Notes</dt><dd className="mt-1 font-medium">{order.notes}</dd></div>}
                        </dl>
                    </section>

                    <section className="card-panel p-6">
                        <h2 className="text-lg font-semibold">Payments</h2>
                        {(order.sale?.payments || []).length ? (
                            <div className="mt-4 space-y-2">
                                {order.sale.payments.map((payment) => (
                                    <div key={payment.id} className="flex justify-between rounded-xl bg-ink/[.035] px-3 py-2.5 text-sm">
                                        <span>{payment.method?.name || 'Payment'}</span>
                                        <span className="font-semibold">{money(payment.amount)}</span>
                                    </div>
                                ))}
                                <p className="pt-2 text-xs text-ink/45">Invoice {order.sale.invoice_number}</p>
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-ink/45">No payments recorded yet.</p>
                        )}
                    </section>

                    <section className="card-panel p-6">
                        <h2 className="text-lg font-semibold">Status timeline</h2>
                        <ol className="mt-4 space-y-3">
                            {(order.status_history || order.statusHistory || []).map((entry) => (
                                <li key={entry.id} className="border-l-2 border-lime pl-3 text-sm">
                                    <p className="font-semibold capitalize">{String(entry.to_status || '').replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-ink/45">
                                        {entry.user?.name || 'System'} · {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                                    </p>
                                    {entry.notes && <p className="mt-1 text-xs text-ink/50">{entry.notes}</p>}
                                </li>
                            ))}
                            {!(order.status_history || order.statusHistory || []).length && (
                                <p className="text-sm text-ink/45">No status changes logged yet.</p>
                            )}
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}
