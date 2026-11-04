import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { api } from '../../services/api.js';

const groups = {
    restaurant: {
        title: 'Restaurant',
        description: 'Identity, contact details, and locale defaults.',
        fields: [
            { key: 'restaurant.name', label: 'Restaurant name', type: 'text' },
            { key: 'restaurant.tagline', label: 'Tagline', type: 'text' },
            { key: 'restaurant.logo', label: 'Logo URL / path', type: 'text' },
            { key: 'restaurant.address', label: 'Address', type: 'textarea' },
            { key: 'restaurant.phone', label: 'Phone', type: 'text' },
            { key: 'restaurant.email', label: 'Email', type: 'email' },
            { key: 'restaurant.tax_number', label: 'Tax number', type: 'text' },
            { key: 'restaurant.website', label: 'Website', type: 'text' },
            { key: 'restaurant.timezone', label: 'Timezone', type: 'text' },
            { key: 'restaurant.date_format', label: 'Date format', type: 'text' },
            { key: 'restaurant.time_format', label: 'Time format', type: 'text' },
        ],
    },
    pos: {
        title: 'POS',
        description: 'Checkout rules, discounts, and register requirements.',
        fields: [
            { key: 'pos.default_order_type', label: 'Default order type', type: 'select', options: ['dine_in', 'takeaway', 'delivery'] },
            { key: 'pos.allow_negative_stock', label: 'Allow negative stock', type: 'boolean' },
            { key: 'pos.require_customer', label: 'Require customer', type: 'boolean' },
            { key: 'pos.require_table', label: 'Require table for dine-in', type: 'boolean' },
            { key: 'pos.allow_discounts', label: 'Allow discounts', type: 'boolean' },
            { key: 'pos.cashier_max_discount', label: 'Cashier max discount %', type: 'number' },
            { key: 'pos.auto_print', label: 'Auto print receipt', type: 'boolean' },
            { key: 'pos.hold_orders', label: 'Enable hold orders', type: 'boolean' },
            { key: 'pos.require_register', label: 'Require open register', type: 'boolean' },
            { key: 'pos.require_shift', label: 'Require shift', type: 'boolean' },
        ],
    },
    order: {
        title: 'Order',
        description: 'Numbering and inventory deduction timing.',
        fields: [
            { key: 'order.prefix', label: 'Order prefix', type: 'text' },
            { key: 'order.invoice_prefix', label: 'Invoice prefix', type: 'text' },
            { key: 'order.auto_kitchen_send', label: 'Auto send to kitchen', type: 'boolean' },
            { key: 'order.inventory_deduct_on', label: 'Inventory deduction timing', type: 'select', options: ['confirmation', 'kitchen_accept', 'completion'] },
        ],
    },
    kitchen: {
        title: 'Kitchen',
        description: 'Display thresholds and notifications.',
        fields: [
            { key: 'kitchen.enabled', label: 'Enable kitchen module', type: 'boolean', default: true },
            { key: 'kitchen.warning_minutes', label: 'Warning minutes', type: 'number' },
            { key: 'kitchen.delay_minutes', label: 'Delay minutes', type: 'number' },
            { key: 'kitchen.sound_notification', label: 'Sound notification', type: 'boolean' },
            { key: 'kitchen.auto_refresh', label: 'Auto refresh seconds', type: 'number' },
            { key: 'kitchen.show_waiter', label: 'Show waiter', type: 'boolean' },
            { key: 'kitchen.show_table', label: 'Show table', type: 'boolean' },
            { key: 'kitchen.show_notes', label: 'Show notes', type: 'boolean' },
        ],
    },
    delivery: {
        title: 'Delivery',
        description: 'Rider commission and COD settlement defaults.',
        fields: [
            { key: 'delivery.rider_commission_percent', label: 'Rider commission % of COD (suggested on settlements)', type: 'number' },
        ],
    },
    inventory: {
        title: 'Inventory',
        description: 'Stock rules and costing method.',
        fields: [
            { key: 'inventory.allow_negative_stock', label: 'Allow negative stock', type: 'boolean' },
            { key: 'inventory.low_stock_notification', label: 'Low stock notifications', type: 'boolean' },
            { key: 'inventory.auto_recipe_deduction', label: 'Auto recipe deduction', type: 'boolean' },
            { key: 'inventory.cost_method', label: 'Cost method', type: 'select', options: ['weighted_average'] },
        ],
    },
    receipt: {
        title: 'Receipt',
        description: 'Print layout and footer text.',
        fields: [
            { key: 'receipt.paper_size', label: 'Paper size', type: 'select', options: ['58mm', '80mm', 'A4'] },
            { key: 'receipt.header', label: 'Header text', type: 'textarea' },
            { key: 'receipt.footer', label: 'Footer text', type: 'textarea' },
            { key: 'receipt.show_logo', label: 'Show logo', type: 'boolean' },
            { key: 'receipt.show_tax', label: 'Show tax', type: 'boolean' },
            { key: 'receipt.show_cashier', label: 'Show cashier', type: 'boolean' },
            { key: 'receipt.show_customer', label: 'Show customer', type: 'boolean' },
            { key: 'receipt.show_review_qr', label: 'Show review QR on invoice', type: 'boolean' },
            { key: 'receipt.google_review_url', label: 'Google review URL', type: 'text' },
            { key: 'receipt.website_review_url', label: 'Website review URL', type: 'text' },
            { key: 'receipt.auto_print', label: 'Auto print', type: 'boolean' },
        ],
    },
    loyalty: {
        title: 'Loyalty',
        description: 'Points earning and redemption rules.',
        fields: [
            { key: 'loyalty.enabled', label: 'Enabled', type: 'boolean' },
            { key: 'loyalty.spend_amount', label: 'Spend amount for points', type: 'number' },
            { key: 'loyalty.points_earned', label: 'Points earned', type: 'number' },
            { key: 'loyalty.redemption_value', label: 'Point redemption value', type: 'number' },
            { key: 'loyalty.min_redemption', label: 'Minimum redemption points', type: 'number' },
            { key: 'loyalty.max_redemption', label: 'Maximum redemption points', type: 'number' },
        ],
    },
    currency: {
        title: 'Currency',
        description: 'Display currency for the restaurant.',
        fields: [
            { key: 'currency.code', label: 'Currency code', type: 'text' },
            { key: 'currency.symbol', label: 'Currency symbol', type: 'text' },
            { key: 'currency.position', label: 'Symbol position', type: 'select', options: ['before', 'after'] },
        ],
    },
    system: {
        title: 'System',
        description: 'Operational defaults for this single restaurant.',
        fields: [
            { key: 'system.app_name', label: 'Application name', type: 'text' },
            { key: 'system.pagination', label: 'Default page size', type: 'number' },
            { key: 'system.low_stock_threshold_notify', label: 'Notify on low stock', type: 'boolean' },
        ],
    },
};

