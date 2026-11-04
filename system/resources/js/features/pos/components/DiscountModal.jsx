import { X } from 'lucide-react';
import { useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

export default function DiscountModal() {
    const { state, patch, totals, applyCoupon, notify } = usePos();
    const [mode, setMode] = useState('fixed');
    const [value, setValue] = useState(String(state.discountTotal || ''));
    if (!state.discountOpen) return null;

    const maxPercent = Number(state.catalog?.settings?.cashier_max_discount || 0);
    const subtotal = totals.subtotal / 100;

    function apply() {
        let amount = Number(value) || 0;
        if (mode === 'percent') {
            if (maxPercent > 0 && amount > maxPercent) {
                notify(`Max discount allowed is ${maxPercent}%`, 'error');
                return;
            }
            amount = (subtotal * amount) / 100;
        } else if (maxPercent > 0) {
            const percent = subtotal > 0 ? (amount / subtotal) * 100 : 0;
            if (percent > maxPercent) {
                notify(`Max discount allowed is ${maxPercent}%`, 'error');
                return;
            }
        }
        patch({ discountTotal: Number(amount.toFixed(2)), discountOpen: false });
        notify(`Discount ${money(toCents(amount))} applied`, 'success');
    }

    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-4" onClick={() => patch({ discountOpen: false })}>
            <div className="w-full max-w-md card-panel p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Discount</h2>
                    <button type="button" onClick={() => patch({ discountOpen: false })} className="text-ink/35"><X size={18} /></button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
                    {['fixed', 'percent'].map((item) => (
                        <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg py-2 text-sm font-semibold capitalize ${mode === item ? 'bg-white shadow-sm' : 'text-ink/45'}`}>
                            {item === 'fixed' ? 'Fixed amount' : 'Percentage'}
                        </button>
                    ))}
                </div>

                <label className="mt-4 block text-xs text-ink/45">
                    {mode === 'percent' ? 'Percent' : 'Amount'}
                    <input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" />
                </label>
                {maxPercent > 0 && <p className="mt-1 text-[11px] text-ink/40">Cashier max: {maxPercent}%</p>}

                <div className="mt-4 rounded-xl bg-ink/5 p-3 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                </div>

                <button type="button" onClick={apply} className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-white">Apply discount</button>

                <div className="mt-5 border-t border-ink/10 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Coupon</p>
                    <div className="mt-2 flex gap-2">
                        <input
                            value={state.couponCode}
                            onChange={(e) => patch({ couponCode: e.target.value.toUpperCase(), couponDiscount: 0 })}
                            placeholder="CODE"
                            className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm uppercase"
                        />
                        <button type="button" onClick={applyCoupon} className="rounded-xl bg-ink/5 px-3 text-sm font-semibold">Apply</button>
                    </div>
                    {state.couponDiscount > 0 && (
                        <div className="mt-2 flex items-center justify-between text-sm text-herb">
                            <span>{state.couponCode} applied</span>
                            <button type="button" onClick={() => patch({ couponCode: '', couponDiscount: 0 })} className="text-xs text-ink/45">Remove</button>
                        </div>
                    )}
                </div>

                {state.selectedCustomer && state.catalog?.loyalty?.enabled && (
                    <label className="mt-4 block text-xs text-ink/45">
                        Loyalty points (balance {state.selectedCustomer.loyalty_points || 0})
                        <input
                            type="number"
                            min="0"
                            max={state.selectedCustomer.loyalty_points || 0}
                            value={state.loyaltyPoints}
                            onChange={(e) => patch({ loyaltyPoints: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
