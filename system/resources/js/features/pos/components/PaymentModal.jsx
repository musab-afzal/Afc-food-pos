import { Banknote, ChevronRight, CircleX, Clock, CreditCard, HandPlatter, Hourglass, Loader2, Plus, Printer, QrCode, ReceiptText, RotateCcw, Tag, Trash2, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

function MethodIcon({ method }) {
    const name = `${method?.code} ${method?.name}`.toLowerCase();
    if (name.includes('cash') && !name.includes('jazz')) return <Banknote size={26} />;
    if (name.includes('easypaisa')) return <span className="afc-checkout-easypaisa" aria-hidden="true">e</span>;
    if (name.includes('jazz')) return <span className="afc-checkout-jazz" aria-hidden="true">Jazz</span>;
    if (name.includes('qr')) return <QrCode size={25} />;
    if (name.includes('wallet')) return <Wallet size={25} />;
    return <CreditCard size={26} />;
}

export default function PaymentModal() {
    const { state, patch, totals, completeSale } = usePos();
    const [localBusy, setLocalBusy] = useState(false);
    const dialogRef = useRef(null);
    const methods = (state.catalog?.payment_methods || []).filter((method) => state.online || method.works_offline);
    const allowDiscounts = state.catalog?.settings?.allow_discounts !== false;
    const discountCents = (totals.discountCents || 0) + (totals.loyaltyDiscountCents || 0);
    const paid = state.payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    const due = Math.round(Number(totals.total) || 0);
    const remaining = Math.max(0, due - paid);
    const change = Math.max(0, paid - due);
    const busy = state.paying || localBusy;
    const split = state.payments.length > 1;
    const primary = methods.find((method) => Number(method.id) === Number(state.payments[0]?.payment_method_id));
    const isCash = primary?.code === 'cash' || (String(primary?.name || '').toLowerCase().includes('cash') && !String(primary?.name || '').toLowerCase().includes('jazz'));
    const hasCustomer = Boolean(state.customerId || state.selectedCustomer?.id);

    const quickAmounts = useMemo(() => {
        const amount = due / 100;
        const rounded = [500, 1000, 5000, Math.ceil(amount / 500) * 500, Math.ceil(amount / 1000) * 1000, Math.ceil(amount / 5000) * 500];
        return [...new Set(rounded.filter((value) => value >= amount && value > 0))].sort((a, b) => a - b).slice(0, 3);
    }, [due]);

    useEffect(() => {
        if (!state.paymentOpen) return;
        const previous = document.activeElement;
        dialogRef.current?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, [state.paymentOpen]);

    if (!state.paymentOpen) return null;

    function close() {
        if (!busy) patch({ paymentOpen: false, checkoutError: '' });
    }

    function trapFocus(event) {
        if (event.key !== 'Tab') return;
        const elements = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function setPayment(index, updates) {
        if (busy) return;
        patch({ checkoutError: '', payments: state.payments.map((payment, position) => position === index ? { ...payment, ...updates } : payment) });
    }

    function selectMethod(method) {
        if (busy) return;
        patch({ selectedPaymentMethod: method.id, checkoutError: '', payments: [{ payment_method_id: Number(method.id), amount: (due / 100).toFixed(2), reference: '' }] });
    }

    function addSplit() {
        if (busy || !methods.length) return;
        if (!split && state.payments.length && due >= 2) {
            const firstHalf = Math.floor(due / 2);
            const secondMethod = methods.find((method) => method.id !== primary?.id) || methods[0];
            patch({ checkoutError: '', payments: [{ ...state.payments[0], amount: (firstHalf / 100).toFixed(2) }, { payment_method_id: Number(secondMethod.id), amount: ((due - firstHalf) / 100).toFixed(2), reference: '' }] });
        } else {
            patch({ checkoutError: '', payments: [...state.payments, { payment_method_id: Number(methods[0].id), amount: (remaining / 100).toFixed(2), reference: '' }] });
        }
    }

    async function handleComplete(paymentStatus = 'paid') {
        if (busy) return;
        setLocalBusy(true);
        patch({ checkoutError: '', paymentStatus });
        try { await completeSale({ paymentStatus }); }
        catch (error) { patch({ checkoutError: error?.message || 'Unable to complete payment. Please try again.' }); }
        finally { setLocalBusy(false); }
    }

    return (
        <div className="afc-checkout-overlay" onClick={close}>
            <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="checkout-title" aria-describedby="checkout-description" aria-busy={busy} className="afc-checkout-dialog" onClick={(event) => event.stopPropagation()} onKeyDown={trapFocus}>
                <header className="afc-checkout-header">
                    <span className="afc-checkout-header-icon"><ReceiptText size={37} strokeWidth={1.8} /></span>
                    <div><h2 id="checkout-title">Checkout</h2><p id="checkout-description">Complete the payment to finish the order</p></div>
                    <div className="afc-checkout-ribbons" aria-hidden="true"><i /><i /><i /></div>
                    <button type="button" disabled={busy} onClick={close} aria-label="Close checkout"><X size={31} /></button>
                </header>
                <div className="afc-checkout-body">
                    <div className="afc-checkout-entry">
                        <div className="afc-checkout-payable"><HandPlatter size={66} strokeWidth={1.5} /><div><p>Payable Amount</p><strong>{money(due)}</strong></div></div>
                        {discountCents > 0 && (
                            <div className="afc-checkout-discount-summary" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total</span><span>{money(totals.subtotal)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>−{money(discountCents)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Amount Paid</span><span>{money(due)}</span></div>
                            </div>
                        )}
                        {allowDiscounts && (
                            <div className="afc-checkout-discount-row">
                                <button type="button" disabled={busy} className="afc-checkout-discount-btn" onClick={() => patch({ discountOpen: true })}>
                                    <Tag size={18} /> {discountCents > 0 ? `Discount −${money(discountCents)}` : 'Give discount'}
                                </button>
                                {discountCents > 0 && (
                                    <button type="button" disabled={busy} className="afc-checkout-discount-clear" onClick={() => patch({ discountTotal: 0, couponCode: '', couponDiscount: 0, loyaltyPoints: 0 })}>
                                        Clear
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="afc-checkout-order-meta" aria-label="Order slip options">
                            {state.orderType === 'delivery' && (
                                <div className="afc-checkout-meta-grid">
                                    <label htmlFor="checkout-delivery-name">Delivery name<span>Optional — prints on receipt</span>
                                        <input id="checkout-delivery-name" type="text" maxLength={120} disabled={busy} value={state.deliveryName} onChange={(event) => patch({ deliveryName: event.target.value })} placeholder="Recipient name" />
                                    </label>
                                    <label htmlFor="checkout-delivery-phone">Delivery phone<span>Optional — prints on receipt</span>
                                        <input id="checkout-delivery-phone" type="tel" maxLength={30} disabled={busy} value={state.deliveryPhone} onChange={(event) => patch({ deliveryPhone: event.target.value })} placeholder="03xx xxxxxxx" />
                                    </label>
                                    <label htmlFor="checkout-delivery-address" className="afc-checkout-meta-wide">Delivery address<span>Optional — prints on receipt</span>
                                        <input id="checkout-delivery-address" type="text" maxLength={500} disabled={busy} value={state.deliveryAddress} onChange={(event) => patch({ deliveryAddress: event.target.value })} placeholder="Street, area, landmark" />
                                    </label>
                                </div>
                            )}
                            <div className="afc-checkout-meta-grid">
                                <label htmlFor="checkout-processing">Processing time (minutes)<span>Optional for dine-in, takeaway &amp; delivery</span>
                                    <input id="checkout-processing" type="number" min="0" max="1440" step="1" inputMode="numeric" disabled={busy} value={state.processingMinutes} onChange={(event) => patch({ processingMinutes: event.target.value })} placeholder="e.g. 30" />
                                </label>
                                <label htmlFor="checkout-slip-message" className="afc-checkout-meta-wide">Custom slip message<span>Optional — prints on receipt</span>
                                    <input id="checkout-slip-message" type="text" maxLength={300} disabled={busy} value={state.customSlipMessage} onChange={(event) => patch({ customSlipMessage: event.target.value })} placeholder="Message near the receipt footer" />
                                </label>
                            </div>
                        </div>
                        <fieldset className="afc-checkout-methods" disabled={busy}>
                            <legend>Select Payment Method</legend>
                            <div>{methods.map((method) => <button type="button" key={method.id} aria-pressed={!split && method.id === primary?.id} className={!split && method.id === primary?.id ? 'is-active' : ''} onClick={() => selectMethod(method)}><MethodIcon method={method} /><span>{method.name}</span></button>)}</div>
                        </fieldset>
                        {!methods.length && <p role="alert" className="afc-checkout-error">No payment methods available{state.online ? '. Configure a payment method to continue.' : ' offline. Reconnect to continue.'}</p>}
                        {!split && isCash && <div className="afc-checkout-quick">
                            <button type="button" disabled={busy} onClick={() => setPayment(0, { amount: (due / 100).toFixed(2) })}>Exact</button>
                            {quickAmounts.map((amount) => <button type="button" key={amount} disabled={busy} onClick={() => setPayment(0, { amount: amount.toFixed(2) })}>Rs {amount.toLocaleString('en-PK')}</button>)}
                        </div>}
                        <div className="afc-checkout-payments">
                            {state.payments.map((payment, index) => {
                                const method = methods.find((item) => Number(item.id) === Number(payment.payment_method_id));
                                return <div key={index} className={split ? 'afc-checkout-payment-row is-split' : 'afc-checkout-payment-row'}>
                                    {split && <div className="afc-checkout-split-heading"><label htmlFor={`checkout-method-${index}`}>Payment {index + 1}</label><select id={`checkout-method-${index}`} disabled={busy} value={payment.payment_method_id || ''} onChange={(event) => setPayment(index, { payment_method_id: Number(event.target.value), reference: '' })}>{methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={busy} aria-label={`Remove payment ${index + 1}`} onClick={() => patch({ checkoutError: '', payments: state.payments.filter((_, position) => position !== index) })}><Trash2 size={18} /></button></div>}
                                    <label htmlFor={`checkout-amount-${index}`}>Received Amount{split ? ` ${index + 1}` : ''}</label>
                                    <div className="afc-checkout-input afc-checkout-amount"><Banknote size={25} /><span>Rs</span><input id={`checkout-amount-${index}`} type="number" min="0.01" step="0.01" inputMode="decimal" disabled={busy} value={payment.amount} onChange={(event) => setPayment(index, { amount: event.target.value })} /></div>
                                    <label htmlFor={`checkout-reference-${index}`}>Reference ({method?.requires_reference ? 'Required' : 'Optional'})</label>
                                    <div className="afc-checkout-input"><Tag size={23} /><input id={`checkout-reference-${index}`} disabled={busy} required={Boolean(method?.requires_reference)} value={payment.reference || ''} onChange={(event) => setPayment(index, { reference: event.target.value })} placeholder="Enter reference (e.g. Bill No., Transaction ID)" /></div>
                                </div>;
                            })}
                        </div>
                        <button type="button" disabled={busy || !methods.length || due < 2} className="afc-checkout-split-button" onClick={addSplit}><span><Plus size={25} /></span>{split ? 'Add Another Payment' : 'Split Payment'}<ChevronRight size={25} /></button>
                        {state.checkoutError && <p role="alert" className="afc-checkout-error">{state.checkoutError}</p>}
                        {!state.online && <p className="afc-checkout-offline">Offline payment will sync when your connection returns.</p>}
                    </div>
                    <aside className="afc-checkout-summary" aria-label="Payment summary">
                        <div className="afc-checkout-summary-card"><h3><ReceiptText size={29} /> Payment Summary</h3><dl><div><dt>Total Amount</dt><dd>{money(due)}</dd></div><div><dt>Received Amount</dt><dd>{money(paid)}</dd></div></dl><div className={`afc-checkout-change ${remaining ? 'is-due' : ''}`} aria-live="polite"><RotateCcw size={28} /><span>{remaining ? 'Remaining Amount' : 'Return / Change'}</span><strong>{money(remaining || change)}</strong></div></div>
                        <div className={`afc-checkout-return ${remaining ? 'is-due' : ''}`}>
                            <div className="afc-checkout-cash-art" aria-hidden="true"><Banknote size={146} strokeWidth={1.6} /><span><RotateCcw size={44} strokeWidth={2.3} /></span></div>
                            <h3>{remaining ? 'Amount Still Due' : 'Return to Customer'}</h3><strong aria-live="polite">{money(remaining || change)}</strong>
                        </div>
                    </aside>
                </div>
                <div className="afc-checkout-deferred" role="group" aria-label="Pay later / ledger options">
                    <span>Pay later (ledger)</span>
                    <button
                        type="button"
                        disabled={busy || !methods.length}
                        title={hasCustomer ? 'Save as unpaid on customer ledger' : 'Select or add a customer first'}
                        onClick={() => {
                            if (!hasCustomer) {
                                patch({ checkoutError: 'Add a customer before marking unpaid — it posts to their ledger.' });
                                return;
                            }
                            handleComplete('unpaid');
                        }}
                    >
                        <Clock size={20} /> Unpaid / Ledger
                    </button>
                    <button
                        type="button"
                        disabled={busy || !methods.length}
                        title={hasCustomer ? 'Save as pending on customer ledger' : 'Select or add a customer first'}
                        onClick={() => {
                            if (!hasCustomer) {
                                patch({ checkoutError: 'Add a customer before pending payment — it posts to their ledger.' });
                                return;
                            }
                            handleComplete('pending');
                        }}
                    >
                        <Hourglass size={20} /> Pending payment
                    </button>
                </div>
                <footer className="afc-checkout-footer"><button type="button" disabled={busy} className="afc-checkout-cancel" onClick={close}><CircleX size={28} /> Cancel</button><button type="button" disabled={busy || !methods.length || !state.payments.length} className="afc-checkout-complete" onClick={() => handleComplete('paid')}>{busy ? <Loader2 size={30} className="animate-spin" /> : <Printer size={32} />}{busy ? 'Processing...' : 'Complete & Print'}</button></footer>
            </section>
        </div>
    );
}
