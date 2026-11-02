/** Restaurant currency (from settings: currency.code / symbol / position). Updated by setCurrencyConfig(). */
let activeCurrency = { code: 'PKR', symbol: 'Rs.', position: 'before' };

export const setCurrencyConfig = (config = {}) => {
    activeCurrency = {
        code: config.code || activeCurrency.code,
        symbol: config.symbol || activeCurrency.symbol,
        position: config.position === 'after' ? 'after' : config.position === 'before' ? 'before' : activeCurrency.position,
    };
};

export const getCurrencyConfig = () => activeCurrency;

export const currency = (value, symbol = activeCurrency.symbol) => {
    const amount = Number(value || 0);
    const formatted = amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return activeCurrency.position === 'after' ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
};

export const money = (cents, symbol = activeCurrency.symbol) => currency((Number(cents || 0) / 100), symbol);

export const toCents = (value) => Math.round(Number(value || 0) * 100);

export const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

export const titleCase = (value = '') => String(value).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Mirrors OrderService::CANCEL_WINDOW_HOURS — paid or unpaid orders can be cancelled within this window. */
export const ORDER_CANCEL_WINDOW_HOURS = 24;

export const canCancelOrder = (order) => {
    if (!order || ['cancelled', 'refunded'].includes(order.status)) return false;
    const placedAt = new Date(order.ordered_at || order.created_at);
    if (Number.isNaN(placedAt.getTime())) return false;
    return Date.now() - placedAt.getTime() < ORDER_CANCEL_WINDOW_HOURS * 3600 * 1000;
};

export const isOrderPaid = (order) => Boolean(order?.sale) || ['paid', 'partially_paid'].includes(order?.payment_status);
