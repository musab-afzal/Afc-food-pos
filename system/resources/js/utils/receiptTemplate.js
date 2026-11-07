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
    const t = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${d} - ${t}`;
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
        name: settings.restaurant_name || 'AALESHAN FOOD COURT',
        tagline: settings.restaurant_tagline || '',
        address: settings.restaurant_address || '',
        phone: settings.restaurant_phone || '',
        tax_number: settings.restaurant_tax_number || '',
        logo: settings.receipt_show_logo !== false && settings.restaurant_logo ? settings.restaurant_logo : null,
        header: settings.receipt_header || '',
        footer: settings.receipt_footer || 'Thank you for dining with us!',
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
    const brand = narrow ? 15 : 17;
    const orderSize = narrow ? 20 : 26;
    const copyLabel = narrow ? 11 : 12;
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
.brand {
  margin: 0; font-size: ${brand}px; font-weight: 800;
  letter-spacing: 0.01em; text-transform: uppercase;
}
.tagline { margin: 3px 0 0; font-size: ${base}px; font-weight: 500; }
.contact { margin: 2px 0 0; font-size: ${base}px; line-height: 1.35; }
.rule {
  border: 0; border-top: 1px dashed #000;
  margin: 8px 0;
}
.copy-title {
  margin: 0;
  text-align: center;
  font-size: ${copyLabel}px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.order-no {
  margin: 4px 0 2px;
  font-size: ${orderSize}px;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.1;
}
.meta { margin: 0; }
.meta-row {
  display: flex; justify-content: space-between; gap: 8px;
  margin: 2px 0;
}
.meta-label { white-space: nowrap; }
.meta-value { text-align: right; font-weight: 600; word-break: break-word; }
.items { width: 100%; border-collapse: collapse; margin: 2px 0; }
.items th {
  font-size: ${base}px; font-weight: 700;
  text-align: left; padding: 0 0 4px;
}
.items th.num, .items td.num { text-align: right; white-space: nowrap; }
.items th.qty, .items td.qty { width: ${narrow ? '22px' : '28px'}; text-align: left; }
.items th.price, .items td.price { width: ${narrow ? '48px' : '58px'}; }
.items th.total, .items td.total { width: ${narrow ? '52px' : '64px'}; }
.items td { padding: 4px 0 2px; vertical-align: top; }
.item-name { font-weight: 600; }
.item-sub {
  display: block; font-size: ${base - 1}px; font-weight: 400;
  margin-top: 1px;
}
.item-note { display: block; font-size: ${base - 1}px; font-style: italic; margin-top: 1px; }
.totals { margin-top: 2px; }
.total-row {
  display: flex; justify-content: space-between; gap: 8px;
  margin: 3px 0;
}
.total-row.grand {
  font-size: ${grand}px; font-weight: 800;
}
.pay-block { margin-top: 2px; }
.footer {
  margin-top: 2px; text-align: center;
  font-size: ${base}px;
}
.powered {
  margin-top: 6px; text-align: center;
  font-size: ${base}px; font-weight: 700;
}
.powered small {
  display: block; margin-top: 2px;
  font-size: ${base - 1}px; font-weight: 600;
}
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

function formatPlainAmount(value) {
    const amount = Number(value || 0);
    const whole = Number.isInteger(amount) || Math.abs(amount - Math.round(amount)) < 0.001;
    return amount.toLocaleString('en-PK', {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

function renderItems(data, { mode = 'full' } = {}) {
    return data.items.map((item) => {
        const details = [];
        (item.addons || []).forEach((addon) => {
            details.push(`<span class="item-sub">+ ${escapeHtml(addon.name)}</span>`);
        });
        (item.removed_ingredients || []).forEach((row) => {
            const label = row.name || row;
            details.push(`<span class="item-note">No ${escapeHtml(label)}</span>`);
        });
        if (item.notes) details.push(`<span class="item-note">${escapeHtml(item.notes)}</span>`);
        const name = `${escapeHtml(item.dish_name)}${item.variant_name ? ` (${escapeHtml(item.variant_name)})` : ''}`;
        if (mode === 'kitchen') {
            return `<tr>
          <td class="qty">${escapeHtml(item.quantity)}</td>
          <td><div class="item-name">${name}</div>${details.join('')}</td>
          <td class="num price">${formatPlainAmount(item.unit_price)}</td>
        </tr>`;
        }
        return `<tr>
          <td class="qty">${escapeHtml(item.quantity)}</td>
          <td><div class="item-name">${name}</div>${details.join('')}</td>
          <td class="num price">${formatPlainAmount(item.unit_price)}</td>
          <td class="num total">${formatPlainAmount(item.total)}</td>
        </tr>`;
    }).join('');
}

function itemsTable(data, { mode = 'full' } = {}) {
    if (mode === 'kitchen') {
        return `
  <table class="items">
    <thead>
      <tr>
        <th class="qty">Qty</th>
        <th>Item</th>
        <th class="num price">Price</th>
      </tr>
    </thead>
    <tbody>${renderItems(data, { mode: 'kitchen' })}</tbody>
  </table>`;
    }
    return `
  <table class="items">
    <thead>
      <tr>
        <th class="qty">Qty</th>
        <th>Item</th>
        <th class="num price">Price</th>
        <th class="num total">Total</th>
      </tr>
    </thead>
    <tbody>${renderItems(data, { mode: 'full' })}</tbody>
  </table>`;
}

function paymentMethodLabel(data) {
    const payments = (data.payments || []).filter((p) => Number(p.amount || 0) > 0);
    if (!payments.length) {
        const status = String(data.payment_status || '').toLowerCase();
        if (['unpaid', 'pending'].includes(status)) return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return '';
    }
    if (payments.length === 1) {
        return payments[0].method?.name || payments[0].method_name || payments[0].payment_method?.name || 'Cash';
    }
    return payments.map((p) => p.method?.name || p.method_name || p.payment_method?.name || 'Payment').join(' + ');
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

function poweredFooter(data) {
    const footer = (data.restaurant || {}).footer || 'Thank you for dining with us!';
    return `
  <div class="footer">${escapeHtml(footer)}</div>
  <div class="powered">Powered by Musab Afzal<small>03258090011</small></div>`;
}

/** Customer invoice — matches provided design. */
function customerInvoiceHtml(data, { pageBreakAfter = false } = {}) {
    const money = (v) => formatReceiptMoney(v, data.currency);
    const r = data.restaurant || {};
    const total = Number(data.totals.subtotal ?? 0);
    const discount = Number(data.totals.discount_total ?? 0);
    const afterDiscount = Math.max(0, total - discount);
    const paid = Number(data.totals.paid_total || 0);
    const grand = Number(data.totals.grand_total || afterDiscount);
    const method = paymentMethodLabel(data);

    return `
