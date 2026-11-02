import { api } from '../../../services/api.js';

export const posApi = {
    catalog: () => api('/pos/catalog'),
    createSale: (payload) => api('/pos/sales', { method: 'POST', body: JSON.stringify(payload) }),
    holds: () => api('/pos/holds'),
    createHold: (body) => api('/pos/holds', { method: 'POST', body: JSON.stringify(body) }),
    updateHold: (id, body) => api(`/pos/holds/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteHold: (id) => api(`/pos/holds/${id}`, { method: 'DELETE' }),
    searchCustomers: (q) => api(`/customers?search=${encodeURIComponent(q)}&per_page=8`),
    createCustomer: (body) => api('/customers', { method: 'POST', body: JSON.stringify(body) }),
    validateCoupon: (body) => api('/coupons/validate', { method: 'POST', body: JSON.stringify(body) }),
    recentSales: () => {
        const today = new Date().toISOString().slice(0, 10);
        return api(`/sales?date_from=${today}&date_to=${today}&per_page=20`);
    },
    saleReceipt: (id) => api(`/sales/${id}/receipt`),
    currentRegister: () => api('/cash-registers/current').catch(() => ({ data: null })),
};
