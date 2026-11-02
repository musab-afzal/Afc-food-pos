import { UserPlus, X } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';

export default function CustomerBlock() {
    const { state, patch, can } = usePos();

    return (
        <div className="relative mt-2">
            <div className="flex gap-1.5">
                <input
                    value={state.selectedCustomer
                        ? `${state.selectedCustomer.name}${state.selectedCustomer.phone ? ` · ${state.selectedCustomer.phone}` : ''}`
                        : state.customerQuery}
                    onChange={(e) => patch({ selectedCustomer: null, customerId: '', customerQuery: e.target.value, loyaltyPoints: 0 })}
                    placeholder={state.catalog?.settings?.require_customer ? 'Customer required…' : 'Customer (optional)'}
                    className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-herb/40"
                />
                {state.selectedCustomer ? (
                    <button type="button" onClick={() => patch({ selectedCustomer: null, customerId: '', customerQuery: '', loyaltyPoints: 0 })} className="grid size-10 place-items-center rounded-xl bg-ink/5" title="Clear customer">
                        <X size={15} />
                    </button>
                ) : can('customers.create') ? (
                    <button type="button" onClick={() => patch({ customerModalOpen: true })} className="grid size-10 place-items-center rounded-xl bg-ink/5" title="Quick add customer">
                        <UserPlus size={15} />
                    </button>
                ) : null}
            </div>
            {state.orderType === 'delivery' && state.selectedCustomer?.address && (
                <p className="mt-1 line-clamp-2 text-[11px] text-ink/45">{state.selectedCustomer.address}</p>
            )}
            {state.customerHits.length > 0 && !state.selectedCustomer && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-lg">
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
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/[.04]"
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
