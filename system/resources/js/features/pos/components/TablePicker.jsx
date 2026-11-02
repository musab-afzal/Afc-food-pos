import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { orderDraftKey } from '../utils/orderDrafts.js';

const statusStyle = {
    available: 'border-herb/30 bg-herb/8 text-herb',
    occupied: 'border-coral/30 bg-coral/10 text-coral',
    reserved: 'border-amber-500/30 bg-amber-50 text-amber-700',
    cleaning: 'border-ink/15 bg-ink/5 text-ink/50',
};

export default function TablePicker() {
    const { state, patch, notify } = usePos();
    const [q, setQ] = useState('');
    const tables = useMemo(() => {
        const list = state.catalog?.tables || [];
        const query = q.trim().toLowerCase();
        return list.filter((t) => !query || `${t.name} ${t.table_number || ''} ${t.area?.name || ''}`.toLowerCase().includes(query));
    }, [state.catalog, q]);

    if (!state.tablePickerOpen) return null;

    function selectTable(table) {
        const savedCart = state.orderDrafts[orderDraftKey('dine_in', table.id)]?.cart || [];
        if (table.status && table.status !== 'available' && String(table.id) !== String(state.tableId) && !savedCart.length) {
            notify(`Table ${table.name} is ${table.status}. Only available tables can start a new POS sale.`, 'error');
            return;
        }
        patch({ tableId: String(table.id), tablePickerOpen: false });
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => patch({ tablePickerOpen: false })}>
            <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden card-panel" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-ink/7 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-semibold">Select table</h2>
                        <p className="text-xs text-ink/45">Available tables can start a new dine-in sale.</p>
                    </div>
                    <button type="button" onClick={() => patch({ tablePickerOpen: false })} className="text-ink/35"><X size={20} /></button>
                </div>
                <div className="border-b border-ink/7 px-5 py-3">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table or area…" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm outline-none focus:border-herb/40" />
                </div>
                <div className="pos-scroll grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 md:grid-cols-4">
                    {tables.map((table) => {
                        const selected = String(table.id) === String(state.tableId);
                        const tone = statusStyle[table.status] || statusStyle.cleaning;
                        const draft = selected ? state.cart : state.orderDrafts[orderDraftKey('dine_in', table.id)]?.cart || [];
                        const itemCount = draft.reduce((sum, item) => sum + item.quantity, 0);
                        return (
                            <button
                                key={table.id}
                                type="button"
                                disabled={state.paying || state.holding}
                                onClick={() => selectTable(table)}
                                className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-ink bg-ink text-white' : 'border-ink/10 hover:border-ink/25'}`}
                            >
                                <p className="font-semibold">{table.name}</p>
                                {itemCount > 0 && <p className={`mt-1 text-xs font-semibold ${selected ? 'text-white' : 'text-[#00958e]'}`}>{itemCount} saved {itemCount === 1 ? 'item' : 'items'}</p>}
                                <p className={`mt-1 text-[11px] ${selected ? 'text-white/55' : 'text-ink/45'}`}>
                                    {table.area?.name || 'Floor'} · {table.capacity} seats
                                </p>
                                <span className={`mt-3 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${selected ? 'bg-white/15 text-white' : tone}`}>
                                    {table.status || 'available'}
                                </span>
                            </button>
                        );
                    })}
                    {!tables.length && <p className="col-span-full py-10 text-center text-sm text-ink/40">No tables found.</p>}
                </div>
            </div>
        </div>
    );
}
