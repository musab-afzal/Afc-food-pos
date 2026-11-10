const orderTypes = ['dine_in', 'takeaway', 'delivery'];

export function emptyOrderDraft() {
    return {
        cart: [], customerId: '', selectedCustomer: null, discountTotal: 0,
        couponCode: '', couponDiscount: 0, loyaltyPoints: 0, orderNotes: '',
        deliveryName: '', deliveryAddress: '', deliveryPhone: '',
        processingMinutes: '', customSlipMessage: '', paymentStatus: 'paid',
        holdId: null, selectedPaymentMethod: '',
        staffMealMode: false, staffId: '', selectedStaff: null,
    };
}

export function orderDraftKey(orderType, tableId = '') {
    return orderType === 'dine_in' ? `table:${tableId || 'unassigned'}` : orderType;
}

function snapshot(state) {
    return Object.fromEntries(Object.keys(emptyOrderDraft()).map((key) => [key, state[key]]));
}

function resetOrderUi() {
    return {
        customerQuery: '', customerHits: [], payments: [], paymentOpen: false,
        checkoutError: '', customizing: null, editingKey: null, discountOpen: false,
        customerModalOpen: false, clearConfirm: false, orderDetailsOpen: false,
    };
}

export function activeOrderKey(state) {
    return orderDraftKey(state.orderType, state.tableId);
}

function saveActiveDraft(state) {
    return { ...state, orderDrafts: { ...state.orderDrafts, [activeOrderKey(state)]: snapshot(state) } };
}

function switchOrder(state, payload) {
    const orderType = payload.orderType ?? state.orderType;
    const tableId = orderType === 'dine_in'
        ? String(payload.tableId ?? (state.orderType === 'dine_in' ? state.tableId : state.lastDineInTableId) ?? '')
        : '';
    const saved = saveActiveDraft(state);
    const key = orderDraftKey(orderType, tableId);
    return {
        ...saved,
        ...resetOrderUi(),
        ...emptyOrderDraft(),
        ...saved.orderDrafts[key],
        orderType,
        tableId,
        lastDineInTableId: orderType === 'dine_in' ? tableId : state.lastDineInTableId,
    };
}

export function reduceOrderDrafts(state, action) {
    if (action.type === 'forget_hold') {
        const orderDrafts = Object.fromEntries(Object.entries(state.orderDrafts || {}).map(([key, draft]) => [key, draft.holdId === action.holdId ? { ...draft, holdId: null } : draft]));
        return { ...state, orderDrafts, holdId: state.holdId === action.holdId ? null : state.holdId };
    }
    if (action.type === 'reset_cart') {
        const key = action.orderKey || activeOrderKey(state);
        const orderDrafts = { ...state.orderDrafts, [key]: emptyOrderDraft() };
        if (key !== activeOrderKey(state)) return { ...state, orderDrafts };
        return { ...state, ...emptyOrderDraft(), ...resetOrderUi(), orderDrafts, paying: false };
    }

    if (action.type === 'resume_order') {
        if (state.paying || state.holding) return state;
        const next = switchOrder(state, action.payload);
        const incoming = action.payload;
        if (next.cart.length && next.holdId !== incoming.holdId) {
            return { ...state, notice: 'This table or order type already has a cart. Hold or clear that cart before resuming another order.', noticeTone: 'error' };
        }
        // Resuming the same held order must retain edits already made in its draft.
        if (next.cart.length && next.holdId === incoming.holdId) return { ...next, holdsOpen: false };
        return saveActiveDraft({ ...next, ...incoming, tableId: next.tableId, holdsOpen: false });
    }

    if (action.type !== 'patch') return state;
    const payload = action.payload;
    const changesDraft = Object.keys(emptyOrderDraft()).some((key) => key in payload && payload[key] !== state[key]);
    if ((state.holding || state.paying) && changesDraft) return state;
    const changesOrder = ('orderType' in payload || 'tableId' in payload)
        && (payload.orderType !== undefined && payload.orderType !== state.orderType
            || payload.tableId !== undefined && String(payload.tableId) !== String(state.tableId));
    if (changesOrder && (state.paying || state.holding)) return state;
    const next = changesOrder ? switchOrder(state, payload) : state;
    const patched = { ...next, ...payload };
    patched.tableId = patched.orderType === 'dine_in' ? String(patched.tableId || '') : '';
    if (patched.orderType === 'dine_in') patched.lastDineInTableId = patched.tableId;
    return changesOrder || changesDraft ? saveActiveDraft(patched) : patched;
}

export function serializeOrderDrafts(state) {
    return JSON.stringify({
        version: 1,
        orderType: state.orderType,
        tableId: state.tableId,
        lastDineInTableId: state.lastDineInTableId || '',
        orderDrafts: saveActiveDraft(state).orderDrafts,
    });
}

export function restoreOrderDrafts(initialState, serialized) {
    try {
        const saved = JSON.parse(serialized);
        if (saved?.version !== 1 || !orderTypes.includes(saved.orderType) || !saved.orderDrafts || typeof saved.orderDrafts !== 'object') return initialState;
        const drafts = {};
        for (const [key, draft] of Object.entries(saved.orderDrafts)) {
            if (!/^(table:(\d+|unassigned)|takeaway|delivery)$/.test(key) || !Array.isArray(draft?.cart)) continue;
            if (draft.cart.some((item) => !item?.dish?.id || !item.key || !Array.isArray(item.addons) || !Number.isFinite(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitCents))) continue;
            drafts[key] = { ...emptyOrderDraft(), ...snapshot({ ...emptyOrderDraft(), ...draft }) };
        }
        const tableId = saved.orderType === 'dine_in' ? String(saved.tableId || '') : '';
        return {
            ...initialState,
            ...emptyOrderDraft(),
            ...drafts[orderDraftKey(saved.orderType, tableId)],
            orderType: saved.orderType,
            tableId,
            lastDineInTableId: String(saved.lastDineInTableId || ''),
            orderDrafts: drafts,
            draftsRestored: true,
        };
    } catch { return initialState; }
}
