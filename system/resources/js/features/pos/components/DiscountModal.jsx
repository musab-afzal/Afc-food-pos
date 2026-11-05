import { X } from 'lucide-react';
import { useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

const MAX_DISCOUNT_PERCENT = 100;

export default function DiscountModal() {
    const { state, patch, totals, applyCoupon, notify } = usePos();
    const [mode, setMode] = useState('fixed');
    const [value, setValue] = useState(String(state.discountTotal || ''));
    const [error, setError] = useState('');
    if (!state.discountOpen) return null;

    const subtotal = totals.subtotal / 100;

    function apply() {
        setError('');
        let amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0) {
            setError('Enter a valid discount amount.');
            return;
        }

        if (mode === 'percent') {
            if (amount > MAX_DISCOUNT_PERCENT) {
                setError('Discount cannot be more than 100%.');
                return;
            }
            amount = (subtotal * amount) / 100;
        } else if (subtotal > 0 && amount > subtotal) {
            setError('Discount cannot be more than 100% of the total.');
            return;
        }

        amount = Math.max(0, Number(amount.toFixed(2)));
        patch({ discountTotal: amount, discountOpen: false });
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
                        <button
                            key={item}
                            type="button"
                            onClick={() => { setMode(item); setError(''); }}
                            className={`rounded-lg py-2 text-sm font-semibold capitalize ${mode === item ? 'bg-white shadow-sm' : 'text-ink/45'}`}
                        >
                            {item === 'fixed' ? 'Fixed amount' : 'Percentage'}
                        </button>
                    ))}
                </div>

                <label className="mt-4 block text-xs text-ink/45">
                    {mode === 'percent' ? 'Percent (max 100%)' : 'Amount (max order total)'}
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => { setValue(e.target.value); setError(''); }}
                        className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                    />
                </label>
                <p className="mt-1 text-[11px] text-ink/40">You can give up to 100% discount.</p>
                {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

                <div className="mt-4 rounded-xl bg-ink/5 p-3 text-sm">
                    <div className="flex justify-between"><span>Total</span><span>{money(totals.subtotal)}</span></div>
                    {Number(value) > 0 && (
                        <div className="mt-1 flex justify-between text-ink/60">
                            <span>After discount</span>
                            <span>
                                {money(toCents(Math.max(
                                    0,
                                    subtotal - (mode === 'percent'
                                        ? Math.min(Number(value) || 0, MAX_DISCOUNT_PERCENT) * subtotal / 100
                                        : Math.min(Number(value) || 0, subtotal)),
                                )))}
                            </span>
                        </div>
                    )}
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
