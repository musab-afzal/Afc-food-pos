import { ChevronDown, RefreshCw, ShoppingBag, Table2, Truck, UserRound, Utensils } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';
import CustomerBlock from './CustomerBlock.jsx';

const types = [['dine_in', 'Dine In', Utensils], ['takeaway', 'Takeaway', ShoppingBag], ['delivery', 'Delivery', Truck]];

export default function OrderToolbar() {
    const { state, patch, loadCatalog } = usePos();
    const table = state.catalog?.tables?.find((item) => String(item.id) === String(state.tableId));
    const guests = String(state.orderNotes || '').match(/^Guests: (\d+)$/m)?.[1] || '';
    const notesOpen = Boolean(state.orderDetailsOpen);

    function updateGuests(value) {
        const notes = String(state.orderNotes || '').replace(/^Guests: \d+\n?/m, '').trim();
        const count = Math.min(100, Math.max(1, Number(value) || 1));
        patch({ orderNotes: value ? `Guests: ${count}${notes ? `\n${notes}` : ''}` : notes });
    }

    return (
        <div className="afc-pos-order-tools">
            <div className="afc-pos-order-toolbar">
                <div className="afc-pos-order-types" aria-label="Order type">
                    {types.map(([type, label, Icon]) => (
                        <button
                            type="button"
                            key={type}
                            disabled={state.paying || state.holding}
                            aria-pressed={state.orderType === type}
                            className={state.orderType === type ? 'is-active' : ''}
                            onClick={() => patch({ orderType: type })}
                        >
                            <Icon size={23} strokeWidth={1.7} /><span>{label}</span>
                        </button>
                    ))}
                </div>
                <div className="afc-pos-table-field">
                    <label>Table</label>
                    <button type="button" disabled={state.orderType !== 'dine_in'} onClick={() => patch({ tablePickerOpen: true })}>
                        <Table2 size={19} />
                        <span>{table ? `${table.name}${table.area?.name ? ` · ${table.area.name}` : ''}` : 'Select table'}</span>
                        <ChevronDown size={17} />
                    </button>
                </div>
                <div className="afc-pos-guests-field">
                    <label htmlFor="pos-guests">Guests</label>
                    <div>
                        <UserRound size={18} />
                        <input id="pos-guests" type="number" min="1" max="100" value={guests} placeholder="—" disabled={state.orderType !== 'dine_in'} onChange={(event) => updateGuests(event.target.value)} />
                    </div>
                </div>
                <button type="button" className="afc-pos-more" aria-expanded={notesOpen} onClick={() => patch({ orderDetailsOpen: !state.orderDetailsOpen })}>
                    More <ChevronDown size={17} />
                </button>
            </div>

            <div className="afc-pos-order-details">
                <div>
                    <label className="text-xs font-semibold">
                        Customer{state.catalog?.settings?.require_customer ? ' (required)' : ''}
                    </label>
                    <CustomerBlock />
                </div>
                {notesOpen && (
                    <>
                        <label className="flex flex-col gap-2 text-xs font-semibold">
                            Order notes
                            <textarea
                                rows={2}
                                className="rounded-lg border border-[#dbe3ed] bg-white p-2 text-sm font-normal"
                                value={state.orderNotes}
                                onChange={(event) => patch({ orderNotes: event.target.value })}
                                placeholder="Special requests or kitchen notes"
                            />
                        </label>
                        <button type="button" className="afc-pos-button" onClick={loadCatalog} disabled={state.loading}>
                            <RefreshCw size={15} /> Refresh menu
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
