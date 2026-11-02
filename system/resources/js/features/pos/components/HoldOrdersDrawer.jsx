import { Trash2, X } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';
import { money } from '../utils/cart.js';

export default function HoldOrdersDrawer() {
    const { state, patch, resumeHold, deleteHold } = usePos();
    if (!state.holdsOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/45" onClick={() => patch({ holdsOpen: false })}>
            <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-ink/7 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-semibold">Held orders</h2>
                        <p className="text-xs text-ink/45">{state.holds.length} saved checks</p>
                    </div>
                    <button type="button" onClick={() => patch({ holdsOpen: false })} className="text-ink/35"><X size={20} /></button>
                </div>
                <div className="pos-scroll flex-1 space-y-3 p-4">
                    {state.holds.length ? state.holds.map((hold) => {
                        const items = hold.payload?.items || [];
                        const amount = items.reduce((sum, item) => sum + (item._ui?.unitCents || 0) * item.quantity, 0);
                        return (
                            <div key={hold.id} className="rounded-2xl border border-ink/10 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold capitalize">#{hold.id} · {String(hold.order_type || '').replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-ink/45">
                                            {hold.table?.name || 'No table'} · {items.length} items · {hold.updated_at ? new Date(hold.updated_at).toLocaleString() : ''}
                                        </p>
                                        {amount > 0 && <p className="mt-1 text-sm font-semibold text-herb">{money(amount)}</p>}
                                    </div>
                                    <button type="button" onClick={() => deleteHold(hold.id)} className="text-ink/30 hover:text-red-600"><Trash2 size={16} /></button>
                                </div>
                                <button type="button" onClick={() => resumeHold(hold)} className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white">Resume</button>
                            </div>
                        );
                    }) : (
                        <p className="py-16 text-center text-sm text-ink/40">No held orders</p>
                    )}
                </div>
            </div>
        </div>
    );
}
