export const toCents = (value) => Math.round(Number(value || 0) * 100);
export const money = (cents) => `Rs ${((Number(cents) || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const moneyLabel = () => 'PKR';

export function removedIngredientKey(removedIngredients = []) {
    return [...removedIngredients]
        .map((row) => Number(row.id ?? row))
        .filter((id) => Number.isFinite(id))
        .sort((a, b) => a - b)
        .join(',');
}

export function composeItemNotes(notes = '', removedIngredients = []) {
    const removals = (removedIngredients || [])
        .map((row) => String(row.name || '').trim())
        .filter(Boolean)
        .map((name) => (name.toLowerCase().startsWith('no ') ? name : `No ${name}`))
        .join(', ');
    return [removals, String(notes || '').trim()].filter(Boolean).join(' · ');
}

export function lineKey(dishId, variantId, addonIds = [], notes = '', removedIngredients = []) {
    const addons = [...addonIds].map(Number).filter((id) => Number.isFinite(id)).sort((a, b) => a - b).join(',');
    const variantKey = variantId == null || variantId === '' ? 0 : Number(variantId);
    const removed = removedIngredientKey(removedIngredients);
    return `${Number(dishId)}:${Number.isFinite(variantKey) ? variantKey : 0}:${addons}:${removed}:${String(notes || '').trim().toLowerCase()}`;
}

export function cartItemLabel(item) {
    if (!item) return '';
    if (item.isDeal) return item.deal?.name || item.dish?.name || 'Deal';
    const name = item.dish?.name || 'Item';
    return item.variant?.name ? `${name} (${item.variant.name})` : name;
}

export function buildCartItem(dish, variant = null, addonIds = [], quantity = 1, notes = '', removedIngredients = []) {
    const selectedIds = [...addonIds].map(Number);
    const addons = (dish.addons || []).filter((addon) => selectedIds.includes(Number(addon.id)));
    const removed = (removedIngredients || [])
        .map((row) => ({ id: Number(row.id), name: String(row.name || '').trim() }))
        .filter((row) => Number.isFinite(row.id) && row.name);
    const basePrice = variant?.price ?? dish.price ?? dish.base_price;
    const unitCents = toCents(basePrice) + addons.reduce((sum, addon) => sum + toCents(addon.price), 0);
    return {
        key: lineKey(dish.id, variant?.id, selectedIds, notes, removed),
        dish,
        variant: variant || null,
        addons,
        removedIngredients: removed,
        quantity: Math.max(1, quantity),
        unitCents,
        tax_percent: Number(dish.tax_percent || 0),
        notes: notes || '',
    };
}

/** A deal sits in the cart as one line; the server expands it into its dishes. */
export function buildDealCartItem(deal, quantity = 1, notes = '') {
    return {
        key: `deal:${deal.id}:${String(notes || '').trim().toLowerCase()}`,
        isDeal: true,
        deal,
        dish: { id: `deal-${deal.id}`, name: deal.name, image: deal.components?.[0]?.image || null },
        variant: null,
        addons: [],
        removedIngredients: [],
        quantity: Math.max(1, quantity),
        unitCents: toCents(deal.price),
        tax_percent: 0,
        notes: notes || '',
    };
}

/** Mirrors PosSaleService: deal tax is charged per component on its share of the deal price. */
function lineTaxCents(item) {
    if (item.isDeal) {
        return (item.deal?.components || []).reduce(
            (sum, c) => sum + Math.round(Number(c.share_cents) * item.quantity * Number(c.tax_percent || 0) / 100),
            0,
        );
    }
    return Math.round(item.unitCents * item.quantity * Number(item.tax_percent) / 100);
}

export function dealPayload(cart) {
    return cart.filter((item) => item.isDeal).map((item) => ({
        deal_id: item.deal.id,
        quantity: item.quantity,
        notes: item.notes || null,
    }));
}

export function computeTotals({ cart, discountTotal, couponDiscount, loyaltyPoints, loyalty, taxes, charges, orderType }) {
    const subtotal = cart.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
    const lineTax = cart.reduce((sum, item) => sum + lineTaxCents(item), 0);
    const discountCents = toCents(discountTotal) + toCents(couponDiscount);
    const loyaltyDiscountCents = loyaltyPoints > 0 && loyalty?.redemption_value
        ? Math.round(Number(loyaltyPoints) * Number(loyalty.redemption_value) * 100)
        : 0;
    const netBase = Math.max(0, subtotal - discountCents - loyaltyDiscountCents);
    const settingsTaxRate = (taxes || []).filter((t) => t.is_active !== false && !t.is_inclusive)
        .reduce((sum, t) => sum + Number(t.percentage || 0), 0);
    const tax = lineTax > 0 ? lineTax : Math.round(netBase * settingsTaxRate / 100);
    const matching = (charges || []).filter((c) => c.is_active !== false && (c.apply_to === 'all' || c.apply_to === orderType));
    const chargeCents = (list) => list.reduce((sum, c) => {
        const type = c.type === 'percentage' ? 'percent' : c.type;
        return sum + (type === 'percent' ? Math.round(netBase * Number(c.value) / 100) : toCents(c.value));
    }, 0);
    const serviceCharge = chargeCents(matching.filter((c) => c.apply_to !== 'delivery' && !String(c.code || '').toLowerCase().includes('delivery')));
    const deliveryCharge = orderType === 'delivery'
        ? chargeCents(matching.filter((c) => c.apply_to === 'delivery' || String(c.code || '').toLowerCase().includes('delivery')))
        : 0;
    const total = Math.max(0, netBase + tax + serviceCharge + deliveryCharge);
    return {
        subtotal,
        discountCents,
        loyaltyDiscountCents,
        tax,
        serviceCharge,
        deliveryCharge,
        total,
        itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
}

export function cartPayloadFromState(state) {
    return {
        order_type: state.orderType,
        restaurant_table_id: state.orderType === 'dine_in' ? Number(state.tableId) || null : null,
        customer_id: state.customerId ? Number(state.customerId) : null,
        discount_total: Number(state.discountTotal) || 0,
        coupon_code: state.couponCode || null,
        loyalty_points: Number(state.loyaltyPoints) || 0,
        notes: state.orderNotes || null,
        delivery_name: state.deliveryName || null,
        delivery_address: state.deliveryAddress || null,
        delivery_phone: state.deliveryPhone || null,
        processing_minutes: state.processingMinutes === '' || state.processingMinutes == null ? null : Number(state.processingMinutes),
        custom_slip_message: state.customSlipMessage || null,
        payment_status: state.paymentStatus || 'paid',
        deals: state.cart.filter((item) => item.isDeal).map((item) => ({
            deal_id: item.deal.id,
            quantity: item.quantity,
            notes: item.notes || null,
            _ui: { deal: item.deal },
        })),
        items: state.cart.filter((item) => !item.isDeal).map((item) => ({
            dish_id: item.dish.id,
            dish_variant_id: item.variant?.id || null,
            quantity: item.quantity,
            discount: 0,
            notes: composeItemNotes(item.notes, item.removedIngredients) || null,
            addon_ids: item.addons.map((addon) => addon.id),
            removed_ingredient_ids: (item.removedIngredients || []).map((row) => row.id),
            _ui: {
                key: item.key,
                unitCents: item.unitCents,
                tax_percent: item.tax_percent,
                dish: item.dish,
                variant: item.variant,
                addons: item.addons,
                removedIngredients: item.removedIngredients || [],
                notes: item.notes || '',
            },
        })),
    };
}

export function restoreDealItems(payloadDeals, deals = []) {
    return (payloadDeals || []).map((row) => {
        const deal = deals.find((d) => d.id === row.deal_id) || row._ui?.deal;
        return deal ? buildDealCartItem(deal, row.quantity, row.notes || '') : null;
    }).filter(Boolean);
}

export function restoreCartItems(payloadItems, dishes = []) {
    return (payloadItems || []).map((item) => {
        if (item._ui) {
            return {
                key: item._ui.key,
                dish: item._ui.dish,
                variant: item._ui.variant,
                addons: item._ui.addons || [],
                removedIngredients: item._ui.removedIngredients || [],
                quantity: item.quantity,
                unitCents: item._ui.unitCents,
                tax_percent: item._ui.tax_percent,
                notes: item._ui.notes ?? item.notes ?? '',
            };
        }
        const dish = dishes.find((d) => d.id === item.dish_id);
        if (!dish) return null;
        const variant = (dish.variants || []).find((v) => v.id === item.dish_variant_id) || null;
        const addonIds = item.addon_ids || [];
        const removedIds = new Set((item.removed_ingredient_ids || []).map(Number));
        const pool = (variant?.ingredients?.length ? variant.ingredients : dish.ingredients) || [];
        const removedIngredients = pool.filter((row) => removedIds.has(Number(row.id)));
        return buildCartItem(dish, variant, addonIds, item.quantity, item.notes || '', removedIngredients);
    }).filter(Boolean);
}
