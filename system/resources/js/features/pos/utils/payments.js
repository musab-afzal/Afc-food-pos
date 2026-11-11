/** Methods usable while offline (flag or cash by code/name). */
export function offlineCapableMethods(methods = []) {
    return (methods || []).filter((method) => {
        if (method?.works_offline) return true;
        const code = String(method?.code || '').toLowerCase();
        const name = String(method?.name || '').toLowerCase();
        return code === 'cash' || (name.includes('cash') && !name.includes('jazz'));
    });
}

export function availablePaymentMethods(methods = [], online = true) {
    return online ? (methods || []) : offlineCapableMethods(methods);
}

export function buildInitialPayments(methods, selectedId, totalCents, split = false) {
    const primary = methods.find((method) => Number(method.id) === Number(selectedId))
        || methods.find((method) => method.code === 'cash')
        || methods[0];
    if (!primary) return [];

    const total = Math.max(0, Math.round(Number(totalCents) || 0));
    const payment = (method, amount) => ({ payment_method_id: Number(method.id), amount: (amount / 100).toFixed(2), reference: '' });
    if (!split || total < 2) return [payment(primary, total)];

    const firstHalf = Math.floor(total / 2);
    const secondary = methods.find((method) => Number(method.id) !== Number(primary.id)) || primary;
    return [payment(primary, firstHalf), payment(secondary, total - firstHalf)];
}
