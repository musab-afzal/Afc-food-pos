import { Printer, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

export default function RecentOrdersDrawer() {
    const { state, patch } = usePos();
    if (!state.recentOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/45" onClick={() => patch({ recentOpen: false })}>
            <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-ink/7 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-semibold">Recent orders</h2>
                        <p className="text-xs text-ink/45">Today’s sales</p>
                    </div>
                    <button type="button" onClick={() => patch({ recentOpen: false })} className="text-ink/35"><X size={20} /></button>
                </div>
                <div className="pos-scroll flex-1 space-y-3 p-4">
                    {state.recentLoading && <p className="py-10 text-center text-sm text-ink/40">Loading…</p>}
                    {!state.recentLoading && !(state.recentSales || []).length && (
                        <p className="py-16 text-center text-sm text-ink/40">No sales today yet.</p>
                    )}
                    {(state.recentSales || []).map((sale) => (
                        <div key={sale.id} className="rounded-2xl border border-ink/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{sale.invoice_number}</p>
                                    <p className="text-xs text-ink/45 capitalize">
                                        {String(sale.order_type || '').replace(/_/g, ' ')} · {sale.sold_at ? new Date(sale.sold_at).toLocaleTimeString() : ''}
                                    </p>
                                    <p className="mt-1 text-xs text-ink/45">
                                        {sale.table?.name || sale.customer?.name || 'Walk-in'} · {sale.cashier?.name || '—'}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold">{money(toCents(sale.grand_total))}</p>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Link to={`/sales/${sale.id}`} className="flex-1 rounded-xl bg-ink/5 py-2 text-center text-sm font-semibold">View</Link>
                                <Link to={`/sales/${sale.id}/receipt`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-ink py-2 text-sm font-semibold text-white">
                                    <Printer size={14} /> Receipt
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
