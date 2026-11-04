import { escapeHtml, printHtml } from './print.js';

const ORDER_TYPE_LABELS = {
    dine_in: 'Dine-In',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
};

function paperWidth(size) {
    if (size === '58mm') return '58mm';
    if (size === 'A4') return '210mm';
    return '80mm';
}

function contentWidth(size) {
    if (size === '58mm') return '52mm';
    if (size === 'A4') return '180mm';
    return '72mm';
}

function isNarrow(size) {
    return size === '58mm';
}

export function formatReceiptMoney(value, currency = {}) {
    const amount = Number(value || 0);
    const symbol = currency.symbol || 'Rs.';
    const position = currency.position === 'after' ? 'after' : 'before';
    const whole = Number.isInteger(amount) || Math.abs(amount - Math.round(amount)) < 0.001;
    const formatted = amount.toLocaleString('en-PK', {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return position === 'after' ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
}

function fmtDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const d = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const t = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${d} · ${t}`;
}

function labelOrderType(type) {
    return ORDER_TYPE_LABELS[type] || String(type || '').replace(/_/g, ' ');
}

function qrImageUrl(data, size = 120) {
    if (!data) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/**
 * Normalize receipt payloads from /sales/{id}/receipt, POS sale response, or offline snapshot.
 */
export function normalizeReceiptData(raw = {}, extras = {}) {
    const sale = raw.sale || raw;
    const settings = extras.settings || {};
    const options = raw.options || {
        paper_size: settings.receipt_paper_size || '80mm',
        show_logo: settings.receipt_show_logo !== false,
        show_tax: settings.receipt_show_tax !== false,
        show_cashier: settings.receipt_show_cashier !== false,
        show_customer: settings.receipt_show_customer !== false,
        show_review_qr: settings.receipt_show_review_qr === true || settings.receipt_show_review_qr === 1 || settings.receipt_show_review_qr === '1',
        google_review_url: settings.receipt_google_review_url || '',
        website_review_url: settings.receipt_website_review_url || settings.restaurant_website || '',
    };

    const restaurant = raw.restaurant || {
        name: settings.restaurant_name || 'AFC',
        tagline: settings.restaurant_tagline || '',
        address: settings.restaurant_address || '',
        phone: settings.restaurant_phone || '',
        tax_number: settings.restaurant_tax_number || '',
        logo: settings.receipt_show_logo !== false && settings.restaurant_logo ? settings.restaurant_logo : null,
        header: settings.receipt_header || '',
        footer: settings.receipt_footer || 'Thank you for dining with us.',
    };

    const currency = raw.currency || {
        code: settings.currency_code || 'PKR',
        symbol: settings.currency_symbol || 'Rs.',
        position: settings.currency_position || 'before',
    };

    const items = (raw.items || sale.items || extras.cartItems || []).map((item) => {
        if (item.dish) {
            return {
                quantity: item.quantity,
                dish_name: item.dish.name,
                variant_name: item.variant?.name || null,
                unit_price: (item.unitCents || 0) / 100,
                total: ((item.unitCents || 0) * item.quantity) / 100,
                notes: item.notes || null,
                removed_ingredients: item.removedIngredients || item.removed_ingredients || [],
                addons: (item.addons || []).map((a) => ({
                    name: a.name,
                    price: Number(a.price || 0),
                    total: Number(a.price || 0) * Number(item.quantity || 1),
                })),
            };
        }
        return {
            quantity: item.quantity,
            dish_name: item.dish_name,
            variant_name: item.variant_name || null,
            unit_price: Number(item.unit_price || 0),
            total: Number(item.total || 0),
            notes: item.notes || null,
            removed_ingredients: item.removed_ingredients || [],
            addons: (item.addons || []).map((a) => ({
                name: a.name,
                price: Number(a.price || 0),
                total: Number(a.total ?? a.price ?? 0),
            })),
        };
    });

    const totals = raw.totals || {
        subtotal: sale.subtotal,
        discount_total: sale.discount_total,
        tax_total: sale.tax_total,
        service_charge: sale.service_charge,
        delivery_charge: sale.delivery_charge,
        grand_total: sale.grand_total,
        paid_total: sale.paid_total,
        change_total: sale.change_total,
    };

    const customer = options.show_customer === false ? null : (raw.customer || sale.customer || extras.customer || null);

    return {
        restaurant: {
            ...restaurant,
            logo: options.show_logo ? (restaurant.logo || null) : null,
        },
        options: {
            ...options,
            show_review_qr: Boolean(options.show_review_qr ?? raw.options?.show_review_qr),
            google_review_url: options.google_review_url || raw.options?.google_review_url || '',
            website_review_url: options.website_review_url || raw.options?.website_review_url || '',
        },
        currency,
        invoice_number: raw.invoice_number || sale.invoice_number,
        order_number: raw.order_number || sale.order_number || sale.order?.order_number || null,
        sold_at: raw.sold_at || sale.sold_at,
        order_type: raw.order_type || sale.order_type,
        payment_status: raw.payment_status || sale.payment_status || sale.order?.payment_status || extras.paymentStatus || null,
        delivery_name: raw.delivery_name || sale.delivery_name || extras.deliveryName || null,
        delivery_phone: raw.delivery_phone || sale.delivery_phone || extras.deliveryPhone || null,
        processing_minutes: raw.processing_minutes ?? sale.processing_minutes ?? extras.processingMinutes ?? null,
        custom_slip_message: raw.custom_slip_message || sale.custom_slip_message || extras.customSlipMessage || null,
        cashier: options.show_cashier === false ? null : (raw.cashier || sale.cashier || extras.user || null),
        waiter: raw.waiter || sale.waiter || sale.order?.creator || null,
        customer,
        table: raw.table || sale.table || null,
        delivery_address: raw.delivery_address || sale.delivery_address || extras.deliveryAddress || null,
        notes: raw.notes || sale.notes || null,
        items,
        payments: raw.payments || sale.payments || [],
        totals,
    };
}

function metaRow(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`;
}

function receiptStyles(size) {
    const narrow = isNarrow(size);
    const width = contentWidth(size);
    const page = paperWidth(size);
    const base = narrow ? 11 : 12;
    const brand = narrow ? 14 : 16;
    const orderSize = narrow ? 18 : 22;
    const grand = narrow ? 13 : 15;

    return `
@page { size: ${page} auto; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.slip {
  width: ${width};
  max-width: 100%;
  margin: 0 auto;
  padding: ${narrow ? '3mm 2mm' : '4mm 3mm'};
  font-size: ${base}px;
  line-height: 1.35;
  color: #000;
  background: #fff;
  page-break-inside: avoid;
  break-inside: avoid;
}
.slip-cut {
  page-break-after: always;
  break-after: page;
}
.center { text-align: center; }
.muted { color: #222; }
.brand {
  margin: 0; font-size: ${brand}px; font-weight: 700;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.tagline { margin: 2px 0 0; font-size: ${base - 1}px; }
.contact { margin: 4px 0 0; font-size: ${base - 1}px; line-height: 1.4; }
.logo {
  display: block; margin: 0 auto 6px;
  max-width: ${narrow ? '56px' : '84px'};
  max-height: ${narrow ? '56px' : '84px'};
  object-fit: contain;
  filter: grayscale(100%);
}
.rule {
  border: 0; border-top: 1px dashed #000;
  margin: 8px 0;
}
.order-no {
  margin: 6px 0 2px;
  font-size: ${orderSize}px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.15;
}
.invoice-no {
  margin: 0 0 8px;
  font-size: ${base}px;
  font-weight: 600;
  text-align: center;
}
.meta { margin: 0 0 2px; }
.meta-row {
  display: flex; justify-content: space-between; gap: 8px;
  margin: 2px 0;
}
.meta-label { color: #111; white-space: nowrap; }
.meta-value { text-align: right; font-weight: 600; word-break: break-word; }
.items { width: 100%; border-collapse: collapse; margin: 2px 0; }
.items th {
  font-size: ${base - 1}px; font-weight: 700;
  text-align: left; padding: 0 0 4px;
  border-bottom: 1px solid #000;
}
.items th.num, .items td.num { text-align: right; }
.items th.qty, .items td.qty { width: ${narrow ? '18px' : '28px'}; text-align: center; }
.items td { padding: 5px 0 2px; vertical-align: top; }
.item-name { font-weight: 700; }
.item-sub {
  display: block; font-size: ${base - 1}px; font-weight: 400;
  padding-left: ${narrow ? '0' : '2px'}; margin-top: 1px;
}
.item-note { display: block; font-size: ${base - 1}px; font-style: italic; margin-top: 1px; }
.totals { margin-top: 2px; }
.total-row {
  display: flex; justify-content: space-between; gap: 8px;
  margin: 2px 0;
}
.total-row.grand {
  font-size: ${grand}px; font-weight: 700;
  margin-top: 4px; padding-top: 4px;
  border-top: 1px solid #000;
}
.pay-block { margin-top: 2px; }
.footer {
  margin-top: 10px; text-align: center;
  font-size: ${base - 1}px; white-space: pre-line;
}
.powered { margin-top: 6px; font-size: ${base - 2}px; color: #333; }
.powered strong { font-weight: 700; color: #000; }
.qr-wrap { margin-top: 8px; text-align: center; }
.qr-wrap img { width: ${narrow ? '88px' : '110px'}; height: ${narrow ? '88px' : '110px'}; }
.qr-caption { margin-top: 4px; font-size: ${base - 1}px; }
@media print {
  html, body { background: #fff; }
  .slip { padding: 2mm; }
  .slip-cut { page-break-after: always; break-after: page; }
}
`.trim();
}

function guestNamePhone(data) {
    const name = data.delivery_name || data.customer?.name || '';
    const phone = data.delivery_phone || data.customer?.phone || '';
    return { name, phone };
}

function renderItems(data, narrow) {
    const money = (v) => formatReceiptMoney(v, data.currency);
    if (narrow) {
        return data.items.map((item) => {
            const lines = [];
            lines.push(`<div class="item-name">${item.quantity} × ${escapeHtml(item.dish_name)}${item.variant_name ? ` (${escapeHtml(item.variant_name)})` : ''}</div>`);
            (item.addons || []).forEach((addon) => {
                lines.push(`<span class="item-sub">+ ${escapeHtml(addon.name)}${Number(addon.price) ? `  ${money(addon.price)}` : ''}</span>`);
            });
            (item.removed_ingredients || []).forEach((row) => {
                const label = row.name || row;
                lines.push(`<span class="item-note">No ${escapeHtml(label)}</span>`);
            });
            if (item.notes) lines.push(`<span class="item-note">Note: ${escapeHtml(item.notes)}</span>`);
            return `<tr>
              <td colspan="2">${lines.join('')}</td>
              <td class="num">${money(item.total)}</td>
            </tr>`;
        }).join('');
    }

    return data.items.map((item) => {
        const details = [];
        (item.addons || []).forEach((addon) => {
            details.push(`<span class="item-sub">+ ${escapeHtml(addon.name)}${Number(addon.price) ? `  ${money(addon.price)}` : ''}</span>`);
        });
        (item.removed_ingredients || []).forEach((row) => {
            const label = row.name || row;
            details.push(`<span class="item-note">No ${escapeHtml(label)}</span>`);
        });
        if (item.notes) details.push(`<span class="item-note">Note: ${escapeHtml(item.notes)}</span>`);
        return `<tr>
          <td class="qty">${escapeHtml(item.quantity)}</td>
          <td><div class="item-name">${escapeHtml(item.dish_name)}${item.variant_name ? ` (${escapeHtml(item.variant_name)})` : ''}</div>${details.join('')}</td>
          <td class="num">${money(item.unit_price)}</td>
          <td class="num">${money(item.total)}</td>
        </tr>`;
    }).join('');
}

function renderPaymentsHtml(data) {
    const money = (v) => formatReceiptMoney(v, data.currency);
    const payments = (data.payments || []).filter((p) => Number(p.amount || 0) > 0);
    if (!payments.length) return '';

    if (payments.length === 1) {
        const payment = payments[0];
        const method = payment.method?.name || payment.method_name || payment.payment_method?.name || 'Payment';
        const reference = payment.reference || payment.transaction_reference;
        return `
          <div class="rule"></div>
          <div class="pay-block">
            ${metaRow('Payment Method', method)}
            ${reference ? metaRow('Reference', reference) : ''}
            ${metaRow('Amount Paid', money(data.totals.paid_total ?? payment.amount))}
            ${Number(data.totals.change_total) > 0 ? metaRow('Change', money(data.totals.change_total)) : ''}
          </div>`;
    }

    const rows = payments.map((payment) => {
        const method = payment.method?.name || payment.method_name || payment.payment_method?.name || 'Payment';
        const reference = payment.reference ? ` (${escapeHtml(payment.reference)})` : '';
        return `<div class="total-row"><span>${escapeHtml(method)}${reference}</span><span>${money(payment.amount)}</span></div>`;
    }).join('');

    return `
      <div class="rule"></div>
      <div class="pay-block">
        <div class="item-name" style="margin-bottom:3px">Payments</div>
        ${rows}
        <div class="total-row" style="font-weight:700;margin-top:4px"><span>Paid</span><span>${money(data.totals.paid_total)}</span></div>
        ${Number(data.totals.change_total) > 0 ? `<div class="total-row"><span>Change</span><span>${money(data.totals.change_total)}</span></div>` : ''}
      </div>`;
}

function reviewQrHtml(data) {
    if (!data.options?.show_review_qr) return '';
    const url = String(data.options.google_review_url || data.options.website_review_url || '').trim();
    if (!url) return '';
    const src = qrImageUrl(url, 140);
    return `
      <div class="rule"></div>
      <div class="qr-wrap">
        <img src="${escapeHtml(src)}" alt="Review QR" />
        <div class="qr-caption">Scan for Google / website review</div>
      </div>`;
}

function brandHeader(data) {
    const r = data.restaurant || {};
    const logoHtml = r.logo
        ? `<img class="logo" src="${escapeHtml(r.logo)}" alt="" onerror="this.style.display='none'" />`
        : '';
    // Email intentionally omitted from printed slips.
    const contactBits = [r.phone, r.address, r.tax_number ? `NTN: ${r.tax_number}` : '']
        .filter(Boolean)
        .map((line) => escapeHtml(line).replace(/\n/g, '<br>'));
    const headerExtra = r.header
        ? `<div class="contact muted">${escapeHtml(r.header).replace(/\n/g, '<br>')}</div>`
        : '';
    return `
  <div class="center">
    ${logoHtml}
    <h1 class="brand">${escapeHtml(r.name || 'AFC')}</h1>
    ${r.tagline ? `<p class="tagline muted">${escapeHtml(r.tagline)}</p>` : ''}
    ${contactBits.length ? `<div class="contact muted">${contactBits.join('<br>')}</div>` : ''}
    ${headerExtra}
  </div>`;
}

/** One full slip — printed twice so the printer can cut into identical kitchen + guest halves. */
function slipHtml(data, { pageBreakAfter = false } = {}) {
    const narrow = isNarrow(data.options.paper_size || '80mm');
    const money = (v) => formatReceiptMoney(v, data.currency);
    const guest = guestNamePhone(data);
    const showTable = data.order_type === 'dine_in' && (data.table?.name || data.table?.table_number);
    const tableLabel = data.table?.name || (data.table?.table_number ? `Table ${data.table.table_number}` : '');
    const processingValue = data.processing_minutes === null || data.processing_minutes === '' ? NaN : Number(data.processing_minutes);
    const discount = Number(data.totals.discount_total || 0);
    const tax = Number(data.totals.tax_total || 0);
    const service = Number(data.totals.service_charge || 0);
    const delivery = Number(data.totals.delivery_charge || 0);
    const showTax = data.options.show_tax !== false && tax > 0;
    const paid = Number(data.totals.paid_total || 0);
    const grand = Number(data.totals.grand_total || 0);
    const balance = Math.max(0, grand - paid);
    const status = String(data.payment_status || '').toLowerCase();
    const showBalance = balance > 0.009 || ['partial', 'partially_paid', 'unpaid', 'pending'].includes(status);
    const itemHeader = narrow
        ? `<tr><th colspan="2">Item</th><th class="num">Total</th></tr>`
        : `<tr><th class="qty">Qty</th><th>Item</th><th class="num">Price</th><th class="num">Total</th></tr>`;

    return `
<section class="slip${pageBreakAfter ? ' slip-cut' : ''}">
  ${brandHeader(data)}
  <div class="rule"></div>
  <div class="order-no">${escapeHtml(data.order_number || '—')}</div>
  <div class="invoice-no">Invoice: ${escapeHtml(data.invoice_number || '—')}</div>
  <div class="meta">
    ${metaRow('Date & Time', fmtDateTime(data.sold_at))}
    ${data.cashier?.name ? metaRow('Cashier', data.cashier.name) : ''}
    ${metaRow('Order Type', labelOrderType(data.order_type))}
    ${showTable ? metaRow('Table', tableLabel) : ''}
    ${guest.name ? metaRow('Name', guest.name) : ''}
    ${guest.phone ? metaRow('Number', guest.phone) : ''}
    ${data.customer?.address && !guest.name ? metaRow('Customer', data.customer.name) : ''}
    ${Number.isFinite(processingValue) && processingValue > 0 ? metaRow('Processing', `${processingValue} min`) : ''}
  </div>
  <div class="rule"></div>
  <table class="items">
    <thead>${itemHeader}</thead>
    <tbody>${renderItems(data, narrow)}</tbody>
  </table>
  <div class="rule"></div>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${money(data.totals.subtotal)}</span></div>
    ${discount > 0 ? `<div class="total-row"><span>Discount</span><span>-${money(discount)}</span></div>` : ''}
    ${showTax ? `<div class="total-row"><span>Tax</span><span>${money(tax)}</span></div>` : ''}
    ${service > 0 ? `<div class="total-row"><span>Service Charge</span><span>${money(service)}</span></div>` : ''}
    ${delivery > 0 ? `<div class="total-row"><span>Delivery Charge</span><span>${money(delivery)}</span></div>` : ''}
    <div class="total-row grand"><span>GRAND TOTAL</span><span>${money(grand)}</span></div>
  </div>
  ${renderPaymentsHtml(data)}
  ${showBalance ? `
    <div class="rule"></div>
    <div class="pay-block">
      ${metaRow('Paid', money(paid))}
      ${metaRow('Balance Due', money(balance))}
      ${status ? metaRow('Payment Status', status.replace(/_/g, ' ').toUpperCase()) : ''}
    </div>` : ''}
  ${data.custom_slip_message ? `<div class="rule"></div><div class="center" style="font-weight:700;white-space:pre-line">${escapeHtml(data.custom_slip_message)}</div>` : ''}
  ${reviewQrHtml(data)}
  <div class="rule"></div>
  <div class="footer">${escapeHtml((data.restaurant || {}).footer || 'Thank you for dining with us!').replace(/\n/g, '<br>')}</div>
  <div class="powered center"><strong>Powered by Musab Afzal</strong><br>03258090011</div>
</section>`;
}

/**
 * Build a full printable HTML document: two identical slips with a page break for the cutter.
 */
export function buildReceiptHtml(raw, extras = {}) {
    const data = normalizeReceiptData(raw, extras);
    const size = data.options.paper_size || '80mm';
    const body = `${slipHtml(data, { pageBreakAfter: true })}${slipHtml(data)}`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.order_number || data.invoice_number || 'Receipt')}</title>
<style>${receiptStyles(size)}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function printReceiptDocument(raw, extras = {}) {
    const data = normalizeReceiptData(raw, extras);
    const html = buildReceiptHtml(data, extras);
    printHtml(html, { title: data.order_number || data.invoice_number || 'Receipt', autoPrint: extras.autoPrint !== false });
    return data;
}
