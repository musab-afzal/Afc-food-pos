import { formatReceiptMoney, normalizeReceiptData } from '../../utils/receiptTemplate.js';

const ORDER_TYPE_LABELS = {
    dine_in: 'Dine-In',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
};

function fmtDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function MetaRow({ label, value }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex justify-between gap-3 text-[12px] leading-snug">
            <span className="text-black/70">{label}</span>
            <span className="text-right font-semibold text-black">{value}</span>
        </div>
    );
}

function Rule() {
    return <div className="my-2.5 border-t border-dashed border-black" />;
}

/**
 * On-screen thermal receipt preview — mirrors print template layout.
 */
export default function ReceiptPreview({ receipt, settings, className = '' }) {
    const data = normalizeReceiptData(receipt || {}, { settings });
    const money = (v) => formatReceiptMoney(v, data.currency);
    const narrow = data.options.paper_size === '58mm';
    const r = data.restaurant || {};
    const discount = Number(data.totals.discount_total || 0);
    const tax = Number(data.totals.tax_total || 0);
    const service = Number(data.totals.service_charge || 0);
    const delivery = Number(data.totals.delivery_charge || 0);
    const showTax = data.options.show_tax !== false && tax > 0;
    const showTable = data.order_type === 'dine_in' && (data.table?.name || data.table?.table_number);
    const tableLabel = data.table?.name || (data.table?.table_number ? `Table ${data.table.table_number}` : '');
    const paid = Number(data.totals.paid_total || 0);
    const grand = Number(data.totals.grand_total || 0);
    const balance = Math.max(0, grand - paid);
    const status = String(data.payment_status || '').toLowerCase();
    const showBalance = balance > 0.009 || ['partial', 'partially_paid', 'unpaid'].includes(status);
    const payments = data.payments || [];

    return (
        <div
            className={`mx-auto bg-white text-black shadow-[0_10px_40px_rgba(0,0,0,.08)] ${className}`}
            style={{
                width: narrow ? 220 : 300,
                maxWidth: '100%',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: narrow ? 11 : 12,
                lineHeight: 1.35,
                padding: narrow ? '14px 12px' : '18px 16px',
            }}
        >
            <div className="text-center">
                {r.logo ? (
                    <img
                        src={r.logo}
                        alt=""
                        className="mx-auto mb-2 object-contain grayscale"
                        style={{ maxWidth: narrow ? 56 : 84, maxHeight: narrow ? 56 : 84 }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : null}
                <h1 className="m-0 text-[15px] font-bold uppercase tracking-wide">{r.name || 'AFC'}</h1>
                {r.tagline ? <p className="m-0 mt-1 text-[11px] text-black/70">{r.tagline}</p> : null}
                <div className="mt-1.5 space-y-0.5 text-[11px] text-black/75">
                    {r.phone ? <div>{r.phone}</div> : null}
                    {r.address ? <div className="whitespace-pre-line">{r.address}</div> : null}
                    {r.email ? <div>{r.email}</div> : null}
                    {r.tax_number ? <div>NTN: {r.tax_number}</div> : null}
                    {r.header ? <div className="whitespace-pre-line">{r.header}</div> : null}
                </div>
            </div>

            <Rule />
            <div className="text-center text-[13px] font-bold tracking-[0.14em]">RECEIPT</div>

            <div className="mt-2 space-y-0.5">
                <MetaRow label="Invoice No" value={data.invoice_number} />
                <MetaRow label="Order No" value={data.order_number} />
                <MetaRow label="Date" value={fmtDate(data.sold_at)} />
                <MetaRow label="Time" value={fmtTime(data.sold_at)} />
                <MetaRow label="Cashier" value={data.cashier?.name} />
                {data.waiter?.name && data.waiter.name !== data.cashier?.name ? <MetaRow label="Waiter" value={data.waiter.name} /> : null}
                {showTable ? <MetaRow label="Table No" value={tableLabel} /> : null}
                <MetaRow label="Order Type" value={ORDER_TYPE_LABELS[data.order_type] || data.order_type} />
            </div>

            {data.customer ? (
                <>
                    <Rule />
                    <div className="space-y-0.5">
                        <MetaRow label="Customer" value={data.customer.name} />
                        <MetaRow label="Phone" value={data.customer.phone} />
                        {(data.order_type === 'delivery' && (data.delivery_address || data.customer.address)) ? (
                            <MetaRow label="Address" value={data.delivery_address || data.customer.address} />
                        ) : null}
                    </div>
                </>
            ) : null}

            <Rule />

            {!narrow && (
                <div className="mb-1 grid grid-cols-[28px_1fr_52px_56px] gap-1 border-b border-black pb-1 text-[10px] font-bold uppercase tracking-wide">
                    <span className="text-center">Qty</span>
                    <span>Item</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Total</span>
                </div>
            )}

            <div className="space-y-2">
                {data.items.map((item, index) => (
                    <div key={index} className={narrow ? 'space-y-0.5' : 'grid grid-cols-[28px_1fr_52px_56px] gap-1'}>
                        {narrow ? (
                            <>
                                <div className="font-bold">{item.quantity} × {item.dish_name}{item.variant_name ? ` (${item.variant_name})` : ''}</div>
                                {(item.addons || []).map((addon, i) => (
                                    <div key={i} className="pl-1 text-[11px]">+ {addon.name}{Number(addon.price) ? `  ${money(addon.price)}` : ''}</div>
                                ))}
                                {item.notes ? <div className="pl-1 text-[11px] italic">Note: {item.notes}</div> : null}
                                <div className="text-right font-semibold">{money(item.total)}</div>
                            </>
                        ) : (
                            <>
                                <div className="text-center">{item.quantity}</div>
                                <div>
                                    <div className="font-bold">{item.dish_name}{item.variant_name ? ` (${item.variant_name})` : ''}</div>
                                    {(item.addons || []).map((addon, i) => (
                                        <div key={i} className="text-[11px]">+ {addon.name}{Number(addon.price) ? `  ${money(addon.price)}` : ''}</div>
                                    ))}
                                    {item.notes ? <div className="text-[11px] italic">Note: {item.notes}</div> : null}
                                </div>
                                <div className="text-right">{money(item.unit_price)}</div>
                                <div className="text-right font-semibold">{money(item.total)}</div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <Rule />
            <div className="space-y-0.5">
                <MetaRow label="Subtotal" value={money(data.totals.subtotal)} />
                {discount > 0 ? <MetaRow label="Discount" value={`-${money(discount)}`} /> : null}
                {showTax ? <MetaRow label="Tax" value={money(tax)} /> : null}
                {service > 0 ? <MetaRow label="Service Charge" value={money(service)} /> : null}
                {delivery > 0 ? <MetaRow label="Delivery Charge" value={money(delivery)} /> : null}
                <div className="mt-1 flex justify-between border-t border-black pt-1 text-[13px] font-bold">
                    <span>GRAND TOTAL</span>
                    <span>{money(grand)}</span>
                </div>
            </div>

            {payments.length === 1 ? (
                <>
                    <Rule />
                    <div className="space-y-0.5">
                        <MetaRow label="Payment Method" value={payments[0].method?.name || payments[0].method_name || 'Payment'} />
                        {payments[0].reference ? <MetaRow label="Reference" value={payments[0].reference} /> : null}
                        <MetaRow label="Amount Paid" value={money(data.totals.paid_total ?? payments[0].amount)} />
                        {Number(data.totals.change_total) > 0 ? <MetaRow label="Change" value={money(data.totals.change_total)} /> : null}
                    </div>
                </>
            ) : null}

            {payments.length > 1 ? (
                <>
                    <Rule />
                    <div className="mb-1 text-[12px] font-bold">Payments</div>
                    <div className="space-y-0.5">
                        {payments.map((payment, index) => (
                            <MetaRow
                                key={index}
                                label={`${payment.method?.name || 'Payment'}${payment.reference ? ` (${payment.reference})` : ''}`}
                                value={money(payment.amount)}
                            />
                        ))}
                        <MetaRow label="Paid" value={money(data.totals.paid_total)} />
                        {Number(data.totals.change_total) > 0 ? <MetaRow label="Change" value={money(data.totals.change_total)} /> : null}
                    </div>
                </>
            ) : null}

            {showBalance ? (
                <>
                    <Rule />
                    <div className="space-y-0.5">
                        <MetaRow label="Paid" value={money(paid)} />
                        <MetaRow label="Balance" value={money(balance)} />
                        {status ? <MetaRow label="Payment Status" value={status.replace(/_/g, ' ').toUpperCase()} /> : null}
                    </div>
                </>
            ) : null}

            {data.notes ? (
                <>
                    <Rule />
                    <p className="text-center text-[11px] text-black/70">Note: {data.notes}</p>
                </>
            ) : null}

            <Rule />
            <p className="whitespace-pre-line text-center text-[11px] text-black/80">{r.footer || 'Thank you for dining with us!'}</p>
            <p className="mt-2 text-center text-[10px] text-black/50"><strong>Powered by Musab Afzal</strong><br />03258090011</p>
        </div>
    );
}
