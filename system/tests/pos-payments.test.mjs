import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInitialPayments } from '../resources/js/features/pos/utils/payments.js';
import { money, toCents } from '../resources/js/features/pos/utils/cart.js';

const methods = [{ id: 1, code: 'cash' }, { id: 2, code: 'card' }];

test('checkout honors the selected method with the full amount', () => {
    assert.deepEqual(buildInitialPayments(methods, '2', 204899), [
        { payment_method_id: 2, amount: '2048.99', reference: '' },
    ]);
});

test('split checkout preserves every paisa for an odd total', () => {
    const payments = buildInitialPayments(methods, 2, 204899, true);
    assert.equal(payments.length, 2);
    assert.equal(payments[0].payment_method_id, 2);
    assert.equal(payments[1].payment_method_id, 1);
    assert.equal(payments.reduce((sum, payment) => sum + toCents(payment.amount), 0), 204899);
});

test('an unavailable selected method falls back to an available method', () => {
    assert.equal(buildInitialPayments([methods[0]], 2, 10000)[0].payment_method_id, 1);
    assert.deepEqual(buildInitialPayments([], 2, 10000), []);
});

test('single-method and tiny-total split checkouts have no zero-value rows', () => {
    assert.equal(buildInitialPayments([methods[0]], 1, 10000, true).length, 2);
    assert.deepEqual(buildInitialPayments(methods, 1, 1, true), [
        { payment_method_id: 1, amount: '0.01', reference: '' },
    ]);
});

test('POS currency is displayed in Rs with two decimal places', () => {
    assert.equal(money(204899), 'Rs 2,048.99');
    assert.equal(money(0), 'Rs 0.00');
});
