import assert from 'node:assert/strict';
import test from 'node:test';
import { activeOrderKey, emptyOrderDraft, reduceOrderDrafts, restoreOrderDrafts, serializeOrderDrafts } from '../resources/js/features/pos/utils/orderDrafts.js';
import { buildCartItem, cartPayloadFromState, computeTotals } from '../resources/js/features/pos/utils/cart.js';

const burger = { id: 1, name: 'Burger', price: 500, addons: [{ id: 7, name: 'Cheese', price: 50 }] };
const cola = { id: 2, name: 'Cola', price: 180, addons: [] };
const initial = () => ({ ...emptyOrderDraft(), orderType: 'dine_in', tableId: '', lastDineInTableId: '', orderDrafts: {}, paying: false, holding: false });
const patch = (state, payload) => reduceOrderDrafts(state, { type: 'patch', payload });
const table = (state, id) => patch(state, { tableId: String(id) });

test('each table starts empty and restores its own items after repeated switches', () => {
    let state = table(initial(), 1);
    const customized = buildCartItem(burger, { id: 3, name: 'Large', price: 650 }, [7], 2, 'No onions');
    state = patch(state, { cart: [customized], orderNotes: 'Guests: 3\nBirthday table', discountTotal: 100, customerId: '9', selectedCustomer: { id: 9, name: 'Customer' } });
    state = table(state, 2);
    assert.deepEqual(state.cart, []);
    assert.equal(state.discountTotal, 0);
    assert.equal(state.customerId, '');
    assert.equal(state.orderNotes, '');
    state = patch(state, { cart: [buildCartItem(cola, null, [], 3)] });
    state = table(state, 1);
    assert.deepEqual(state.cart, [customized]);
    assert.equal(state.discountTotal, 100);
    assert.equal(state.customerId, '9');
    assert.equal(state.orderNotes, 'Guests: 3\nBirthday table');
    const payload = cartPayloadFromState(state);
    assert.equal(payload.restaurant_table_id, 1);
    assert.deepEqual(payload.items[0].addon_ids, [7]);
    assert.equal(payload.items[0].dish_variant_id, 3);
    assert.equal(computeTotals(state).total, 130000);
    state = table(state, 2);
    assert.equal(state.cart[0].dish.id, 2);
    assert.equal(state.cart[0].quantity, 3);
    assert.equal(computeTotals(state).total, 54000);
});

test('editing and clearing a table cannot change another table', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)] });
    state = patch(table(state, 2), { cart: [buildCartItem(cola)] });
    state = table(state, 1);
    state = patch(state, { cart: state.cart.map((item) => ({ ...item, quantity: 4 })) });
    state = reduceOrderDrafts(state, { type: 'reset_cart' });
    assert.deepEqual(table(state, 1).cart, []);
    assert.equal(table(state, 2).cart[0].quantity, 1);
});

test('takeaway and delivery drafts stay separate and dine-in restores the last table', () => {
    let state = patch(table(initial(), 7), { cart: [buildCartItem(burger)] });
    state = patch(state, { orderType: 'takeaway' });
    assert.deepEqual(state.cart, []);
    assert.equal(state.tableId, '');
    state = patch(state, { cart: [buildCartItem(cola)] });
    state = patch(state, { orderType: 'delivery' });
    assert.deepEqual(state.cart, []);
    state = patch(state, { orderType: 'dine_in' });
    assert.equal(state.tableId, '7');
    assert.equal(state.cart[0].dish.id, 1);
    assert.equal(patch(state, { orderType: 'takeaway' }).cart[0].dish.id, 2);
});

test('refresh restores all table drafts, but no open checkout or entered payment', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)], couponCode: 'SAVE', couponDiscount: 25 });
    state = patch(table(state, 2), { cart: [buildCartItem(cola)], paymentOpen: true, payments: [{ amount: 1000 }], customerHits: [{ id: 2 }] });
    const restored = restoreOrderDrafts({ ...initial(), paymentOpen: false, payments: [], customerHits: [] }, serializeOrderDrafts(state));
    assert.equal(restored.tableId, '2');
    assert.equal(restored.cart[0].dish.id, 2);
    assert.equal(restored.paymentOpen, false);
    assert.deepEqual(restored.payments, []);
    assert.deepEqual(restored.customerHits, []);
    assert.equal(table(restored, 1).couponCode, 'SAVE');
    assert.equal(table(restored, 1).couponDiscount, 25);
    assert.equal(restored.draftsRestored, true);
});

test('a completed or held order clears its originating table only', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)] });
    const orderKey = activeOrderKey(state);
    state = patch(table(state, 2), { cart: [buildCartItem(cola)] });
    state = reduceOrderDrafts(state, { type: 'reset_cart', orderKey });
    assert.equal(state.tableId, '2');
    assert.equal(state.cart[0].dish.id, 2);
    assert.deepEqual(table(state, 1).cart, []);
});

test('table switching resets transient customization, search and checkout state', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)], customizing: { dish: burger }, editingKey: 'old', paymentOpen: true, payments: [{ amount: 500 }], customerQuery: 'Alice', customerHits: [{ id: 1 }], clearConfirm: true });
    state = table(state, 2);
    assert.equal(state.customizing, null);
    assert.equal(state.editingKey, null);
    assert.equal(state.paymentOpen, false);
    assert.deepEqual(state.payments, []);
    assert.equal(state.customerQuery, '');
    assert.deepEqual(state.customerHits, []);
    assert.equal(state.clearConfirm, false);
});

test('table and item changes are blocked while a sale or hold is processing', () => {
    for (const flag of ['paying', 'holding']) {
        const state = patch(patch(table(initial(), 1), { cart: [buildCartItem(burger)] }), { [flag]: true });
        assert.equal(table(state, 2), state);
        assert.equal(patch(state, { cart: [] }), state);
    }
});

test('resuming a held order preserves the outgoing table and refuses a conflicting destination cart', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)] });
    const incoming = { ...emptyOrderDraft(), cart: [buildCartItem(cola)], orderType: 'dine_in', tableId: '2', holdId: 8 };
    state = reduceOrderDrafts(state, { type: 'resume_order', payload: incoming });
    assert.equal(state.holdId, 8);
    assert.equal(table(state, 1).cart[0].dish.id, 1);
    state = reduceOrderDrafts(state, { type: 'resume_order', payload: { ...incoming, tableId: '1', holdId: 9 } });
    assert.equal(state.tableId, '2');
    assert.equal(state.noticeTone, 'error');
    assert.equal(table(state, 1).cart[0].dish.id, 1);
});

test('deleting a held order removes its link from inactive table drafts', () => {
    let state = patch(table(initial(), 1), { cart: [buildCartItem(burger)], holdId: 8 });
    state = table(state, 2);
    state = reduceOrderDrafts(state, { type: 'forget_hold', holdId: 8 });
    assert.equal(table(state, 1).holdId, null);
    assert.equal(table(state, 1).cart.length, 1);
});

test('invalid browser storage is ignored without breaking POS startup', () => {
    const state = initial();
    assert.equal(restoreOrderDrafts(state, 'invalid json'), state);
    assert.equal(restoreOrderDrafts(state, '{"version":9}'), state);
    const restored = restoreOrderDrafts(state, JSON.stringify({ version: 1, orderType: 'dine_in', tableId: '1', orderDrafts: { 'table:1': { cart: [null] } } }));
    assert.deepEqual(restored.cart, []);
});
