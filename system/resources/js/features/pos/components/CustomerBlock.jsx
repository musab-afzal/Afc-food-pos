import { UserRound, X } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';

export default function CustomerBlock({ compact = false }) {
    const { state, patch } = usePos();
    const displayValue = state.selectedCustomer
        ? `${state.selectedCustomer.name}${state.selectedCustomer.phone ? ` · ${state.selectedCustomer.phone}` : ''}`
        : state.customerQuery;

    return (
        <div className={compact ? 'afc-pos-customer-search' : 'relative mt-2'}>
            <div className={compact ? 'afc-pos-search afc-pos-customer-search-field' : 'flex gap-1.5'}>
                {compact && <UserRound size={22} aria-hidden="true" />}
                <input
                    value={displayValue}
                    onChange={(e) => patch({ selectedCustomer: null, customerId: '', customerQuery: e.target.value, loyaltyPoints: 0 })}
                    placeholder={state.catalog?.settings?.require_customer ? 'Customer required…' : 'Search customer…'}
                    aria-label="Search customers"
                    className={compact ? undefined : 'w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-herb/40'}
                />
                {state.selectedCustomer ? (
                    <button
                        type="button"
                        onClick={() => patch({ selectedCustomer: null, customerId: '', customerQuery: '', loyaltyPoints: 0 })}
                        className={compact ? 'afc-pos-customer-clear' : 'grid size-10 place-items-center rounded-xl bg-ink/5'}
                        title="Clear customer"
                    >
                        <X size={15} />
                    </button>
                ) : null}
            </div>
            {!compact && state.orderType === 'delivery' && state.selectedCustomer?.address && (
                <p className="mt-1 line-clamp-2 text-[11px] text-ink/45">{state.selectedCustomer.address}</p>
            )}
            {state.customerHits.length > 0 && !state.selectedCustomer && (
                <div className={`absolute z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-lg ${compact ? 'left-0 right-0 w-full min-w-[260px]' : 'w-full'}`}>
                    {state.customerHits.map((customer) => (
                        <button
                            key={customer.id}
                            type="button"
                            onClick={() => patch({
                                selectedCustomer: customer,
                                customerId: String(customer.id),
                                customerQuery: '',
                                customerHits: [],
                            })}
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-ink/[.04]"
                        >
                            <span className="font-semibold">{customer.name}</span>
                            <span className="ml-2 text-xs text-ink/45">{customer.phone || ''} · {customer.loyalty_points || 0} pts</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
