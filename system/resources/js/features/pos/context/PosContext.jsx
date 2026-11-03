import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { cacheCatalog, getCachedCatalog, markSync, pendingQueue, saveOfflineSale } from '../../../services/database.js';
import { syncPending } from '../../../services/sync.js';
import { api } from '../../../services/api.js';
import { setCurrencyConfig } from '../../../utils/format.js';
import { printReceiptDocument } from '../../../utils/receiptTemplate.js';
import { posApi } from '../services/posApi.js';
import { buildInitialPayments } from '../utils/payments.js';
import { activeOrderKey, reduceOrderDrafts, restoreOrderDrafts, serializeOrderDrafts } from '../utils/orderDrafts.js';
import {
    buildCartItem, buildDealCartItem, cartItemLabel, cartPayloadFromState, computeTotals, dealPayload, lineKey, money, restoreCartItems, restoreDealItems, toCents,
} from '../utils/cart.js';

const PosContext = createContext(null);

const initialState = {
    catalog: null,
    loading: true,
    loadError: '',
    categoryId: 'all',
    query: '',
    cart: [],
    orderType: 'takeaway',
    tableId: '',
    customerId: '',
    selectedCustomer: null,
    customerQuery: '',
    customerHits: [],
    discountTotal: 0,
    couponCode: '',
    couponDiscount: 0,
    loyaltyPoints: 0,
    orderNotes: '',
    deliveryName: '',
    deliveryAddress: '',
    deliveryPhone: '',
    processingMinutes: '',
    customSlipMessage: '',
    paymentStatus: 'paid',
    holdId: null,
    holds: [],
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    sync: { state: 'idle', pending: 0 },
    register: null,
    notice: '',
    noticeTone: 'info',
    customizing: null,
    editingKey: null,
    paymentOpen: false,
    payments: [],
    selectedPaymentMethod: '',
    paying: false,
    checkoutError: '',
    discountOpen: false,
    holdsOpen: false,
    recentOpen: false,
    recentSales: [],
    recentLoading: false,
    tablePickerOpen: false,
    customerModalOpen: false,
    catsOpen: false,
    success: null,
    clearConfirm: false,
    orderDrafts: {},
    lastDineInTableId: '',
    draftsRestored: false,
    holding: false,
};

function makeUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch { /* insecure context */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function printPosReceipt(sale, cartItems, user, settings = {}, extras = {}) {
    printReceiptDocument(sale, {
        settings,
        user,
        cartItems,
        title: 'RECEIPT',
        ...extras,
    });
}

const PAYMENT_STATUSES = ['paid', 'unpaid', 'pending'];

async function apiSaleReceipt(saleId) {
    return api(`/sales/${saleId}/receipt`);
}

export function PosProvider({ children }) {
    const { user, can, logout } = useAuth();
    const draftStorageKey = `afc-pos-drafts-v1:${user?.id || 'guest'}`;
    const [state, dispatch] = useReducer(reduceOrderDrafts, initialState, (initial) => {
        try { return restoreOrderDrafts(initial, sessionStorage.getItem(draftStorageKey)); }
        catch { return initial; }
    });
    const searchRef = useRef(null);
    const catalogReadyRef = useRef(false);
    const payingLockRef = useRef(false);
    const stateRef = useRef(state);
    const totalsRef = useRef(null);
    const patch = useCallback((payload) => dispatch({ type: 'patch', payload }), []);
    stateRef.current = state;

    useEffect(() => {
        try { sessionStorage.setItem(draftStorageKey, serializeOrderDrafts(state)); }
        catch { /* Drafts remain available in memory when browser storage is unavailable. */ }
    }, [draftStorageKey, state.orderDrafts, state.orderType, state.tableId]);

    const totals = useMemo(() => computeTotals({
        cart: state.cart,
        discountTotal: state.discountTotal,
        couponDiscount: state.couponDiscount,
        loyaltyPoints: state.loyaltyPoints,
        loyalty: state.catalog?.loyalty,
        taxes: state.catalog?.taxes,
        charges: state.catalog?.charges,
        orderType: state.orderType,
    }), [state.cart, state.discountTotal, state.couponDiscount, state.loyaltyPoints, state.catalog, state.orderType]);
    totalsRef.current = totals;

    const catalogAddons = useMemo(() => {
        if (Array.isArray(state.catalog?.addons) && state.catalog.addons.length) {
            return state.catalog.addons.filter((addon) => addon.is_active !== false);
        }
        const unique = new globalThis.Map();
        (state.catalog?.dishes || []).forEach((dish) => {
            (dish.addons || []).forEach((addon) => {
                if (!unique.has(addon.id)) unique.set(addon.id, addon);
            });
        });
        return [...unique.values()];
    }, [state.catalog]);

    const filteredDishes = useMemo(() => {
        if (state.categoryId === 'addons' || state.categoryId === 'deals') return [];
        const q = state.query.trim().toLowerCase();
        return (state.catalog?.dishes || []).filter((dish) => {
            if (state.categoryId !== 'all' && dish.category_id !== state.categoryId) return false;
            if (!q) return true;
            return `${dish.name} ${dish.sku || ''} ${dish.barcode || ''}`.toLowerCase().includes(q);
        });
    }, [state.catalog, state.categoryId, state.query]);

    const filteredDeals = useMemo(() => {
        if (state.categoryId !== 'all' && state.categoryId !== 'deals') return [];
        const q = state.query.trim().toLowerCase();
        return (state.catalog?.deals || []).filter((deal) => !q || `${deal.name} ${deal.description || ''}`.toLowerCase().includes(q));
    }, [state.catalog, state.categoryId, state.query]);

    const filteredAddons = useMemo(() => {
        if (state.categoryId !== 'addons' && state.categoryId !== 'all') return [];
        // On "All Items" keep the grid focused on dishes/deals; add-ons live in their own category.
        if (state.categoryId === 'all') return [];
        const q = state.query.trim().toLowerCase();
        return catalogAddons.filter((addon) => !q || String(addon.name || '').toLowerCase().includes(q));
    }, [catalogAddons, state.categoryId, state.query]);

    const categoryCounts = useMemo(() => {
        const counts = {
            all: (state.catalog?.dishes || []).length,
            deals: (state.catalog?.deals || []).length,
            addons: catalogAddons.length,
        };
        (state.catalog?.dishes || []).forEach((dish) => {
            counts[dish.category_id] = (counts[dish.category_id] || 0) + 1;
        });
        return counts;
    }, [state.catalog, catalogAddons]);

    const loadCatalog = useCallback(async () => {
        patch({ loading: true, loadError: '' });
        try {
            const response = await posApi.catalog();
            const catalog = response.data;
            setCurrencyConfig({
                code: catalog.settings?.currency_code,
                symbol: catalog.settings?.currency_symbol,
                position: catalog.settings?.currency_position,
            });
            await cacheCatalog(catalog);
            const firstLoad = !catalogReadyRef.current;
            catalogReadyRef.current = true;
            patch({
                catalog,
                ...(firstLoad && !stateRef.current.draftsRestored ? { orderType: catalog.settings?.default_order_type || 'takeaway' } : {}),
                loading: false,
            });
        } catch {
            const cached = await getCachedCatalog();
            if (cached) {
                setCurrencyConfig({
                    code: cached.settings?.currency_code,
                    symbol: cached.settings?.currency_symbol,
                    position: cached.settings?.currency_position,
                });
                const firstLoad = !catalogReadyRef.current;
                catalogReadyRef.current = true;
                patch({
                    catalog: cached,
                    ...(firstLoad && !stateRef.current.draftsRestored ? { orderType: cached.settings?.default_order_type || 'takeaway' } : {}),
                    loading: false,
                });
            } else {
                patch({ loading: false, loadError: 'Unable to load products.' });
            }
        }
        const queue = await pendingQueue();
        patch({ sync: { state: 'idle', pending: queue.length } });
    }, [patch]);

    const loadHolds = useCallback(async () => {
        if (!can('pos.hold_order') || !navigator.onLine) return;
        try {
            const response = await posApi.holds();
            patch({ holds: response.data || [] });
        } catch { /* offline / permission */ }
    }, [can, patch]);

    const loadRegister = useCallback(async () => {
        if (!navigator.onLine) return;
        try {
            const response = await posApi.currentRegister();
            patch({ register: response.data || null });
        } catch { /* optional */ }
    }, [patch]);

    useEffect(() => {
        loadCatalog();
        loadHolds();
        loadRegister();
    }, [loadCatalog, loadHolds, loadRegister]);

    useEffect(() => {
        const onOnline = () => {
            patch({ online: true });
            syncPending((updater) => {
                if (typeof updater === 'function') {
                    patch({ sync: updater({ state: 'idle', pending: 0 }) });
                } else if (updater && typeof updater === 'object') {
                    patch({ sync: updater });
                }
            });
        };
        const onOffline = () => patch({ online: false });
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
    }, [patch]);

    useEffect(() => {
        let cancelled = false;
        if (!state.customerQuery || state.customerQuery.length < 2 || !state.online) {
            patch({ customerHits: [] });
            return undefined;
        }
        const timer = setTimeout(() => {
            posApi.searchCustomers(state.customerQuery)
                .then((r) => { if (!cancelled) patch({ customerHits: r.data || [] }); })
                .catch(() => { if (!cancelled) patch({ customerHits: [] }); });
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [state.customerQuery, state.online, state.orderType, state.tableId, patch]);

    const notify = useCallback((notice, noticeTone = 'info') => patch({ notice, noticeTone }), [patch]);

    const addOrMergeItem = useCallback((item) => {
        patch({
            cart: (() => {
                const existing = state.cart.find((row) => row.key === item.key);
                if (existing) {
                    return state.cart.map((row) => row.key === item.key
                        ? { ...row, quantity: row.quantity + item.quantity }
                        : row);
                }
                return [...state.cart, item];
            })(),
            customizing: null,
            editingKey: null,
        });
    }, [patch, state.cart]);

    const chooseDish = useCallback((dish) => {
        if (dish.is_available === false) return;
        if (state.orderType === 'dine_in' && !state.tableId) {
            notify('Select a table before adding dine-in items.', 'info');
            patch({ tablePickerOpen: true });
            return;
        }
        if ((dish.variants || []).length || (dish.addons || []).length) {
            patch({ customizing: { dish, variant: null, addonIds: [], quantity: 1, notes: '' }, editingKey: null });
            return;
        }
        addOrMergeItem(buildCartItem(dish));
    }, [addOrMergeItem, patch, state.orderType, state.tableId, notify]);

    const chooseDeal = useCallback((deal) => {
        if (state.orderType === 'dine_in' && !state.tableId) {
            notify('Select a table before adding dine-in items.', 'info');
            patch({ tablePickerOpen: true });
            return;
        }
        addOrMergeItem(buildDealCartItem(deal));
    }, [addOrMergeItem, patch, state.orderType, state.tableId, notify]);

    const handleBarcodeEnter = useCallback(() => {
        const q = state.query.trim();
        if (!q) return;
        const dishes = state.catalog?.dishes || [];
        const match = dishes.find((d) => String(d.barcode || '') === q || String(d.sku || '').toLowerCase() === q.toLowerCase());
        if (!match) return;
        patch({ query: '' });
        chooseDish(match);
    }, [state.query, state.catalog, chooseDish, patch]);

    const saveCustomized = useCallback((payload) => {
        const { dish, variant, addonIds, quantity, notes } = payload;
        const item = buildCartItem(dish, variant, addonIds, quantity, notes);
        if (state.editingKey) {
            patch({
                cart: state.cart.map((row) => (row.key === state.editingKey ? item : row)),
                customizing: null,
                editingKey: null,
            });
            return;
        }
        addOrMergeItem(item);
    }, [addOrMergeItem, patch, state.cart, state.editingKey]);

    /** Add one cart line per selected variation so different prices stay separate. */
    const addVariantLines = useCallback((payload) => {
        const { dish, lines = [], addonIds = [], notes = '' } = payload;
        let nextCart = [...stateRef.current.cart];
        lines.forEach(({ variant, quantity }) => {
            if (!variant || Number(quantity) < 1) return;
            const item = buildCartItem(dish, variant, addonIds, quantity, notes);
            const existing = nextCart.find((row) => row.key === item.key);
            nextCart = existing
                ? nextCart.map((row) => (row.key === item.key ? { ...row, quantity: row.quantity + item.quantity } : row))
                : [...nextCart, item];
        });
        patch({ cart: nextCart, customizing: null, editingKey: null });
    }, [patch]);

    const changeQuantity = useCallback((key, amount) => {
        patch({
            cart: state.cart
                .map((item) => item.key === key ? { ...item, quantity: item.quantity + amount } : item)
                .filter((item) => item.quantity > 0),
        });
    }, [patch, state.cart]);

    const removeItem = useCallback((key) => {
        patch({ cart: state.cart.filter((item) => item.key !== key) });
    }, [patch, state.cart]);

    /** Adds an add-on to the most recently added cart line and re-prices that line. */
    const addAddonToLastItem = useCallback((addon) => {
        const cart = stateRef.current.cart;
        if (!cart.length) { notify('Add a dish to the cart first.', 'info'); return false; }
        const last = cart[cart.length - 1];
        if (last.isDeal) { notify('Add-ons cannot be added to a deal.', 'error'); return false; }
        if (last.addons.some((existing) => Number(existing.id) === Number(addon.id))) {
            notify(`${addon.name} is already on ${last.dish.name}.`, 'info');
            return false;
        }
        const addons = [...last.addons, { id: addon.id, name: addon.name, price: addon.price }];
        const key = lineKey(last.dish.id, last.variant?.id, addons.map((a) => a.id), last.notes);
        const updated = { ...last, addons, key, unitCents: last.unitCents + toCents(addon.price) };
        const rest = cart.slice(0, -1);
        const twin = rest.find((row) => row.key === key);
        patch({
            cart: twin
                ? rest.map((row) => (row === twin ? { ...row, quantity: row.quantity + updated.quantity } : row))
                : [...rest, updated],
        });
        notify(`${addon.name} added to ${last.dish.name}`, 'success');
        return true;
    }, [patch, notify]);

    const editItem = useCallback((item) => {
        if (item.isDeal) return;
        patch({
            editingKey: item.key,
            customizing: {
                dish: item.dish,
                variant: item.variant,
                addonIds: item.addons.map((a) => a.id),
                quantity: item.quantity,
                notes: item.notes || '',
            },
        });
    }, [patch]);

    const applyCoupon = useCallback(async () => {
        const orderKey = activeOrderKey(state);
        if (!state.couponCode.trim()) {
            patch({ couponDiscount: 0 });
            return;
        }
        try {
            const response = await posApi.validateCoupon({
                code: state.couponCode.trim(),
                order_total: Math.max(0, (totals.subtotal - toCents(state.discountTotal)) / 100),
                customer_id: state.customerId ? Number(state.customerId) : null,
            });
            if (activeOrderKey(stateRef.current) !== orderKey || stateRef.current.couponCode !== state.couponCode) return;
            patch({ couponDiscount: Number(response.data.discount_amount || 0) });
            notify(`Coupon applied · ${money(toCents(response.data.discount_amount))}`, 'success');
        } catch (error) {
            if (activeOrderKey(stateRef.current) !== orderKey) return;
            patch({ couponDiscount: 0 });
            notify(error.message, 'error');
        }
    }, [state.couponCode, state.discountTotal, state.customerId, state.orderType, state.tableId, totals.subtotal, patch, notify]);

    const holdOrder = useCallback(async (holdNotes = null) => {
        if (!state.cart.length || stateRef.current.holding || stateRef.current.paying) return;
        if (!state.online) { notify('Hold orders require an online connection.', 'error'); return; }
        const orderKey = activeOrderKey(state);
        patch({ holding: true });
        try {
            const body = {
                uuid: crypto.randomUUID(),
                order_type: state.orderType,
                restaurant_table_id: state.orderType === 'dine_in' ? Number(state.tableId) || null : null,
                notes: holdNotes || state.orderNotes || null,
                payload: cartPayloadFromState(state),
            };
            if (state.holdId) await posApi.updateHold(state.holdId, body);
            else await posApi.createHold(body);
            dispatch({ type: 'reset_cart', orderKey });
            notify('Order held. Resume anytime from Held orders.', 'success');
            loadHolds();
        } catch (error) {
            notify(error.message, 'error');
        } finally {
            patch({ holding: false });
        }
    }, [state, notify, loadHolds]);

    const resumeHold = useCallback((hold) => {
        const payload = hold.payload || {};
        const items = [
            ...restoreCartItems(payload.items, state.catalog?.dishes || []),
            ...restoreDealItems(payload.deals, state.catalog?.deals || []),
        ];
        dispatch({ type: 'resume_order', payload: {
            cart: items,
            orderType: hold.order_type || payload.order_type || 'takeaway',
            tableId: String(hold.restaurant_table_id || payload.restaurant_table_id || ''),
            customerId: String(payload.customer_id || ''),
            selectedCustomer: null,
            discountTotal: payload.discount_total || 0,
            couponCode: payload.coupon_code || '',
            couponDiscount: 0,
            loyaltyPoints: payload.loyalty_points || 0,
            orderNotes: payload.notes || hold.notes || '',
            deliveryName: payload.delivery_name || '',
            deliveryAddress: payload.delivery_address || '',
            deliveryPhone: payload.delivery_phone || '',
            processingMinutes: payload.processing_minutes ?? '',
            customSlipMessage: payload.custom_slip_message || '',
            paymentStatus: PAYMENT_STATUSES.includes(payload.payment_status) ? payload.payment_status : 'paid',
            holdId: hold.id,
            holdsOpen: false,
        } });
    }, [patch, state.catalog, notify]);

    const deleteHold = useCallback(async (id) => {
        try {
            await posApi.deleteHold(id);
            dispatch({ type: 'forget_hold', holdId: id });
            loadHolds();
        } catch (error) {
            notify(error.message, 'error');
        }
    }, [state.holdId, patch, loadHolds, notify]);

    const openPayment = useCallback((options = {}) => {
        if (stateRef.current.holding || stateRef.current.paying) return;
        if (!state.cart.length) return;
        if (state.orderType === 'dine_in' && !state.tableId) {
            notify('Select a table for dine-in.', 'error');
            patch({ tablePickerOpen: true });
            return;
        }
        if (state.catalog?.settings?.require_customer && !state.customerId) {
            notify('A customer is required for this sale.', 'error');
            patch({ orderDetailsOpen: true });
            return;
        }
        const methods = (state.catalog?.payment_methods || []).filter((method) => state.online || method.works_offline);
        const payments = buildInitialPayments(methods, state.selectedPaymentMethod, totals.total, options.split);
        if (!payments.length) {
            notify('No payment methods are available for this connection.', 'error');
            return;
        }
        payingLockRef.current = false;
        patch({
            paymentOpen: true,
            paying: false,
            checkoutError: '',
            payments,
        });
    }, [state, totals.total, notify, patch]);

    const completeSale = useCallback(async (options = {}) => {
        if (payingLockRef.current) {
            patch({ checkoutError: 'Sale is already processing…' });
            return false;
        }

        const current = stateRef.current;
        const currentTotals = totalsRef.current || { total: 0 };
        const methods = (current.catalog?.payment_methods || []).filter((m) => current.online || m.works_offline);
        const requestedStatus = options?.paymentStatus ?? current.paymentStatus;
        const paymentStatus = PAYMENT_STATUSES.includes(requestedStatus) ? requestedStatus : 'paid';
        const deferred = paymentStatus !== 'paid';
        // Unpaid / pending sales are recorded with nothing collected now.
        const salePayments = deferred
            ? (current.payments || []).slice(0, 1).map((payment) => ({ ...payment, amount: '0' }))
            : (current.payments || []);
        const paid = salePayments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
        const due = Math.round(Number(currentTotals.total) || 0);
        const processing = String(current.processingMinutes ?? '').trim();
        const processingMinutes = processing !== '' && Number.isFinite(Number(processing)) ? Math.max(0, Math.round(Number(processing))) : null;
        const isDelivery = current.orderType === 'delivery';
        const receiptExtras = {
            deliveryName: isDelivery ? String(current.deliveryName || '').trim() : '',
            deliveryAddress: isDelivery ? String(current.deliveryAddress || '').trim() : '',
            deliveryPhone: isDelivery ? String(current.deliveryPhone || '').trim() : '',
            processingMinutes,
            customSlipMessage: String(current.customSlipMessage || '').trim(),
            paymentStatus,
        };

        const fail = (message) => {
            patch({ checkoutError: message, paying: false });
            payingLockRef.current = false;
            return false;
        };

        if (!current.cart.length) return fail('Cart is empty.');
        if (current.orderType === 'dine_in' && !current.tableId) return fail('Select a table for dine-in.');
        if (!methods.length) return fail('No payment methods available. Check Settings → Payment methods.');
        if (!current.payments.length || current.payments.some((p) => !Number(p.payment_method_id))) {
            return fail('Choose a payment method.');
        }
        const missingRef = !deferred && current.payments.find((payment) => {
            const method = methods.find((m) => Number(m.id) === Number(payment.payment_method_id));
            return Boolean(method?.requires_reference) && !String(payment.reference || '').trim();
        });
        if (missingRef) {
            return fail('Enter the payment reference / transaction ID for card or wallet payments.');
        }
        if (!deferred && (!Number.isFinite(paid) || paid + 1 < due)) {
            return fail(`Payment is short by ${money(Math.max(0, due - (Number.isFinite(paid) ? paid : 0)))}.`);
        }

        const cartSnapshot = [...current.cart];
        const payload = {
            uuid: makeUuid(),
            order_type: current.orderType,
            restaurant_table_id: current.orderType === 'dine_in' ? Number(current.tableId) : null,
            customer_id: current.customerId ? Number(current.customerId) : null,
            notes: current.orderNotes || null,
            delivery_name: receiptExtras.deliveryName || null,
            delivery_address: receiptExtras.deliveryAddress || null,
            delivery_phone: receiptExtras.deliveryPhone || null,
            processing_minutes: processingMinutes,
            custom_slip_message: receiptExtras.customSlipMessage || null,
            payment_status: paymentStatus,
            was_offline: !current.online,
            discount_total: Number(current.discountTotal) || 0,
            coupon_code: String(current.couponCode || '').trim() || null,
            loyalty_points: Number(current.loyaltyPoints) || 0,
            deals: dealPayload(current.cart),
            items: current.cart.filter((item) => !item.isDeal).map((item) => ({
                dish_id: item.dish.id,
                dish_variant_id: item.variant?.id || null,
                quantity: item.quantity,
                discount: 0,
                notes: item.notes || null,
                addon_ids: (item.addons || []).map((addon) => addon.id),
            })),
            payments: salePayments.map((payment) => ({
                payment_method_id: Number(payment.payment_method_id),
                amount: Number(payment.amount),
                reference: payment.reference ? String(payment.reference) : null,
            })),
        };

        payingLockRef.current = true;
        patch({ paying: true, checkoutError: '' });

        try {
            try {
                await saveOfflineSale(payload);
            } catch (offlineError) {
                console.warn('Offline save failed', offlineError);
            }

            let receipt = {
                ...payload,
                items: cartSnapshot,
                invoice_number: `OFF-${String(payload.uuid).slice(0, 8).toUpperCase()}`,
                grand_total: (due / 100).toFixed(2),
                change_total: (Math.max(0, paid - due) / 100).toFixed(2),
                sold_at: new Date().toISOString(),
            };

            if (current.online) {
                const response = await posApi.createSale(payload);
                if (!response?.data) {
                    throw new Error('Sale API returned an empty response.');
                }
                receipt = response.data;
                try { await markSync(payload.uuid, 'synced'); } catch { /* ignore */ }
                if (current.holdId) {
                    try { await posApi.deleteHold(current.holdId); } catch { /* ignore */ }
                    loadHolds();
                }
            }

            let pending = 0;
            try {
                const queue = await pendingQueue();
                pending = queue.length;
            } catch { /* ignore */ }

            payingLockRef.current = false;
            patch({ sync: { state: 'idle', pending }, paying: false, paymentOpen: false, checkoutError: '' });

            const shouldPrint = current.catalog?.settings?.auto_print !== false;
            if (shouldPrint) {
                try {
                    let printSource = receipt;
                    if (current.online && receipt?.id) {
                        try {
                            const full = await apiSaleReceipt(receipt.id);
                            if (full?.data) printSource = full.data;
                        } catch { /* fall back to sale payload */ }
                    }
                    printPosReceipt(printSource, cartSnapshot, user, current.catalog?.settings, receiptExtras);
                } catch (printError) {
                    notify(`Sale saved, but print failed: ${printError.message}`, 'error');
                }
            }

            patch({
                success: {
                    invoice: receipt.invoice_number,
                    total: receipt.grand_total,
                    change: receipt.change_total,
                    saleId: receipt.id,
                    offline: !current.online,
                },
            });
            dispatch({ type: 'reset_cart', orderKey: activeOrderKey(current) });
            loadCatalog();
            return true;
        } catch (error) {
            console.error('POS checkout failed', error);
            try { await markSync(payload.uuid, 'failed', error.message); } catch { /* ignore */ }
            payingLockRef.current = false;
            const message = error?.message || 'Sale could not be completed.';
            patch({ paying: false, checkoutError: message });
            notify(`Sale not completed: ${message}`, 'error');
            return false;
        }
    }, [user, patch, notify, loadHolds, loadCatalog]);

    const loadRecent = useCallback(async () => {
        patch({ recentOpen: true, recentLoading: true });
        try {
            const response = await posApi.recentSales();
            patch({ recentSales: response.data || [], recentLoading: false });
        } catch (error) {
            patch({ recentLoading: false });
            notify(error.message, 'error');
        }
    }, [patch, notify]);

    const createCustomer = useCallback(async (form) => {
        const orderKey = activeOrderKey(stateRef.current);
        const response = await posApi.createCustomer({
            ...form,
            is_active: true,
            email: form.email || null,
            phone: form.phone || null,
            address: form.address || null,
        });
        const customer = response.data;
        if (activeOrderKey(stateRef.current) !== orderKey) {
            notify(`Customer ${customer.name} added. Select them from the customer search when needed.`, 'success');
            return customer;
        }
        patch({
            selectedCustomer: customer,
            customerId: String(customer.id),
            customerQuery: '',
            customerHits: [],
            customerModalOpen: false,
        });
        notify(`Customer ${customer.name} added`, 'success');
        return customer;
    }, [patch, notify]);

    const clearCart = useCallback(() => {
        if (stateRef.current.holding || stateRef.current.paying) return;
        dispatch({ type: 'reset_cart' });
        patch({ clearConfirm: false });
        notify('Cart cleared', 'info');
    }, [patch, notify]);

    const value = {
        state, patch, totals, filteredDishes, filteredDeals, filteredAddons, catalogAddons, categoryCounts, user, can, logout, searchRef,
        loadCatalog, loadHolds, notify, chooseDish, chooseDeal, handleBarcodeEnter, saveCustomized, addVariantLines,
        changeQuantity, removeItem, addAddonToLastItem, editItem, applyCoupon, holdOrder, resumeHold, deleteHold,
        openPayment, completeSale, loadRecent, createCustomer, clearCart, printReceipt: printPosReceipt,
        lineKey, money, toCents, cartItemLabel,
    };

    return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
    const ctx = useContext(PosContext);
    if (!ctx) throw new Error('usePos must be used within PosProvider');
    return ctx;
}