export default function SettingsGroupPage({ group }) {
    const config = groups[group];
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const payload = useMemo(() => config.fields.map((field) => ({
        key: field.key,
        value: values[field.key],
        type: field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : 'string',
        group,
    })), [config.fields, values, group]);

    useEffect(() => {
        setLoading(true);
        api(`/settings?group=${group}`)
            .then((response) => {
                const next = {};
                config.fields.forEach((field) => {
                    next[field.key] = response.data?.[field.key] ?? field.default ?? (field.type === 'boolean' ? false : '');
                });
                setValues(next);
            })
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [group]);

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/settings', { method: 'PUT', body: JSON.stringify({ settings: payload }) });
            toast.success(`${config.title} settings saved`);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (!config) return null;

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader title={config.title} description={config.description} breadcrumbs={['Settings', config.title]} />
            <form onSubmit={save} className="rounded-3xl bg-white p-6 soft-shadow">
                {loading ? (
                    <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/5" />)}</div>
                ) : (
                    <div className="space-y-5">
                        {config.fields.map((field) => (
                            <label key={field.key} className="block text-sm">
                                <span className="mb-2 block font-medium text-ink/70">{field.label}</span>
                                {field.type === 'boolean' ? (
                                    <button
                                        type="button"
                                        onClick={() => setValues((current) => ({ ...current, [field.key]: !current[field.key] }))}
                                        className={`relative h-8 w-14 rounded-full transition ${values[field.key] ? 'bg-herb' : 'bg-ink/15'}`}
                                    >
                                        <span className={`absolute top-1 size-6 rounded-full bg-white transition ${values[field.key] ? 'left-7' : 'left-1'}`} />
                                    </button>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        className="field min-h-24"
                                        value={values[field.key] ?? ''}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        className="field"
                                        value={values[field.key] ?? ''}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                    >
                                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        className="field"
                                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                        value={values[field.key] ?? ''}
                                        onChange={(e) => setValues({
                                            ...values,
                                            [field.key]: field.type === 'number' ? e.target.value : e.target.value,
                                        })}
                                    />
                                )}
                            </label>
                        ))}
                    </div>
                )}
                <button disabled={busy || loading} className="mt-7 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? 'Saving…' : 'Save settings'}
                </button>
            </form>
        </div>
    );
}
