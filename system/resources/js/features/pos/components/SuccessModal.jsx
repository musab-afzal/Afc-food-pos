import { CheckCircle2, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

export default function SuccessModal() {
    const { state, patch, searchRef } = usePos();
    if (!state.success) return null;
    const sale = state.success;

    function close() {
        patch({ success: null });
        searchRef.current?.focus();
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center soft-shadow">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-herb/10 text-herb">
                    <CheckCircle2 size={28} />
                </span>
                <h2 className="mt-4 text-2xl font-semibold">Order completed</h2>
                <p className="mt-1 text-sm text-ink/45">{sale.invoice}</p>
                <p className="mt-4 text-3xl font-semibold text-herb">{money(toCents(sale.total))}</p>
                {Number(sale.change) > 0 && <p className="mt-1 text-sm text-ink/50">Change {money(toCents(sale.change))}</p>}
                <div className="mt-6 grid gap-2">
                    {sale.saleId && (
                        <Link to={`/sales/${sale.saleId}/receipt`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-semibold text-white">
                            <Printer size={16} /> View / reprint receipt
                        </Link>
                    )}
                    <button type="button" onClick={close} className="rounded-2xl bg-lime py-3 text-sm font-bold text-ink">
                        New order
                    </button>
                </div>
            </div>
        </div>
    );
}
