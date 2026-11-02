import { Check, CircleDot, Minus, Plus, Search, ShoppingBag, Trash2, Utensils } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api.js';

const money = (cents) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(cents / 100);
const toCents = (value) => Math.round(Number(value || 0) * 100);

export default function PublicQrMenuPage() {
    const { token } = useParams();
    const [table, setTable] = useState(null);
    const [menu, setMenu] = useState(null);
    const [error, setError] = useState('');
    const [category, setCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [customizing, setCustomizing] = useState(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [placed, setPlaced] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const [info, catalog] = await Promise.all([
                    api(`/public/qr/${token}`),
                    api(`/public/qr/${token}/menu`),
                ]);
                setTable(info.data);
                setMenu(catalog.data);
            } catch (err) {
                setError(err.message || 'This table QR code is not available.');
            }
        }
        load();
    }, [token]);

    const dishes = useMemo(() => (menu?.dishes || []).filter((dish) => (
        (category === 'all' || dish.category_id === category)
        && `${dish.name} ${dish.description || ''}`.toLowerCase().includes(query.toLowerCase())
    )), [menu, category, query]);

    const subtotal = cart.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
    const tax = cart.reduce((sum, item) => sum + Math.round(item.unitCents * item.quantity * Number(item.tax_percent || 0) / 100), 0);
    const total = subtotal + tax;

    function chooseDish(dish) {
        if ((dish.variants || []).length || (dish.addons || []).length) {
            setCustomizing({ dish, variant: dish.variants?.[0] || null, addonIds: [] });
        } else {
            addToCart(dish);
        }
    }

    function addToCart(dish, variant = null, addonIds = []) {
        const addons = (dish.addons || []).filter((addon) => addonIds.includes(addon.id));
        const key = `${dish.id}:${variant?.id || 0}:${[...addonIds].sort().join(',')}`;
        const unitCents = toCents(variant?.price ?? dish.price) + addons.reduce((sum, addon) => sum + toCents(addon.price), 0);
        setCart((items) => {
            const existing = items.find((item) => item.key === key);
            return existing
                ? items.map((item) => (item.key === key ? { ...item, quantity: item.quantity + 1 } : item))
                : [...items, { key, dish, variant, addons, quantity: 1, unitCents, tax_percent: dish.tax_percent || 0, notes: '' }];
        });
        setCustomizing(null);
        setCartOpen(true);
    }

    function changeQuantity(key, amount) {
        setCart((items) => items
            .map((item) => (item.key === key ? { ...item, quantity: item.quantity + amount } : item))
            .filter((item) => item.quantity > 0));
    }

    async function placeOrder() {
        if (!cart.length) return;
        setBusy(true);
        try {
            const response = await api(`/public/qr/${token}/orders`, {
                method: 'POST',
                body: JSON.stringify({
                    guest_name: guestName || null,
                    guest_phone: guestPhone || null,
                    notes: notes || null,
                    items: cart.map((item) => ({
                        dish_id: item.dish.id,
                        dish_variant_id: item.variant?.id || null,
                        quantity: item.quantity,
                        notes: item.notes || null,
                        addon_ids: item.addons.map((addon) => addon.id),
                    })),
                }),
            });
            setPlaced(response.data);
            setCart([]);
            setCartOpen(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (error && !table) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#edf0e8] p-6 text-center">
                <div className="max-w-sm rounded-3xl bg-white p-8 soft-shadow">
                    <p className="text-lg font-semibold text-coral">QR unavailable</p>
                    <p className="mt-2 text-sm text-ink/50">{error}</p>
                </div>
            </main>
        );
    }

    if (!table || !menu) {
        return <main className="grid min-h-screen place-items-center bg-[#edf0e8] text-ink/45">Loading menu…</main>;
    }

    if (placed) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#edf0e8] p-6">
                <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center soft-shadow">
                    <p className="text-xs font-semibold uppercase tracking-wider text-herb">Order placed</p>
                    <h1 className="mt-2 text-3xl font-semibold">{placed.order_number || 'Received'}</h1>
                    <p className="mt-3 text-sm text-ink/50">
                        Your order for {table.table?.name || table.name || 'your table'} is pending staff acceptance.
                    </p>
                    <p className="mt-6 rounded-2xl bg-ink/[.04] px-4 py-3 text-sm">
                        Status: <span className="font-semibold capitalize">{String(placed.status || 'pending').replace(/_/g, ' ')}</span>
                    </p>
                    <button type="button" onClick={() => setPlaced(null)} className="mt-6 w-full rounded-xl bg-ink py-3 font-semibold text-white">
                        Order more
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#edf0e8] pb-28">
            <header className="sticky top-0 z-20 border-b border-ink/5 bg-[#12150f] px-4 py-4 text-white">
                <p className="text-xs text-white/45">{table.restaurant?.name || table.restaurant_name || 'AFC'}</p>
                <h1 className="text-xl font-semibold">{table.table?.name || table.name || 'Table menu'}</h1>
                <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-sm text-ink outline-none"
                        placeholder="Search the menu…"
                    />
                </div>
            </header>

            {error && <button type="button" onClick={() => setError('')} className="w-full bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error}</button>}

            <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3">
                <button type="button" onClick={() => setCategory('all')} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${category === 'all' ? 'bg-ink text-white' : 'bg-white'}`}>All</button>
                {(menu.categories || []).map((item) => (
                    <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${category === item.id ? 'bg-ink text-white' : 'bg-white'}`}>
                        {item.name}
                    </button>
                ))}
            </div>

            <div className="grid gap-3 px-4 sm:grid-cols-2">
                {dishes.map((dish, index) => (
                    <button key={dish.id} type="button" onClick={() => chooseDish(dish)} className="overflow-hidden rounded-2xl bg-white text-left soft-shadow">
                        <div className={`grid aspect-[1.6] place-items-center ${['bg-[#f5dfd0]', 'bg-[#dfe9d6]', 'bg-[#e0e8f5]', 'bg-[#f4e7c2]'][index % 4]}`}>
                            <Utensils size={28} className="text-ink/30" />
                        </div>
                        <div className="p-3">
                            <p className="font-semibold">{dish.name}</p>
                            {dish.description && <p className="mt-1 line-clamp-2 text-xs text-ink/45">{dish.description}</p>}
                            <p className="mt-3 font-semibold text-herb">{money(toCents(dish.price))}</p>
                        </div>
                    </button>
                ))}
                {!dishes.length && <p className="col-span-full py-16 text-center text-sm text-ink/40">No dishes in this view.</p>}
            </div>

            <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-white shadow-xl"
            >
                <ShoppingBag size={18} />
                <span className="font-semibold">{cart.reduce((n, i) => n + i.quantity, 0)} items</span>
                <span className="text-lime">{money(total)}</span>
            </button>

            {customizing && (
                <div className="fixed inset-0 z-40 grid place-items-end bg-ink/50 p-3 sm:place-items-center">
                    <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5">
                        <h2 className="text-xl font-semibold">{customizing.dish.name}</h2>
                        {(customizing.dish.variants || []).length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Size</p>
                                <div className="grid gap-2">
                                    {customizing.dish.variants.map((variant) => (
                                        <button key={variant.id} type="button" onClick={() => setCustomizing({ ...customizing, variant })} className={`flex justify-between rounded-xl border p-3 text-sm ${customizing.variant?.id === variant.id ? 'border-herb bg-herb/5' : 'border-ink/10'}`}>
                                            <span>{variant.name}</span>
                                            <span className="font-semibold">{money(toCents(variant.price))}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(customizing.dish.addons || []).length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Add-ons</p>
                                <div className="grid gap-2">
                                    {customizing.dish.addons.map((addon) => {
                                        const selected = customizing.addonIds.includes(addon.id);
                                        return (
                                            <button
                                                key={addon.id}
                                                type="button"
                                                onClick={() => setCustomizing({
                                                    ...customizing,
                                                    addonIds: selected
                                                        ? customizing.addonIds.filter((id) => id !== addon.id)
                                                        : [...customizing.addonIds, addon.id],
                                                })}
                                                className={`flex justify-between rounded-xl border p-3 text-sm ${selected ? 'border-herb bg-herb/5' : 'border-ink/10'}`}
                                            >
                                                <span className="flex items-center gap-2">{selected ? <Check size={16} /> : <CircleDot size={16} className="text-ink/25" />}{addon.name}</span>
                                                <span className="font-semibold">+{money(toCents(addon.price))}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setCustomizing(null)} className="rounded-xl bg-ink/5 py-3 font-semibold">Cancel</button>
                            <button type="button" onClick={() => addToCart(customizing.dish, customizing.variant, customizing.addonIds)} className="rounded-xl bg-ink py-3 font-semibold text-white">Add</button>
                        </div>
                    </div>
                </div>
            )}

            {cartOpen && (
                <div className="fixed inset-0 z-40 grid place-items-end bg-ink/55">
                    <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Your order</h2>
                            <button type="button" onClick={() => setCartOpen(false)} className="text-ink/40">Close</button>
                        </div>
                        {cart.length ? cart.map((item) => (
                            <div key={item.key} className="mb-3 rounded-2xl bg-ink/[.035] p-3">
                                <div className="flex justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{item.dish.name}</p>
                                        <p className="text-xs text-ink/45">{[item.variant?.name, ...item.addons.map((a) => a.name)].filter(Boolean).join(' · ') || 'Standard'}</p>
                                    </div>
                                    <button type="button" onClick={() => setCart((items) => items.filter((line) => line.key !== item.key))} className="text-ink/30"><Trash2 size={16} /></button>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center rounded-lg bg-white">
                                        <button type="button" onClick={() => changeQuantity(item.key, -1)} className="p-2"><Minus size={14} /></button>
                                        <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                                        <button type="button" onClick={() => changeQuantity(item.key, 1)} className="p-2"><Plus size={14} /></button>
                                    </div>
                                    <span className="font-semibold">{money(item.unitCents * item.quantity)}</span>
                                </div>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-ink/40">Cart is empty</p>}

                        <div className="mt-4 grid gap-3">
                            <input className="field" placeholder="Your name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                            <input className="field" placeholder="Phone (optional)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                            <textarea className="field min-h-20" placeholder="Order notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-ink/50"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                            <div className="flex justify-between text-ink/50"><span>Tax</span><span>{money(tax)}</span></div>
                            <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div>
                        </div>
                        <button
                            type="button"
                            disabled={!cart.length || busy}
                            onClick={placeOrder}
                            className="mt-4 w-full rounded-xl bg-lime py-3.5 font-semibold text-ink disabled:opacity-40"
                        >
                            {busy ? 'Placing…' : `Place order · ${money(total)}`}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