<section class="slip${pageBreakAfter ? ' slip-cut' : ''}">
  <div class="center">
    <h1 class="brand">${escapeHtml(r.name || 'AALESHAN FOOD COURT')}</h1>
    ${r.tagline ? `<p class="tagline">${escapeHtml(r.tagline)}</p>` : ''}
    ${r.phone ? `<div class="contact">${escapeHtml(r.phone)}</div>` : ''}
    ${r.address ? `<div class="contact">${escapeHtml(r.address).replace(/\n/g, '<br>')}</div>` : ''}
  </div>
  <div class="rule"></div>
  <div class="copy-title">Customer Invoice</div>
  <div class="order-no">${escapeHtml(data.order_number || '—')}</div>
  <div class="rule"></div>
  <div class="meta">
    ${metaRow('Invoice No', data.invoice_number)}
    ${metaRow('Date & Time', fmtDateTime(data.sold_at))}
    ${data.cashier?.name ? metaRow('Cashier', data.cashier.name) : ''}
    ${metaRow('Order Type', labelOrderType(data.order_type))}
  </div>
  <div class="rule"></div>
  ${itemsTable(data)}
  <div class="rule"></div>
  <div class="totals">
    <div class="total-row"><span>TOTAL</span><span>${money(total)}</span></div>
    ${discount > 0 ? `<div class="total-row"><span>Discount</span><span>- ${money(discount)}</span></div>` : ''}
    <div class="total-row grand"><span>Amount Paid</span><span>${money(discount > 0 ? afterDiscount : (paid > 0 ? paid : grand))}</span></div>
  </div>
  <div class="meta" style="margin-top:4px">
    ${method ? metaRow('Payment Method', method) : ''}
  </div>
  ${reviewQrHtml(data)}
  <div class="rule"></div>
  ${poweredFooter(data)}
</section>`;
}

/** Kitchen ticket — qty, item, unit price, and custom slip message. */
function kitchenTicketHtml(data, { pageBreakAfter = false } = {}) {
    const message = String(data.custom_slip_message || '').trim();
    return `
<section class="slip${pageBreakAfter ? ' slip-cut' : ''}">
  <div class="copy-title">For Kitchen</div>
  <div class="order-no">${escapeHtml(data.order_number || '—')}</div>
  <div class="rule"></div>
  <div class="meta">
    ${metaRow('Invoice No', data.invoice_number)}
    ${metaRow('Date & Time', fmtDateTime(data.sold_at))}
    ${metaRow('Order Type', labelOrderType(data.order_type))}
  </div>
  <div class="rule"></div>
  ${itemsTable(data, { mode: 'kitchen' })}
  ${message ? `<div class="rule"></div><div class="center" style="font-weight:700">${escapeHtml(message)}</div>` : ''}
  <div class="rule"></div>
</section>`;
}

/**
 * Print kitchen ticket first, then customer invoice (page break for cutter).
 */
export function buildReceiptHtml(raw, extras = {}) {
    const data = normalizeReceiptData(raw, extras);
    const size = data.options.paper_size || '80mm';
    const body = `${kitchenTicketHtml(data, { pageBreakAfter: true })}${customerInvoiceHtml(data)}`;

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
