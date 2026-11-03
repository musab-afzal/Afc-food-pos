import { Banknote, ChevronRight, CreditCard, GitFork, Map as MapIcon, Minus, Pause, Plus, Printer, QrCode, ShoppingBag, Tag, Trash2, Utensils, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePos } from '../context/PosContext.jsx';
import { cartItemLabel, money } from '../utils/cart.js';

function paymentIcon(method) {
    const name = `${method.code} ${method.name}`.toLowerCase();
    if (name.includes('cash')) return Banknote;
    if (name.includes('qr')) return QrCode;
    if (name.includes('wallet') || name.includes('jazz') || name.includes('easypaisa')) return Wallet;
    return CreditCard;
}

export default function CartPanel() {
    const { state, patch, totals, can, changeQuantity, removeItem, editItem, openPayment, holdOrder, clearCart } = usePos();
    const allowDiscounts = state.catalog?.settings?.allow_discounts !== false;
    const methods = (state.catalog?.payment_methods || []).filter((method) => state.online || method.works_offline);
    const selectedMethod = methods.find((method) => Number(method.id) === Number(state.selectedPaymentMethod)) || methods.find((method) => method.code === 'cash') || methods[0];
    const discount = totals.discountCents + totals.loyaltyDiscountCents;
    const selectedTable = state.catalog?.tables?.find((table) => String(table.id) === String(state.tableId));

    function newOrder() {
        if (state.cart.length) patch({ clearConfirm: true });
        else clearCart();
    }

    return (
        <aside className="afc-pos-checkout" aria-label="Current order and checkout">
            <div className="afc-pos-checkout-top">
                <button type="button" onClick={newOrder} className="afc-pos-button afc-pos-button-primary"><Plus size={23} /> New Order</button>
                {can('tables.view') ? <Link to="/tables/floor" className="afc-pos-button"><MapIcon size={24} /> View Floor Plan</Link> : <button type="button" className="afc-pos-button" onClick={() => patch({ orderType: 'dine_in', tablePickerOpen: true })}><MapIcon size={24} /> View Tables</button>}
            </div>
            <section className="afc-pos-order">
                <header className="afc-pos-order-heading"><div><h2>Current Order</h2>{state.orderType === 'dine_in' && <p className="afc-pos-table-cart-label">{selectedTable?.name || 'Select a table to start'}</p>}</div><button type="button" disabled={!state.cart.length || state.holding || state.paying} onClick={() => patch({ clearConfirm: true })}><Trash2 size={17} /> Clear All</button></header>
                <div className="afc-pos-cart-items pos-scroll">
                    {state.cart.length ? state.cart.map((item) => (
                        <article key={item.key} className="afc-pos-cart-item">
                            <button type="button" className="afc-pos-cart-image" onClick={() => editItem(item)} aria-label={`Customize ${item.dish.name}`}>
                                <Utensils size={24} aria-hidden="true" />
                                {(item.dish.image_url || item.dish.image) && <img src={item.dish.image_url || item.dish.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                            </button>
                            <div className="afc-pos-cart-item-content">
                                <div className="afc-pos-cart-item-title"><button type="button" onClick={() => editItem(item)}>{cartItemLabel(item)}</button><strong>{money(item.unitCents * item.quantity)}</strong></div>
                                <p className="afc-pos-cart-variant">{item.isDeal
                                    ? `Deal · ${(item.deal.components || []).map((c) => `${c.quantity}× ${c.dish_name}${c.variant_name ? ` (${c.variant_name})` : ''}`).join(', ')}`
                                    : (item.addons || []).length
                                        ? (item.addons || []).map((addon) => addon.name).join(' · ')
                                        : (item.variant ? money(item.unitCents) : 'Regular')}</p>
                                {item.notes && <p className="afc-pos-cart-variant">{item.notes}</p>}
                                <div className="afc-pos-cart-controls"><div className="afc-pos-quantity"><button type="button" aria-label={`Decrease ${item.dish.name} quantity`} onClick={() => changeQuantity(item.key, -1)}><Minus size={16} /></button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.dish.name} quantity`} onClick={() => changeQuantity(item.key, 1)}><Plus size={16} /></button></div><button type="button" className="afc-pos-remove" aria-label={`Remove ${item.dish.name}`} onClick={() => removeItem(item.key)}><Trash2 size={17} /></button></div>
                            </div>
                        </article>
                    )) : <div className="afc-pos-empty"><span className="afc-pos-empty-cart"><ShoppingBag size={32} strokeWidth={1.5} /></span><strong>Your order starts here</strong><p>Add something delicious from the menu.</p></div>}
                </div>
                <div className="afc-pos-order-summary">
                    <dl className="afc-pos-totals"><div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>Tax</dt><dd>{money(totals.tax)}</dd></div>
                        {totals.serviceCharge > 0 && <div><dt>Service</dt><dd>{money(totals.serviceCharge)}</dd></div>}
                        {totals.deliveryCharge > 0 && <div><dt>Delivery</dt><dd>{money(totals.deliveryCharge)}</dd></div>}
                        {(allowDiscounts || discount > 0) && <div><dt className="flex items-center gap-2"><Tag size={19} className="text-[#ff7b19]" /> Discount</dt><dd>{discount > 0 ? <button type="button" disabled={!allowDiscounts} onClick={() => patch({ discountOpen: true })} className="afc-pos-discount">−{money(discount)}</button> : <button type="button" onClick={() => patch({ discountOpen: true })} className="afc-pos-discount">Apply Discount</button>}</dd></div>}
                    </dl>
                    <div className="afc-pos-grand-total"><span>Grand Total</span><strong>{money(totals.total)}</strong></div>
                    <div className="afc-pos-payment-methods" aria-label="Payment method">
                        {methods.map((method) => { const Icon = paymentIcon(method); return <button type="button" key={method.id} aria-pressed={method.id === selectedMethod?.id} className={method.id === selectedMethod?.id ? 'is-active' : ''} onClick={() => patch({ selectedPaymentMethod: method.id })}><Icon size={20} /><span>{method.name}</span></button>; })}
                        {!methods.length && <p className="col-span-full text-xs text-red-600">No payment methods available{state.online ? '' : ' offline'}.</p>}
                    </div>
                    <div className="afc-pos-cart-actions">
                        {can('pos.hold_order') && <button type="button" disabled={!state.cart.length || state.paying} onClick={() => holdOrder()}><Pause size={19} /> Hold Order</button>}
                        <button type="button" disabled={!state.cart.length || state.paying || !methods.length} onClick={() => openPayment()}><Printer size={19} /> Print Bill</button>
                        <button type="button" disabled={!state.cart.length || state.paying || !methods.length} onClick={() => openPayment({ split: true })}><GitFork size={19} /> Split Bill</button>
                    </div>
                    <button type="button" className="afc-pos-pay" disabled={!state.cart.length || state.paying || !methods.length} onClick={() => openPayment()}><CreditCard size={28} /><span>Pay Now</span><strong>{money(totals.total)}</strong><ChevronRight size={23} /></button>
                </div>
            </section>
            {state.clearConfirm && <div className="fixed inset-0 z-50 grid place-items-center bg-[#092c4c]/50 p-4" onClick={() => patch({ clearConfirm: false })}><div role="dialog" aria-modal="true" aria-labelledby="clear-order-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><h2 id="clear-order-title" className="text-lg font-bold">Clear the current order?</h2><p className="mt-2 text-sm text-slate-500">All items and discounts will be removed.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="afc-pos-button" onClick={() => patch({ clearConfirm: false })}>Cancel</button><button type="button" className="afc-pos-button afc-pos-button-primary" onClick={clearCart}>Clear Order</button></div></div></div>}
        </aside>
    );
}
