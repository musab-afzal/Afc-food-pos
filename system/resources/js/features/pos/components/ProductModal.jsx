import { Check, CircleDot, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { money, toCents } from '../utils/cart.js';

function ingredientPool(dish, variant, multiVariant) {
    if (multiVariant) {
        const fromDish = dish.ingredients || [];
        if (fromDish.length) return fromDish;
        const unique = new Map();
        (dish.variants || []).forEach((row) => {
            (row.ingredients || []).forEach((ingredient) => {
                if (!unique.has(ingredient.id)) unique.set(ingredient.id, ingredient);
            });
        });
        return [...unique.values()];
    }
    if (variant?.ingredients?.length) return variant.ingredients;
    return dish.ingredients || [];
}

export default function ProductModal() {
    const { state, patch, saveCustomized, addVariantLines } = usePos();
    const draft = state.customizing;
    const [variant, setVariant] = useState(null);
    const [variantQtys, setVariantQtys] = useState({});
    const [addonIds, setAddonIds] = useState([]);
    const [removedIngredients, setRemovedIngredients] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');

    const variants = draft?.dish?.variants || [];
    const editing = Boolean(state.editingKey);
    const multiVariant = !editing && variants.length > 0;

    useEffect(() => {
        if (!draft) return;
        setAddonIds((draft.addonIds || []).map(Number));
        setRemovedIngredients(draft.removedIngredients || []);
        setNotes(draft.notes || '');
        if (state.editingKey) {
            setVariant(draft.variant || variants[0] || null);
            setQuantity(draft.quantity || 1);
            setVariantQtys({});
            return;
        }
        if (variants.length) {
            // Start with zero on every variation so each choice is explicit and separate.
            const qtys = Object.fromEntries(variants.map((row) => [row.id, 0]));
            if (draft.variant?.id) qtys[draft.variant.id] = Math.max(1, draft.quantity || 1);
            setVariantQtys(qtys);
            setVariant(null);
            setQuantity(1);
            return;
        }
        setVariant(null);
        setVariantQtys({});
        setQuantity(draft.quantity || 1);
    }, [draft, state.editingKey]);

    const ingredients = useMemo(
        () => (draft ? ingredientPool(draft.dish, variant, multiVariant) : []),
        [draft, variant, multiVariant],
    );

    const lineTotal = useMemo(() => {
        if (!draft) return 0;
        const addons = (draft.dish.addons || []).filter((a) => addonIds.map(Number).includes(Number(a.id)));
        const addonCents = addons.reduce((sum, a) => sum + toCents(a.price), 0);
        if (multiVariant) {
            return variants.reduce((sum, row) => {
                const qty = Number(variantQtys[row.id] || 0);
                if (qty < 1) return sum;
                return sum + (toCents(row.price ?? draft.dish.price) + addonCents) * qty;
            }, 0);
        }
        const unit = toCents(variant?.price ?? draft.dish.price) + addonCents;
        return unit * Math.max(1, quantity);
    }, [draft, multiVariant, variants, variantQtys, variant, addonIds, quantity]);

    if (!draft) return null;
    const dish = draft.dish;
    const selectedVariantCount = multiVariant
        ? Object.values(variantQtys).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0)
        : 0;
    const needsVariant = editing
        ? variants.length > 0 && !variant
        : multiVariant
            ? selectedVariantCount < 1
            : false;

    function toggleAddon(id) {
        const numeric = Number(id);
        setAddonIds((ids) => (ids.map(Number).includes(numeric) ? ids.filter((x) => Number(x) !== numeric) : [...ids, numeric]));
    }

    function toggleRemoved(ingredient) {
        const numeric = Number(ingredient.id);
        setRemovedIngredients((current) => (
            current.some((row) => Number(row.id) === numeric)
                ? current.filter((row) => Number(row.id) !== numeric)
                : [...current, { id: numeric, name: ingredient.name }]
        ));
    }

    function setQtyForVariant(id, next) {
        setVariantQtys((current) => ({ ...current, [id]: Math.max(0, next) }));
    }

    function submit() {
        if (needsVariant) return;
        if (multiVariant) {
            const lines = variants
                .map((row) => ({ variant: row, quantity: Number(variantQtys[row.id] || 0) }))
                .filter((row) => row.quantity > 0);
            addVariantLines({ dish, lines, addonIds, notes, removedIngredients });
            return;
        }
        saveCustomized({ dish, variant, addonIds, quantity, notes, removedIngredients });
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/50 p-0 sm:place-items-center sm:p-4" onClick={() => patch({ customizing: null, editingKey: null })}>
            <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white soft-shadow sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-ink/7 p-5">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-herb">{editing ? 'Edit item' : 'Customize'}</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{dish.name}</h2>
                        <p className="mt-1 text-sm text-ink/45">
                            {multiVariant
                                ? 'Set quantity for each variation. Different variations are added as separate items.'
                                : (dish.description || 'Build this item for the check.')}
                        </p>
                    </div>
                    <button type="button" onClick={() => patch({ customizing: null, editingKey: null })} className="text-ink/35 hover:text-ink"><X size={20} /></button>
                </div>

                <div className="pos-scroll flex-1 space-y-6 p-5">
                    {variants.length > 0 && multiVariant && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Variations</p>
                            <div className="grid gap-2">
                                {variants.map((row) => {
                                    const qty = Number(variantQtys[row.id] || 0);
                                    return (
                                        <div key={row.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm ${qty > 0 ? 'border-herb bg-herb/5' : 'border-ink/10'}`}>
                                            <div className="min-w-0">
                                                <p className="font-semibold">{dish.name} <span className="font-medium text-ink/55">({row.name})</span></p>
                                                <p className="mt-0.5 text-xs font-semibold text-ink/55">{money(toCents(row.price ?? dish.price))}</p>
                                            </div>
                                            <div className="flex items-center rounded-xl bg-ink/5">
                                                <button type="button" className="p-2.5" aria-label={`Decrease ${row.name}`} onClick={() => setQtyForVariant(row.id, qty - 1)}><Minus size={16} /></button>
                                                <span className="w-8 text-center text-base font-semibold">{qty}</span>
                                                <button type="button" className="p-2.5" aria-label={`Increase ${row.name}`} onClick={() => setQtyForVariant(row.id, qty + 1)}><Plus size={16} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {variants.length > 0 && editing && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Size / Variant</p>
                            <div className="grid gap-2">
                                {variants.map((row) => (
                                    <button
                                        key={row.id}
                                        type="button"
                                        onClick={() => setVariant(row)}
                                        className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm ${Number(variant?.id) === Number(row.id) ? 'border-herb bg-herb/5' : 'border-ink/10'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {Number(variant?.id) === Number(row.id) ? <Check size={16} className="text-herb" /> : <CircleDot size={16} className="text-ink/25" />}
                                            {dish.name} ({row.name})
                                        </span>
                                        <span className="font-semibold">{money(toCents(row.price ?? dish.price))}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(dish.addons || []).length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Add-ons</p>
                            <div className="grid gap-2">
                                {dish.addons.map((addon) => {
                                    const selected = addonIds.map(Number).includes(Number(addon.id));
                                    return (
                                        <button
                                            key={addon.id}
                                            type="button"
                                            onClick={() => toggleAddon(addon.id)}
                                            className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm ${selected ? 'border-herb bg-herb/5' : 'border-ink/10'}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {selected ? <Check size={16} className="text-herb" /> : <CircleDot size={16} className="text-ink/25" />}
                                                {addon.name}
                                            </span>
                                            <span className="font-semibold">+{money(toCents(addon.price))}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {ingredients.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Remove ingredients</p>
                            <p className="mb-2 text-xs text-ink/40">Tap to leave out. Kitchen will see “No …” on the ticket.</p>
                            <div className="grid gap-2">
                                {ingredients.map((ingredient) => {
                                    const selected = removedIngredients.some((row) => Number(row.id) === Number(ingredient.id));
                                    return (
                                        <button
                                            key={ingredient.id}
                                            type="button"
                                            onClick={() => toggleRemoved(ingredient)}
                                            className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm ${selected ? 'border-orange-400 bg-orange-50 text-orange-900' : 'border-ink/10'}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {selected ? <Check size={16} className="text-orange-500" /> : <CircleDot size={16} className="text-ink/25" />}
                                                {selected ? `No ${ingredient.name}` : ingredient.name}
                                            </span>
                                            <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                                                {selected ? 'Removed' : 'Remove'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Special instructions</p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Less spicy, extra sauce…"
                            className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm outline-none focus:border-herb/40"
                        />
                    </div>

                    {!multiVariant && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Quantity</p>
                            <div className="flex items-center rounded-xl bg-ink/5">
                                <button type="button" className="p-3" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
                                <span className="w-10 text-center text-base font-semibold">{quantity}</span>
                                <button type="button" className="p-3" onClick={() => setQuantity((q) => q + 1)}><Plus size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-ink/7 p-4">
                    <button
                        type="button"
                        disabled={needsVariant}
                        onClick={submit}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                        {editing ? 'Update item' : multiVariant ? 'Add variations to order' : 'Add to order'} — {money(lineTotal)}
                    </button>
                </div>
            </div>
        </div>
    );
}
