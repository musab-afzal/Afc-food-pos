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
